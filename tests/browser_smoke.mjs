import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const external = [];
  const url = process.env.APP_URL || "http://localhost:8787";
  page.on("request", (r) => {
    if (!r.url().startsWith(url)) external.push(r.url());
  });
  await page.goto(url);
  await page.screenshot({
    path: "/tmp/pose-studio-desktop.png",
    fullPage: true,
  });
  await page.click("#start");
  await page.waitForFunction(
    () => document.querySelector("#latency").textContent !== "—",
    null,
    { timeout: 120000 },
  );
  assert.equal(await page.locator("#status").textContent(), "Camera live");
  assert.equal(await page.locator("#error").isVisible(), false);
  await page.uncheck("#mirror");
  assert.equal(
    await page.locator("#stage").evaluate((e) =>
      e.classList.contains("mirrored")
    ),
    false,
  );
  await page.uncheck("#skeleton");
  await page.uncheck("#joints");
  await page.locator("#confidence").fill("0.55");
  assert.equal(await page.locator("#confidence-value").textContent(), "0.55");
  await page.evaluate(() => {
    globalThis.testTrack =
      document.querySelector("video").srcObject.getTracks()[0];
  });
  await page.click("#stop");
  assert.equal(
    await page.evaluate(() => globalThis.testTrack.readyState),
    "ended",
  );
  assert.equal(await page.locator("#status").textContent(), "Camera off");
  await page.click("#start");
  await page.waitForFunction(() =>
    document.querySelector("#latency").textContent !== "—"
  );
  await page.click("#stop");
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("Denied", "NotAllowedError"));
  });
  await page.click("#start");
  await page.waitForSelector("#error", { state: "visible" });
  assert.match(await page.locator("#error").textContent(), /denied/);
  assert.equal(await page.locator("#start").isEnabled(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/pose-studio-mobile.png",
    fullPage: true,
  });
  assert(
    await page.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth
    ),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    "PASS: real inference, controls, camera release/restart, permission error, mobile layout, local-only requests",
  );
} finally {
  await browser.close();
}
