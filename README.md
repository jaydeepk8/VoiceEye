# VoiceEye

A communication bridge between someone who cannot see and someone who cannot hear.
If one person signs and the other is blind, neither of the usual channels works.
VoiceEye closes the loop in both directions:

- **Sign to voice** — a deaf person signs, the system speaks it aloud
- **Voice to sign** — a blind person speaks, the system renders Indian Sign Language

Companion to *VoiceEye: A Communication Aid Between a Voiceless and Sightless*
(ICCUBEA 2024, [10.1109/ICCUBEA61740.2024.10775052](https://doi.org/10.1109/ICCUBEA61740.2024.10775052)).

## Layout

```
src/          React front end (Vite)
ml/           landmark extraction, training, real-time loop
server/       FastAPI WebSocket inference service
data/         clips and features (gitignored)
```

## Setting up the recognition side

Python **3.12 exactly** — mediapipe ships no 3.13+ wheels, and numpy>=2.5 needs >=3.12.

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv/Scripts/python ml/download_models.py
```

The CPU torch index matters: the default Windows wheel bundles CUDA and costs
several GB, and a two-layer GRU has no use for a GPU.

## How it works

A frame becomes a 155-dimensional vector: nine upper-body pose points, both
hands at 21 points each, and two flags for whether each hand was found. The
468-point face mesh is dropped — it is noise for word-level signs. Everything
is measured from the shoulder midpoint and divided by shoulder width, so the
same gesture yields the same vector whether the signer is near the camera or
across the room.

Those vectors feed a GRU over a 30-frame window. It is unidirectional on
purpose: a bidirectional model scores better on benchmarks and cannot work
here, because the system has to answer while the signer is still signing.

Between the model and the speaker sits a segmenter, which is what stops the
output being a stream of babble. A word is only emitted when the hands are
moving, the model is confident, it has said the same thing several frames
running, and it has not just spoken. Then it stays quiet for a cooldown.

## Commands

```bash
python ml/record.py --word hello --signer yourname --clips 30   # capture
python ml/ingest_include.py --zip data/Greetings_1of2.zip       # INCLUDE corpus
python ml/train.py --epochs 40                                  # train
python ml/live.py                                               # webcam demo
uvicorn server.app:app --port 8000                              # serve to browser
```

Then `npm run dev` and open the sign-to-voice page.

End to end on held-out session clips, 4 of 5 words are recognised and spoken
correctly, one word per sign. `good_morning` is the miss.

## Results

Five words from INCLUDE's Greetings set — *hello, good morning, good afternoon,
how are you, alright* — 105 clips.

| Evaluation | Clip accuracy |
|---|---|
| Random split, same recording sessions | **1.000** |
| Leave-one-session-out, 5 folds | **0.864** (sd 0.046, range 0.800–0.944) |

Both numbers come from the same data and the same model. The first one is
worthless: INCLUDE's clips come in near-identical takes, so a random split puts
the same take on both sides and measures memorisation. The gap between the two
rows *is* the leakage, and it is the reason `dataset.py` refuses to produce a
single-signer split unless you explicitly override it.

For reference, published results on the full [INCLUDE](https://zenodo.org/records/4010759)
benchmark are 94.5% on its 50-word subset and 85.6% across all 263 words. 0.864
on five words sits in a believable place next to those; anything near 1.0 does
not.

The one systematic error is `good_morning` misread as `good_afternoon` — 4 of 4
in the worst fold, with every other class clean. The two signs share an opening
component, so this is the model failing where the signs genuinely overlap.

**Caveat on the sessions.** INCLUDE ships no signer field. The groups come from
clustering the source filenames' camera numbering, which falls into exactly five
groups with matching sizes and number bands across all five words — see
`label_sessions.py`. That is strong evidence of five recording sources, but it
is not proof of five *people*. Holding out a session is strictly harder than a
random split, so treat 0.864 as a floor. A real signer-independent number needs
clips recorded by someone not in this dataset.

## Tests

```bash
cd ml && python test_landmarks.py && python test_dataset.py && python test_live.py
```

No camera or trained model needed — the parts worth testing take plain arrays.

## Credits

Dev Jaydeep Kulkarni · UI/UX Gaurav Mali
