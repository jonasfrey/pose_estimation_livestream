const cache = new URL("./.cache/", import.meta.url);
const publicDir = new URL("./public/", import.meta.url);
const modelBase =
  "https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4/";
const assets: Record<string, string> = {
  "tf.min.js":
    "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js",
  "pose-detection.min.js":
    "https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js",
};

async function download(name: string, url: string) {
  const target = new URL(name, cache);
  try {
    if ((await Deno.stat(target)).size > 0) return;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  console.log(`Downloading ${name}…`);
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`${name}: empty download`);
  if (name.endsWith(".json")) JSON.parse(new TextDecoder().decode(bytes));
  await Deno.writeFile(new URL(`${name}.part`, cache), bytes);
  await Deno.rename(new URL(`${name}.part`, cache), target);
}

export async function setup() {
  await Deno.mkdir(cache, { recursive: true });
  await Promise.all(
    Object.entries(assets).map(([name, url]) => download(name, url)),
  );
  await download("model.json", `${modelBase}model.json?tfjs-format=file`);
  const model = JSON.parse(
    await Deno.readTextFile(new URL("model.json", cache)),
  );
  for (const group of model.weightsManifest) {
    for (const name of group.paths) {
      if (!/^group\d+-shard\d+of\d+\.bin$/.test(name)) {
        throw new Error("Unexpected model weight path");
      }
      await download(name, `${modelBase}${name}?tfjs-format=file`);
    }
  }
}

const mime: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json",
  bin: "application/octet-stream",
};
export async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  const path = new URL(request.url).pathname;
  const isAsset =
    /^\/assets\/(tf\.min\.js|pose-detection\.min\.js|model\.json|group\d+-shard\d+of\d+\.bin)$/
      .test(path);
  const file = path === "/" ? "index.html" : path.slice(1);
  if (
    !isAsset && !["index.html", "app.js", "style.css", "pose.js"].includes(file)
  ) return new Response("Not found", { status: 404 });
  try {
    const data = await Deno.readFile(
      new URL(isAsset ? path.slice(8) : file, isAsset ? cache : publicDir),
    );
    return new Response(request.method === "HEAD" ? null : data, {
      headers: {
        "content-type": mime[file.split(".").pop()!] ??
          "application/octet-stream",
        "x-content-type-options": "nosniff",
        "cache-control": isAsset ? "public, max-age=86400" : "no-cache",
        "permissions-policy": "camera=(self), microphone=()",
      },
    });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return new Response("Not found", { status: 404 });
    }
    console.error(error);
    return new Response("Unable to read file", { status: 500 });
  }
}

if (import.meta.main) {
  try {
    const port = Number(Deno.env.get("PORT") || 8000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("PORT must be between 1 and 65535");
    }
    await setup();
    Deno.serve({ hostname: "127.0.0.1", port }, handler);
    console.log(`Pose Studio is ready → http://localhost:${port}`);
  } catch (error) {
    console.error(
      "Startup failed:",
      error instanceof Error ? error.message : error,
    );
    console.error(
      "Check your internet connection and run deno task run again. Completed downloads are cached.",
    );
    Deno.exit(1);
  }
}
