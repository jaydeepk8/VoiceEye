import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 850 });
await page.goto(process.argv[2] + "/Home", { waitUntil: "domcontentloaded", timeout: 90000 });
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => {
  const box = [...document.querySelectorAll("div")].find(
    (d) => getComputedStyle(d).backgroundImage.includes("linear-gradient") && d.getBoundingClientRect().width > 500);
  const section = box?.parentElement;
  section?.scrollIntoView({ block: "start" });
});
await new Promise((r) => setTimeout(r, 1800));
const m = await page.evaluate(() => {
  const marquee = [...document.querySelectorAll("div")].find((d) => d.textContent.trim().startsWith("What is VoiceEye") && d.children.length > 100);
  const box = [...document.querySelectorAll("div")].find((d) => getComputedStyle(d).backgroundImage.includes("linear-gradient") && d.getBoundingClientRect().width > 500);
  const section = box?.parentElement;
  const t = marquee.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const s = section.getBoundingClientRect();
  const above = Math.round(t.top - s.top);
  const below = Math.round(b.top - t.bottom);
  return { sectionTop: Math.round(s.top), textTop: Math.round(t.top), textBottom: Math.round(t.bottom), boxTop: Math.round(b.top), spaceAbove: above, spaceBelow: below, balanced: Math.abs(above - below) < 25 };
});
await page.screenshot({ path: process.argv[3], clip: { x: 0, y: 0, width: 1440, height: 400 } });
await browser.close();
console.log(JSON.stringify(m, null, 1));
