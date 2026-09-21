"""Export a trained checkpoint to ONNX so the server can drop torch.

    python ml/export_onnx.py

Writes sign_gru.onnx next to the checkpoint, plus sign_gru.meta.json holding
the labels, window, normalisation and column selection the runtime needs.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

CHECKPOINT_DIR = Path(__file__).resolve().parent / "checkpoints"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path, default=CHECKPOINT_DIR / "sign_gru.pt")
    parser.add_argument("--out", type=Path, default=CHECKPOINT_DIR / "sign_gru.onnx")
    parser.add_argument("--tolerance", type=float, default=1e-4)
    args = parser.parse_args()

    if not args.checkpoint.exists():
        print(f"no checkpoint at {args.checkpoint}")
        return 1

    import torch

    from train import SignGRU

    blob = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    labels = [w for w, _ in sorted(blob["labels"].items(), key=lambda kv: kv[1])]
    window = int(blob["window"])
    input_dim = int(blob["input_dim"])

    model = SignGRU(input_dim, int(blob["hidden"]), int(blob["layers"]), len(labels))
    model.load_state_dict(blob["state_dict"])
    model.eval()

    sample = torch.randn(1, window, input_dim)
    torch.onnx.export(
        model,
        sample,
        str(args.out),
        input_names=["window"],
        output_names=["logits"],
        dynamic_axes={"window": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
    )

    import onnx

    graph = onnx.load(str(args.out))
    onnx.save_model(graph, str(args.out), save_as_external_data=False)
    for stray in args.out.parent.glob(f"{args.out.name}.data"):
        stray.unlink()

    import onnxruntime

    session = onnxruntime.InferenceSession(str(args.out), providers=["CPUExecutionProvider"])
    with torch.no_grad():
        expected = model(sample).numpy()
    actual = session.run(None, {"window": sample.numpy()})[0]
    deviation = float(np.abs(expected - actual).max())

    if deviation > args.tolerance:
        print(f"parity check FAILED: max deviation {deviation:.2e}")
        args.out.unlink(missing_ok=True)
        return 1

    meta = {
        "labels": labels,
        "window": window,
        "input_dim": input_dim,
        "mean": np.asarray(blob["mean"], dtype=np.float32).tolist(),
        "std": np.asarray(blob["std"], dtype=np.float32).tolist(),
        "keep_columns": blob.get("keep_columns"),
        "clip_accuracy": blob.get("clip_accuracy"),
        "cv_mean": blob.get("cv_mean"),
        "signer_independent": blob.get("signer_independent", False),
    }
    meta_path = args.out.with_suffix(".meta.json")
    meta_path.write_text(json.dumps(meta), encoding="utf-8")

    print(f"parity ok, max deviation {deviation:.2e}")
    print(f"{args.out.name}  {args.out.stat().st_size / 1024:.0f} KB")
    print(f"{meta_path.name}  {meta_path.stat().st_size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
