import puppeteer from "puppeteer-core";
const [, , base, seconds] = process.argv;
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.setViewport({ width: 700, height: 900 });
await page.goto(`${base}/Deaf?debug=1`, { waitUntil: "networkidle0", timeout: 180000 });
await page.waitForFunction(() => /blinks=/.test(document.body.innerText), { timeout: 180000 });
await new Promise((r) => setTimeout(r, Number(seconds) * 1000));
console.log(await page.evaluate(() => (document.body.innerText.match(/rig=[^\n]*/) || [""])[0]));
await browser.close();
