import puppeteer from "puppeteer-core";

const [, , base, out, gapArg, countArg] = process.argv;
const gap = Number(gapArg || 2000);
const count = Number(countArg || 3);

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.setViewport({ width: 700, height: 900, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${base}/Deaf?debug=1`, { waitUntil: "networkidle0", timeout: 180000 });
await page.waitForFunction(() => /clip=none/.test(document.body.innerText), { timeout: 180000 });
await new Promise((r) => setTimeout(r, 1500));

const files = [];
for (let i = 0; i < count; i += 1) {
  const file = `${out}_${i}.png`;
  await page.screenshot({ path: file, clip: { x: 170, y: 250, width: 360, height: 470 } });
  files.push(file);
  await new Promise((r) => setTimeout(r, gap));
}
const debug = await page.evaluate(() => (document.body.innerText.match(/rig=[^\n]*/) || [""])[0]);
await browser.close();
console.log(JSON.stringify({ files, debug, errors }, null, 1));
