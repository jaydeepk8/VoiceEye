import puppeteer from "puppeteer-core";

const [, , base, word, times, out] = process.argv;
const moments = (times || "0.5").split(",");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--window-size=700,900",
  ],
});

const shots = [];
for (const t of moments) {
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 900, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/Deaf?sign=${word}&t=${t}&debug=1`, {
    waitUntil: "networkidle0",
    timeout: 180000,
  });
  await page.waitForFunction(
    () => /clip=\w+/.test(document.body.innerText),
    { timeout: 180000 },
  );
  await new Promise((r) => setTimeout(r, 2500));
  const file = `${out}_${t.replace(".", "p")}.png`;
  const [cx, cy, cw, ch] = (process.env.CLIP || '120,90,460,560').split(',').map(Number);
  await page.screenshot({ path: file, clip: { x: cx, y: cy, width: cw, height: ch } });
  const debug = await page.evaluate(() =>
    [...document.querySelectorAll("div")]
      .map((d) => d.innerText)
      .find((s) => /rig=/.test(s || "")) || "",
  );
  shots.push({ t, file, debug: debug.split("\n")[0], errors });
  await page.close();
}

await browser.close();
console.log(JSON.stringify(shots, null, 1));
