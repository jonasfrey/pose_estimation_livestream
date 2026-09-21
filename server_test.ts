import { handler } from "./server.ts";
import { drawPose, visiblePoints } from "./public/pose.js";
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
Deno.test("serves the app and rejects private files and unsupported methods", async () => {
  const response = await handler(new Request("http://localhost/"));
  assert(response.status === 200);
  assert(response.headers.get("content-type")?.includes("text/html"));
  assert((await response.text()).includes('id="video"'));
  for (
    const path of [
      "/.cache/model.json",
      "/server.ts",
      "/readme.md",
      "/assets/../server.ts",
      "/assets/unknown.bin",
    ]
  ) {
    const result = await handler(new Request(`http://localhost${path}`));
    assert(result.status === 404, path);
    await result.body?.cancel();
  }
  const post = await handler(
    new Request("http://localhost/", { method: "POST" }),
  );
  assert(post.status === 405);
  await post.body?.cancel();
  const head = await handler(
    new Request("http://localhost/app.js", { method: "HEAD" }),
  );
  assert(head.status === 200 && await head.text() === "");
});
Deno.test("overlay excludes uncertain and invalid points and respects toggles", () => {
  const points = [{ x: 10, y: 20, score: .9 }, { x: 30, y: 40, score: .2 }, {
    x: 50,
    y: 60,
    score: .8,
  }, { x: NaN, y: 1, score: 1 }];
  assert(visiblePoints(points, .3).length === 2);
  let lines = 0, circles = 0;
  const ctx = {
    beginPath() {},
    moveTo() {},
    lineTo() {
      lines++;
    },
    stroke() {},
    fill() {},
    arc() {
      circles++;
    },
    lineWidth: 0,
    lineCap: "",
    strokeStyle: "",
    fillStyle: "",
  };
  assert(drawPose(ctx, points, .3, true, true) === 2);
  assert(lines === 1 && circles === 2);
  drawPose(ctx, points, .3, false, false);
  assert(lines === 1 && circles === 2);
  assert(drawPose(ctx, [], .3, true, true) === 0);
});
