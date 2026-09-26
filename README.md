# VoiceEye

If someone is deaf and someone else is blind, they can't really talk to each
other. One can't hear, the other can't see the signs. VoiceEye tries to fix
that by translating both ways.

- **Sign to voice**: sign in front of your camera, it speaks the word.
- **Voice to sign**: say or type something, an avatar signs it back to you.

Live here: [voice-eye.vercel.app](https://voice-eye.vercel.app). Right now it
knows 9 ISL words - hello, thank you, how are you, pleased, alright, and good
morning / afternoon / evening / night.

This is a rebuild of a project from a 2024 paper we published,
*VoiceEye: A Communication Aid Between a Voiceless and Sightless*
([link](https://doi.org/10.1109/ICCUBEA61740.2024.10775052)). The paper version
never actually worked end to end. This one does.

## Sign to voice

Your camera feeds MediaPipe in the browser, which tracks your hands and body.
Those points get sent to a small Python server. The server does some math on
them and feeds a window of frames into a GRU model, which guesses the word.
Browser speaks it out loud.

We send just the tracked points, not the video itself. Way less data, and it
means the server barely has to do any work - went from taking 3.4 seconds to
process 50 frames down to 0.09 seconds. On the free hosting we're using that's
the difference between the thing being usable and not.

The annoying part wasn't recognizing signs, it was figuring out when someone
actually finished a sign. The model spits out a guess constantly, so if you
don't filter that it just talks nonsense the whole time. Had to add checks -
are the hands even moving, is it confident, has it said the same word a few
times in a row, did it already just say something. Fixed the babbling.

## Voice to sign

Nobody sat down and animated the avatar doing each sign. We took the same
video clips we trained the recognizer on and copied the motion from those onto
the 3D model.

Scripts do the actual work - one pulls landmark data out of the source videos,
another converts that into rotations for the avatar's bones. Wasn't as simple
as it sounds though, ran into a bunch of problems getting it to look right
instead of like a broken puppet:

- MediaPipe's depth estimate is just bad for this. It thought a raised wrist
  was barely above the shoulder when the video shows it clearly way higher. Had
  to calculate depth ourselves based on how much shorter a limb looks when it's
  angled toward the camera.
- The hand tracking and body tracking use different coordinate systems, so
  combining them directly gave garbage - like the same finger pointing two
  completely different directions depending which one you trusted.
- MediaPipe also mixed up left and right hands in this footage, so we had to
  match hands to wrists ourselves instead of trusting its labels.
- Even after fixing direction, the arm could still be twisted weird, palm
  facing backwards etc, because a direction alone doesn't tell you rotation.
  Had to lock that down using the elbow and knuckle positions.

When it's not signing anything it just stands there, but not frozen - it
breathes a little, looks around, blinks sometimes. Made it feel less dead.

## How accurate is it

Trained and tested on 189 clips across 9 words. Tested properly too - held out
an entire recording session and trained on everything else, not just a random
split of the same footage.

| Words | Accuracy |
|---|---|
| 5 | 91.7% |
| 9 | 67.1% |

Random guessing would get 20% and 11% respectively. For reference, the actual
research dataset we're using ([INCLUDE](https://zenodo.org/records/4010759))
gets 94.5% on a curated 50-word set and 85.6% across all 263 words in
published papers.

Being honest about that 67% number though - the dataset doesn't tell you who
signed which clip, so we had to guess which clips came from the same person
based on how the video files were numbered. It's better than a random split
but we still can't say for sure these are different people. Real proof needs
someone new signing who wasn't in the training data at all.

Also caught ourselves almost cheating on this by accident twice. If you split
clips randomly instead of by session, you get basically 100% accuracy, because
the same take of a video ends up split between train and test. And if you let
the model pick its best-performing epoch based on the test set, you gain like
13 points that mean nothing on new data. Avoided both.

One real improvement that mattered - stripped out the depth values MediaPipe
gives us (too noisy) and made the model look at longer chunks of video, 45
frames instead of 30. That alone took the 5-word accuracy from 73% to 91.7%.

Where it messes up is predictable. The four "good ___" signs get confused with
each other constantly since they all start the same way. Hello, thank you, how
are you, and pleased work reliably.

## Running it locally

Needs Python 3.12 specifically. MediaPipe doesn't have builds for 3.13 yet and
newer numpy won't run on anything older than 3.12.

```
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
python ml/download_models.py
npm install
npm run dev
```

Frontend talks to a server address set in `VITE_SIGN_SERVER`. We host that on
Render since it needs to stay running for the websocket connection - can't do
that on Vercel or Netlify. Also swapped torch out for ONNX on the server so it
fits in a free instance's memory limit.

```
python ml/train.py --epochs 30       # train the model
python ml/ablate.py                  # compare different settings properly
python ml/live.py                    # test with your webcam, no browser needed
python ml/evaluate.py --signer you   # check accuracy on someone new
```

## Adding your own recordings

This is the thing we still need to do. Right now every clip is from the
dataset, nobody's actually recorded themselves for testing. Until someone does
that, the accuracy numbers above aren't fully trustworthy.

Good news is you don't need to already know ISL. Just watch the avatar do a
sign on the site and copy it.

```
python ml/record_session.py --signer yourname
python ml/evaluate.py --signer yourname
```

About an hour to do 8 clips per word. Try to actually vary things while
recording - different lighting, distance from camera, what you're wearing,
maybe do it across a couple days instead of all at once. If every clip looks
identical the model doesn't really learn anything new from having 8 of them.
Expect the score to drop when you test with real recordings, that's normal and
expected.

## Checking that changes actually work

3D stuff is hard to debug just by staring at code, so there's tooling to
compare visually:

```
node tools/snap.mjs http://localhost:5173 hello 0.3,0.9,1.5 out
python tools/source_frames.py hello 0.3,0.9,1.5 out
python tools/montage.py out 0.3,0.9,1.5 compare.png
node tools/rigcheck.mjs public/aniavatar.glb public/signs/hello.motion.json 0.9
```

First three grab a screenshot of the avatar and the original video at the same
moment so you can eyeball them side by side. Last one is more precise - checks
the actual angle between where a bone ended up versus where it should be.
Right now every sign comes out to basically 0 degrees off. You can also add
`?debug=1` to the sign page URL to see live numbers while it's running.

```
python ml/test_landmarks.py
python ml/test_dataset.py
python ml/test_live.py
node src/Component/model/signRig.test.mjs
```

## Project structure

```
src/       React frontend (Vite)
ml/        landmark extraction, training, motion retargeting, live recognition
server/    the websocket server (FastAPI)
tools/     scripts for screenshotting and checking the rig
data/      video clips and extracted features
```

## Credits

Built by Jaydeep Kulkarni, UI/UX by Gaurav Mali.

Sign videos and motion reference come from
[INCLUDE](https://zenodo.org/records/4010759) (CC-BY-4.0), made by AI4Bharat
and IIIT-B. Avatar model rigged in Mixamo.
