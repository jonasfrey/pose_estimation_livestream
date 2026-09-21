import { drawPose } from "./pose.js";

const $ = (id) => document.getElementById(id);
const video = $("video"), canvas = $("overlay"), ctx = canvas.getContext("2d");
let detector, stream, running = false, generation = 0, frame = 0;
let lastFrame = 0, lastVideoTime = -1, smoothedFps = 0;

function status(text, active = false) {
  $("status").textContent = text;
  $("status-dot").style.background = active ? "#c4f277" : "#82917e";
}
function stop() {
  generation++;
  running = false;
  cancelAnimationFrame(frame);
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  $("stage").style.removeProperty("aspect-ratio");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  $("empty").hidden = false;
  $("view-label").hidden = true;
  $("start").disabled = false;
  $("start").innerHTML = "Enable camera <span>↗</span>";
  $("stop").disabled = true;
  $("fps").textContent = $("latency").textContent = "—";
  $("points").textContent = "0";
  $("meter-fill").style.width = "0%";
  $("tracking").textContent = "Ready when you are";
  status("Camera off");
}
function fail(error) {
  console.error(error);
  stop();
  const messages = {
    NotAllowedError:
      "Camera access was denied. Allow camera access in your browser’s site settings, then try again.",
    NotFoundError: "No camera found. Connect a webcam, then try again.",
    NotReadableError:
      "Your camera could not be opened. Close other apps using it, then try again.",
  };
  $("error").textContent = messages[error.name] ||
    `Could not start pose tracking: ${error.message}. Please try again.`;
  $("error").hidden = false;
  status("Attention needed");
}
let pendingInference = Promise.resolve();
async function start() {
  const session = ++generation;
  $("error").hidden = true;
  $("start").disabled = true;
  $("start").textContent = "Starting…";
  $("stop").disabled = false;
  try {
    if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Camera access requires localhost or HTTPS in a supported browser",
      );
    }
    status("Waiting for camera permission…");
    const acquired = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    });
    if (session !== generation) {
      acquired.getTracks().forEach((t) => t.stop());
      return;
    }
    stream = acquired;
    stream.getVideoTracks()[0].addEventListener("ended", () => {
      if (session === generation) {
        fail(new Error("The camera was disconnected"));
      }
    });
    video.srcObject = stream;
    await video.play();
    if (session !== generation) return;
    status("Loading pose model…");
    await pendingInference;
    if (session !== generation) return;
    if (!detector) {
      if (!globalThis.tf || !globalThis.poseDetection) {
        throw new Error(
          "The local inference libraries did not load. Reload the page",
        );
      }
      try {
        if (!await globalThis.tf.setBackend("webgl")) {
          throw new Error("WebGL unavailable");
        }
      } catch {
        await globalThis.tf.setBackend("cpu");
      }
      await globalThis.tf.ready();
      const loaded = await globalThis.poseDetection.createDetector(
        globalThis.poseDetection.SupportedModels.MoveNet,
        {
          modelType:
            globalThis.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          modelUrl: "/assets/model.json",
          enableSmoothing: true,
        },
      );
      if (session !== generation) {
        loaded.dispose();
        return;
      }
      detector = loaded;
    }
    if (session !== generation) return;
    detector.reset();
    $("backend").textContent = `MoveNet Lightning · ${
      globalThis.tf.getBackend() === "webgl"
        ? "WebGL acceleration"
        : "CPU processing"
    }`;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    $("stage").style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    $("empty").hidden = true;
    $("view-label").hidden = false;
    lastFrame = 0;
    lastVideoTime = -1;
    smoothedFps = 0;
    running = true;
    status("Camera live", true);
    tick(session);
  } catch (error) {
    if (session === generation) fail(error);
  }
}
async function tick(session) {
  if (!running || session !== generation) return;
  if (
    !document.hidden && video.readyState >= 2 &&
    lastVideoTime !== video.currentTime
  ) {
    lastVideoTime = video.currentTime;
    try {
      const begin = performance.now();
      pendingInference = detector.estimatePoses(video, {
        flipHorizontal: false,
      });
      const poses = await pendingInference;
      if (!running || session !== generation) return;
      const end = performance.now();
      const fps = lastFrame ? 1000 / (end - lastFrame) : 0;
      smoothedFps = smoothedFps ? smoothedFps * .8 + fps * .2 : fps;
      lastFrame = end;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const count = drawPose(
        ctx,
        poses[0]?.keypoints || [],
        Number($("confidence").value),
        $("skeleton").checked,
        $("joints").checked,
      );
      $("points").textContent = count;
      $("meter-fill").style.width = `${count / 17 * 100}%`;
      $("latency").textContent = Math.round(end - begin);
      $("fps").textContent = smoothedFps ? Math.round(smoothedFps) : "—";
      $("tracking").textContent = count
        ? "Tracking your movement"
        : "Step into view · keep your whole body visible";
    } catch (error) {
      pendingInference = Promise.resolve();
      if (session === generation) {
        detector?.dispose();
        detector = null;
        fail(error);
      }
      return;
    }
  } else if (document.hidden) lastFrame = 0;
  frame = requestAnimationFrame(() => tick(session));
}
$("start").addEventListener("click", start);
$("stop").addEventListener("click", stop);
$("mirror").addEventListener(
  "change",
  () => $("stage").classList.toggle("mirrored", $("mirror").checked),
);
$("stage").classList.add("mirrored");
$("confidence").addEventListener("input", () => {
  $("confidence-value").value = Number($("confidence").value).toFixed(2);
});
globalThis.addEventListener("pagehide", stop);
