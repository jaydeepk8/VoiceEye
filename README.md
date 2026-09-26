# VoiceEye

A deaf person and a blind person can't easily talk to each other. Signing needs
eyes, speaking needs ears. VoiceEye translates both ways.

- **Sign to voice**: sign at your camera, it says the word out loud.
- **Voice to sign**: speak or type, an avatar signs it back.

Live at [voice-eye.vercel.app](https://voice-eye.vercel.app). Nine ISL words so
far: hello, thank you, how are you, pleased, alright, and good morning /
afternoon / evening / night.

Rebuild of the system from the ICCUBEA 2024 paper
*VoiceEye: A Communication Aid Between a Voiceless and Sightless*
([doi](https://doi.org/10.1109/ICCUBEA61740.2024.10775052)).

## Sign to voice

MediaPipe runs in the browser and tracks your hands and upper body. Those points
go to a FastAPI server over a websocket. The server normalises them, runs a
45-frame window through a GRU, and sends a word back. The page speaks it.

Landmarks go over the wire, not video. That's 4.9KB a frame instead of a 10KB
JPEG, and the server barely works: 0.09s per 50 frames instead of 3.4s. On a
free Render box it's the difference between 9fps and 2.5.

The hard part isn't which sign, it's when. The model guesses thirty times a
second. `live.py` only speaks if the hands are moving, confidence holds, the same
word repeats a few frames, and it hasn't just spoken. Otherwise it babbles.

## Voice to sign

Nobody animated the avatar by hand. The motion comes from the same INCLUDE clips
the recogniser trained on, so both halves know the same nine words.

`sign_motion.py` reads the source videos, `retarget.py` turns each frame into
bone directions. The browser already has the skeleton, so it does the rotation
maths. Directions are also easy to debug, since a wrong one is just a number you
can read.

Stuff that was broken before it stopped looking like a puppet:

- MediaPipe's 3D output is bad here. It put the wrist 2cm above the shoulder
  when the video clearly shows 17cm. X and Y now come from the flat image
  positions, and depth from how foreshortened a limb looks against its real
  length.
- Hand points and body points use different axes. Same finger, two methods,
  100+ degrees apart.
- MediaPipe's left/right hand labels are mirrored on this footage. Each hand now
  goes to whichever wrist it's nearest.
- A direction says where a bone points, not how it's twisted. Elbows bent
  sideways and palms faced backwards. The shoulder-elbow-wrist plane fixes the
  arm, the knuckle line fixes the hand.

Between signs it stands still, breathes, glances around and blinks. That resting
pose is taken from how the dataset signers stand before they start, so going
into a sign doesn't jump.

## How well it works

Nine words, 189 clips. Scored by holding out a whole recording session and
retraining from scratch.

| Words | Accuracy |
|---|---|
| 5 | 0.917 |
| 9 | 0.671 |

Chance is 0.20 and 0.11. Published results on the full
[INCLUDE](https://zenodo.org/records/4010759) benchmark are 94.5% on its 50-word
subset, 85.6% across all 263.

That 0.671 needs a caveat. INCLUDE doesn't say who signed each clip, so the
"sessions" are inferred from camera numbering in the filenames. Holding one out
beats a random split, but it's a recording source, not a person. Until someone
outside the dataset signs at it, these are floors.

Two easy ways to fake a better number, both avoided. Splitting clips randomly
instead of by session gives a perfect 1.000, because INCLUDE's takes are nearly
identical and the same one lands on both sides. Keeping the best epoch by test
score adds ~13 points that vanish on new data.

What actually helped: dropping MediaPipe's depth and widening the window from 30
to 45 frames, which took five words from 0.730 to 0.917.

It fails predictably. The four time-of-day greetings all share a "good"
component and get confused with each other. Hello, thank you, how are you and
pleased are solid.

## Running it

Python 3.12. Not 3.13, MediaPipe has no wheels for it, and NumPy 2.5 won't go
below 3.12.

```
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
python ml/download_models.py
npm install
npm run dev
```

The front end points at `VITE_SIGN_SERVER`. That server runs on Render in a
container. It can't go on Vercel or Netlify, both are serverless and a websocket
needs something awake. It runs ONNX instead of torch to fit a free instance;
`export_onnx.py` does the conversion and diffs it against torch first.

```
python ml/train.py --epochs 30       # train
python ml/ablate.py                  # cross-validated comparison of settings
python ml/live.py                    # webcam to console, no browser
python ml/evaluate.py --signer you   # score against a held-out person
```

## Recording your own clips

Still the main thing missing. Everything in `data/` is INCLUDE. Someone outside
it needs to sign at the camera before the numbers above mean much.

You don't need to know ISL. Open the Voice to ISL page, watch the avatar do a
sign, copy it.

```
python ml/record_session.py --signer yourname
python ml/evaluate.py --signer yourname
```

Eight clips a word is about an hour. Move around between takes, change the
lighting, wear something else, come back another day. Eight identical clips are
worth much less than eight varied ones. The score will drop. That's the point.

## Checking changes

You can't fix 3D by guessing at it, so:

```
node tools/snap.mjs http://localhost:5173 hello 0.3,0.9,1.5 out
python tools/source_frames.py hello 0.3,0.9,1.5 out
python tools/montage.py out 0.3,0.9,1.5 compare.png
node tools/rigcheck.mjs public/aniavatar.glb public/signs/hello.motion.json 0.9
```

First three put the avatar next to the real signer at the same timestamp. Last
one checks the angle between where each bone landed and where the clip wanted
it. All nine signs come out at 0.0 degrees. `?debug=1` on the Voice to ISL page
gives a live readout.

```
python ml/test_landmarks.py
python ml/test_dataset.py
python ml/test_live.py
node src/Component/model/signRig.test.mjs
```

## Layout

```
src/       React front end (Vite)
ml/        landmarks, training, retargeting, realtime loop
server/    FastAPI websocket service
tools/     screenshot and rig-check helpers
data/      clips and features
```

## Credits

Dev Jaydeep Kulkarni · UI/UX Gaurav Mali

Sign data and reference motion from
[INCLUDE](https://zenodo.org/records/4010759) (CC-BY-4.0), AI4Bharat and IIIT-B.
Avatar rigged with Mixamo.
