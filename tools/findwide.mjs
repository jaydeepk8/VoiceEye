import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
await page.goto(process.argv[2], { waitUntil: "domcontentloaded", timeout: 90000 });
await new Promise((r) => setTimeout(r, 3500));
const wide = await page.evaluate(() => {
  const vw = window.innerWidth;
  return [...document.querySelectorAll("*")]
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, cls: String(el.className).slice(0, 28), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) };
    })
    .filter((e) => e.right > vw + 1 || e.left < -1)
    .slice(0, 8);
});
await browser.close();
console.log(JSON.stringify(wide, null, 1));
