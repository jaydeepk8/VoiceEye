# VoiceEye

If one person is deaf and the other is blind, they have no easy way to talk to
each other. Signing needs eyes, speaking needs ears. VoiceEye sits in the middle
and translates both ways.

**Sign to voice** — you sign at your camera, the site says the word out loud.

**Voice to sign** — you speak or type, and a 3D avatar signs it back.

Live at [voice-eye.vercel.app](https://voice-eye.vercel.app). It knows nine
Indian Sign Language words: hello, thank you, how are you, pleased, alright, and
good morning / afternoon / evening / night.

This is a working rebuild of the system described in *VoiceEye: A Communication
Aid Between a Voiceless and Sightless* (ICCUBEA 2024,
[doi](https://doi.org/10.1109/ICCUBEA61740.2024.10775052)).

## Sign to voice

Your browser finds the position of your hands and body with MediaPipe and sends
those points to a small server. The server turns them into a fixed-size
description of the pose, feeds a sliding window of 45 frames to a GRU, and sends
back a word. The page speaks it.

Two details that took a while to get right.

Only the browser touches the camera, and it sends numbers rather than pictures —
about 4.9KB a frame instead of a 10KB JPEG. The server's share of the work fell
from 3.4 seconds per 50 frames to 0.09, which was the difference between 2.5 and
9 frames a second on a free Render instance.

Knowing *when* a sign happened is harder than knowing which one it was. The model
has an opinion thirty times a second, so `live.py` only speaks when the hands are
actually moving, the model is confident, it has said the same thing several
frames running, and it has not just spoken. Without that it babbles.

## Voice to sign

The avatar performs the signs, but nobody animated them by hand. The motion is
lifted from the same INCLUDE recordings the recogniser learned from, so both
halves of the bridge speak the same nine words.

`sign_motion.py` reads the source videos and `retarget.py` turns each frame into
a set of bone directions. The browser already has the skeleton, so turning a
direction into a rotation is a few lines there rather than a reimplementation of
three.js here. Directions are also easy to check — a wrong one is a number you
can read.

Four things were wrong before it looked like signing rather than a puppet.

MediaPipe's 3D positions are unreliable for this. They put the wrist 2cm above
the shoulder where the video plainly shows 17cm. The flat image positions are
accurate, so those give x and y, and depth comes from how foreshortened each limb
looks compared with its real length.

Hand points and body points use different axes. The same finger measured both
ways disagreed by more than 100 degrees.

MediaPipe's left and right hand labels are mirrored for this footage, so each
hand now goes to whichever wrist it is actually next to.

A direction tells a bone where to point but not how it is twisted, which left
elbows bending sideways and palms facing the wrong way. The shoulder-elbow-wrist
plane fixes the arm, the knuckle line fixes the hand.

Between signs the avatar stands still, breathes, glances around and blinks. The
standing pose comes from how the signers in the dataset stand before they begin,
so moving into a sign never jumps.

## How well does it work

Nine words, 189 clips, scored by holding out a whole recording session and
training from scratch on the rest.

| Vocabulary | Accuracy |
|---|---|
| 5 words | 0.917 |
| 9 words | 0.671 |

Chance is 0.20 and 0.11. For comparison, published results on the full
[INCLUDE](https://zenodo.org/records/4010759) benchmark are 94.5% on its 50-word
subset and 85.6% across all 263 words.

**Read that 0.671 carefully.** INCLUDE does not record who signed each clip, so
the sessions are inferred from camera numbering in the filenames. Holding one out
is harder than a random split, but it is a recording source rather than a person
anyone can name. Until somebody outside the dataset signs at it, treat every
number here as a floor.

Two ways these figures could have been flattering, both avoided. Splitting the
clips at random instead of by session scores a perfect 1.000, because INCLUDE's
takes are near-identical and the same take ends up on both sides. And keeping the
best epoch as judged by the test set adds about 13 points that do not survive
contact with new data.

What actually helped, measured rather than guessed: dropping MediaPipe's depth
from the features and widening the window from 30 frames to 45 took the five-word
score from 0.730 to 0.917.

Where it fails is consistent. The four time-of-day greetings get confused with
each other, since they share a "good" component and the model cannot separate
what follows it. Hello, thank you, how are you and pleased are the reliable ones.

## Running it

Python 3.12 exactly. MediaPipe publishes no 3.13 wheels and NumPy 2.5 needs at
least 3.12, so the window is one version wide.

```
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
python ml/download_models.py
npm install
npm run dev
```

The site talks to a server at `VITE_SIGN_SERVER`, deployed on Render as a
container. It cannot run on Vercel or Netlify — both are serverless, and a
WebSocket needs something that stays awake. The server runs the model through
ONNX rather than torch, which keeps the image small enough for a free instance.
`export_onnx.py` converts a checkpoint and checks it against the torch version
before writing it.

```
python ml/train.py --epochs 30       # train
python ml/ablate.py                  # compare settings, cross-validated
python ml/live.py                    # webcam to console, no browser
python ml/evaluate.py --signer you   # score against a held-out person
```

## Recording your own clips

This is the one thing the project still needs. Every clip in `data/` came from
INCLUDE, and someone from outside it has to sign at the camera before the
accuracy figures mean what they appear to mean.

You do not need to know ISL to do it. Watch the avatar perform a sign on the
Voice to ISL page, copy it, record it.

```
python ml/record_session.py --signer yourname
python ml/evaluate.py --signer yourname
```

Eight clips a word takes about an hour. Vary things as you go — lighting,
distance, clothes, different days. Eight identical takes teach it far less than
eight different ones. Expect the score to drop, and note that the drop is the
finding.

## Checking changes

3D is hard to fix by guessing, so there are tools for looking at it instead.

```
node tools/snap.mjs http://localhost:5173 hello 0.3,0.9,1.5 out
python tools/source_frames.py hello 0.3,0.9,1.5 out
python tools/montage.py out 0.3,0.9,1.5 compare.png
node tools/rigcheck.mjs public/aniavatar.glb public/signs/hello.motion.json 0.9
```

The first three put the avatar beside the real signer at the same moment. The
last measures the angle between where each bone ended up and where the clip asked
it to be; all nine signs land within 0.0 degrees. Add `?debug=1` to the Voice to
ISL page for a live readout.

```
python ml/test_landmarks.py
python ml/test_dataset.py
python ml/test_live.py
node src/Component/model/signRig.test.mjs
```

## Layout

```
src/       React front end (Vite)
ml/        landmark extraction, training, retargeting, real-time loop
server/    FastAPI WebSocket inference service
tools/     screenshot and rig-checking helpers
data/      clips and features
```

## Credits

Dev Jaydeep Kulkarni · UI/UX Gaurav Mali

Sign data and reference motion from the
[INCLUDE dataset](https://zenodo.org/records/4010759) (CC-BY-4.0), AI4Bharat and
IIIT-B. Avatar rigged with Mixamo.
