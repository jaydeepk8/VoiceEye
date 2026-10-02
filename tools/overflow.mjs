import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const out = [];
for (const [w, h] of [[360, 780], [390, 844], [430, 932], [1280, 800]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  await page.goto(process.argv[2] + "/Deaf", { waitUntil: "domcontentloaded", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 3500));
  const r = await page.evaluate(() => {
    const input = document.querySelector("input");
    const bar = input?.parentElement;
    const b = bar?.getBoundingClientRect();
    return {
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
      barRight: b ? Math.round(b.right) : null,
      viewport: window.innerWidth,
      fits: b ? b.right <= window.innerWidth + 1 && b.left >= -1 : null,
    };
  });
  out.push({ size: `${w}x${h}`, ...r });
  await page.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
