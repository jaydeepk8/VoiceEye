import puppeteer from "puppeteer-core";
const [, , url, out, w, h] = process.argv;
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.setViewport({ width: Number(w || 1280), height: Number(h || 800) });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
await new Promise((r) => setTimeout(r, 3500));
await page.screenshot({ path: out });
const info = await page.evaluate(() => ({
  scrollH: document.body.scrollHeight,
  overflowX: document.documentElement.scrollWidth > window.innerWidth,
  text: document.body.innerText.slice(0, 160).replace(/\n+/g, " | "),
}));
await browser.close();
console.log(JSON.stringify({ url, ...info, errors }, null, 1));
