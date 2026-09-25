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
python ml/label_sessions.py                                     # recover session groups
python ml/train.py --epochs 30                                  # train
python ml/ablate.py                                             # cross-validated comparison
python ml/live.py                                               # webcam demo
uvicorn server.app:app --port 8000                              # serve to browser
```

Then `npm run dev` and open the sign-to-voice page.

End to end on held-out session clips of the five-word model, 4 of 5 words are
recognised and spoken correctly, one word per sign.

## Results

Nine words from INCLUDE's Greetings set - *hello, good morning, good afternoon,
good evening, good night, how are you, alright, pleased, thank you* - 189 clips.

All numbers are leave-one-session-out: a whole recording session is held out,
the model trains from scratch, and a clip's windows are pooled into one answer.

| Vocabulary | Mean clip accuracy | Range |
|---|---|---|
| 5 words | **0.917** | 0.79 - 1.00 |
| 9 words | **0.671** | 0.44 - 0.82 |

Chance is 0.20 and 0.11 respectively. For reference, published results on the
full [INCLUDE](https://zenodo.org/records/4010759) benchmark are 94.5% on its
50-word subset and 85.6% across all 263 words.

### Two ways these numbers could have been wrong

A random split instead of a session split scores **1.000** on the five-word set.
INCLUDE's clips come in near-identical takes, so splitting randomly puts the
same take on both sides. `dataset.py` refuses to do it unless overridden.

Keeping the best epoch as judged by the test set added about **13 points**:
0.730 became 0.864. Both `train.py` and `ablate.py` now train a fixed number of
epochs and score once, at the end.

### What the ablations settled

| Change | 5-word CV |
|---|---|
| baseline, 30-frame window, with depth | 0.730 |
| drop MediaPipe z | 0.793 |
| 45-frame window | 0.836 |
| both | **0.917** |

MediaPipe's monocular depth was hurting. That matches the first measurement in
the project: across two resolutions of the same photo, pose z deviated by 0.317
against a median of 0.034 for everything else. The GRU was fitting its noise.
Clips keep their z on disk; `feature_columns()` selects it out, and the choice
travels in the checkpoint so inference applies the same columns.

Longer windows do not help beyond 45, despite a median clip of 65 frames: 60
scores 0.461 and 75 scores 0.209. Longer windows yield fewer training windows
per clip and pad most of them.

### Where it fails

The four time-of-day greetings collapse into each other. In the worst fold,
*hello*, *how are you*, *pleased* and *thank you* were perfect while afternoon,
evening, morning and night formed a confusion chain. They share a "good"
component and the model cannot separate what follows it. Five-word accuracy is
high partly because that family is not in it.

**Caveat on the sessions.** INCLUDE ships no signer field. The groups come from clustering the source filenames' camera numbering - see `label_sessions.py`. Eight of nine words fall into five clean groups; `good_evening` splits into six and is forced to five. The numbering is not globally unique either: in the second archive, *good evening* and *good night* share numbers 1-5. So a session is a recording source, not provably a person, and every figure above is a floor rather than a signer-independent result. Closing that gap needs clips from someone outside the dataset - see **Recording your own clips**.

## Making the avatar sign

`/Deaf` takes speech or typed text, finds known signs in it, and has a 3D
avatar perform them. Nobody hand-animated those signs: the motion is lifted
from the same INCLUDE recordings the recogniser was trained on, so both halves
of the bridge share one vocabulary.

```
python ml/sign_motion.py      # landmarks from the source clips
python ml/retarget.py         # -> public/signs/<word>.motion.json
```

The browser gets bone *directions* rather than quaternions. It already has the
skeleton with its bind pose and parent transforms, so turning a direction into
a local rotation is a few lines there and a reimplementation of three.js here.
Directions are also readable: a wrong one is a number you can look at.

### What went wrong, since none of it was obvious

**MediaPipe's world landmarks understate elevation.** They put the wrist 2cm
above the shoulder where the video plainly shows 17cm. Image-space landmarks
are directly observed and match the video, so X and Y come from there. Depth
comes from foreshortening instead: a limb of known length appearing shorter
than it is has gone away from the camera, and how much shorter says how far.

**Hand landmarks use different axes from body landmarks.** The same finger
measured both ways disagreed by 103-118 degrees. Hands are now built from
image-space points in the body's own frame, like everything else.

**MediaPipe's Left/Right hand labels are mirrored for this footage.** Each
detected hand is now given to whichever pose wrist it actually sits next to,
which is geometry rather than convention.

**A direction alone does not pin a bone's twist.** The elbow could hinge in any
plane and the palm could face anywhere, which is what made early attempts look
broken rather than merely inaccurate. The shoulder-elbow-wrist plane now fixes
the arm's roll and the knuckle line fixes the hand's.

### Checking it

Guessing at 3D from the outside does not work; these make it visible.

```
node tools/snap.mjs http://localhost:5173 hello 0.3,0.9,1.5 out    # render frozen frames
python tools/source_frames.py hello 0.3,0.9,1.5 out                # same moments from the video
python tools/montage.py out 0.3,0.9,1.5 compare.png                # side by side
node tools/rigcheck.mjs public/aniavatar.glb public/signs/hello.motion.json 0.9
```

`rigcheck` loads the real skeleton and measures the angle between where each
bone ended up and where the clip asked it to be. All nine signs across seven
moments land within 0.0 degrees. Add `?debug=1` to `/Deaf` for a live readout.

## Recording your own clips

Every clip in `data/raw` comes from INCLUDE, with a signer label inferred from
camera numbering in the filenames. Holding one of those out is harder than a
random split, but it is a recording source, not a person anyone can name. Until
somebody outside the dataset signs at it, the accuracy figures are a floor.

The avatar solves the problem that used to block this: you no longer need to
already know the signs. Watch one at `/Deaf`, copy it, record it.

```
python ml/record_session.py --signer <your-name>
python ml/evaluate.py --signer <your-name>
```

`record_session.py` walks the whole vocabulary, eight clips each by default.
SPACE records, R redoes the last one, Q moves to the next word. It refuses to
record when your shoulders are not visible, because the features are normalised
against shoulder width and there is nothing to normalise against otherwise.

Worth varying deliberately: where you stand, the lighting, what you are
wearing, which day it is. Eight identical clips teach it less than eight
different ones.

`evaluate.py` then trains on everything else and tests only on you, printing
per-word accuracy and a confusion matrix. That number is the honest one.

## Deploying

Live at `voiceeye-server.onrender.com`; the front end reads the host from
`VITE_SIGN_SERVER` at build time and needs a `wss://` scheme, because an
`https://` page cannot open a plain `ws://` socket.

The Python server cannot run on Netlify or Vercel - both are serverless, with
no persistent WebSocket - so it runs as a container on Render. `render.yaml`
describes the service.

### MediaPipe runs in the browser

The first working version sent JPEG frames and did detection on the server. It
worked and was unusable: 396ms per frame, 2.5fps, eighteen seconds to fill a
45-frame window on a 0.1-CPU instance.

Now the browser runs MediaPipe and sends landmarks. The server normalises them
and runs the GRU, which is 190k parameters and takes about a millisecond.

| | JPEG to server | landmarks to server |
|---|---|---|
| server time, 50 frames | 3.39s | 0.09s |
| payload per frame | 10KB | 4.9KB |
| deployed round trip | 396ms | 115ms |

The browser sends **raw landmarks, not finished features**. Normalisation stays
in `landmarks.py` where the training data was built, so there is no JavaScript
reimplementation to drift out of step with the model. Verified across runtimes
on one image: browser gave shoulder `0.6145, 0.4572, -0.1101`, Python gave
`0.6148, 0.4572, -0.1113`, both MediaPipe 1.0.1.

Two things worth knowing if you touch the browser side. MediaPipe defaults to
the CPU delegate, which costs 365ms per frame against 97ms on GPU, so
`Blind.jsx` asks for GPU and falls back to CPU. And the first GPU call spends
about eighteen seconds compiling shaders, which a warm-up absorbs during model
loading rather than in the middle of a sign.

The server runs ONNX rather than torch. `ml/export_onnx.py` converts a
checkpoint and checks parity against the torch model before writing it, which
keeps torch out of the image entirely.

```
python ml/export_onnx.py          # sign_gru.onnx + sign_gru.meta.json
docker build -t voiceeye-server . # or let Render build it
```

`SignRecogniser` picks its backend from the file extension, so `live.py` keeps
using the `.pt` locally while the server uses the `.onnx`. Both agree to 3e-07.

Only one person signs at a time. A new connection takes over from the previous
one, since two signers feeding one 45-frame window would interleave into
nonsense. Render's proxy does not always forward a close, so an idle timeout
releases sessions the proxy is still holding open.

## Tests

```bash
cd ml && python test_landmarks.py && python test_dataset.py && python test_live.py
```

No camera or trained model needed — the parts worth testing take plain arrays.

## Credits

Dev Jaydeep Kulkarni · UI/UX Gaurav Mali
