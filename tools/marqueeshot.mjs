import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 850 });
await page.goto(process.argv[2] + "/Home", { waitUntil: "domcontentloaded", timeout: 90000 });
await new Promise((r) => setTimeout(r, 4000));
const offsets = await page.evaluate(() => {
  const box = [...document.querySelectorAll("div")].find(
    (d) => getComputedStyle(d).backgroundImage.includes("linear-gradient") && d.getBoundingClientRect().width > 500);
  const section = box.parentElement;
  const top = section.getBoundingClientRect().top + window.scrollY;
  return { sectionTop: Math.round(top) };
});
await page.screenshot({ path: process.argv[3], captureBeyondViewport: true,
  clip: { x: 0, y: offsets.sectionTop, width: 1440, height: 380 } });
await browser.close();
console.log(JSON.stringify(offsets));
