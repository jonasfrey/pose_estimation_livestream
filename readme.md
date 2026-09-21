# Pose Studio

A small webcam web app that draws a live pose skeleton over your video. It uses
**MoveNet SinglePose Lightning**, the lightweight 192 × 192 MoveNet variant,
with 17 body keypoints and temporal smoothing. The model's weights are about 4.5
MB. Inference runs locally in your browser with TensorFlow.js, using WebGL when
available and CPU otherwise. No video is recorded or uploaded.

## Run

Install [Deno 2](https://deno.com/) if needed, then from this directory:

```sh
deno task run
```

Open **http://localhost:8787**, click **Enable camera**, and grant camera
access. The first run downloads pinned browser libraries and model files to
`.cache/`. Subsequent runs use those local files and work without internet. No
npm install, Python environment, API key, or GPU setup is required.

Use a modern browser with webcam support, preferably Chrome or Edge. Stand back
so your body is visible in good lighting. Lightning tracks **one person**; it
provides 2D body keypoints, not hand/finger tracking or 3D motion capture.

- Toggle mirroring, skeleton lines, and keypoints independently.
- Adjust the confidence threshold to hide less certain detections.
- View inference FPS, inference latency, and the visible keypoint count.
- **Stop camera** releases the webcam; leaving the page also stops it.
- Inference pauses while the tab is hidden. The camera stays open until stopped.

The server listens only on the local computer. Cameras require localhost or
HTTPS; opening the HTML directly or using an insecure remote address will not
work. To use another port:

```sh
PORT=9000 deno task run
```

If permission is denied, allow the camera in the browser's site settings and
retry. If the webcam is busy, close other camera apps. On download errors, check
your connection and rerun the command; completed files are reused. Delete
`.cache/` to force fresh downloads if cached files become damaged.

## Development

```sh
deno task check
deno task test
```

`server.ts` downloads assets and serves an explicit allowlist of public files.
`public/app.js` manages the webcam and inference lifecycle. `public/pose.js`
renders confident keypoints and their connections at the video's native
resolution, with video and overlay mirrored together.

Browser smoke tests (optional, Playwright installed separately):

```sh
npm install --no-save --package-lock=false playwright
node tests/browser_smoke.mjs
```

Keep the app running first. The test uses system Google Chrome and a simulated
webcam; it exercises real model inference, controls, restart, and permission
errors. Set `CHROME_PATH`, `APP_URL`, or `PLAYWRIGHT_PATH` to override defaults.

## Model and dependencies

- [MoveNet documentation](https://github.com/tensorflow/tfjs-models/tree/master/pose-detection/src/movenet)
- [MoveNet Lightning v4 model](https://www.kaggle.com/models/google/movenet/tfJs/singlepose-lightning/4)
- TensorFlow.js 4.22.0 and pose-detection 2.1.3, fetched from jsDelivr.

The upstream model and libraries are Apache-2.0 licensed. Their license notices
remain in the downloaded artifacts. Downloads happen server-side at startup; the
browser requests all app and inference assets from localhost.
