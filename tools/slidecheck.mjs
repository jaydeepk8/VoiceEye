import puppeteer from "puppeteer-core";
const base = process.argv[2];
const out = process.argv[3];
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 850 });
await page.goto(base + "/Home", { waitUntil: "domcontentloaded", timeout: 90000 });
await new Promise((r) => setTimeout(r, 3000));
await page.evaluate(() => {
  const el = [...document.querySelectorAll("div")].find((d) => /What is VoiceEye/.test(d.textContent) && d.querySelector("img"));
  (el || document.body).scrollIntoView({ block: "center" });
  window.scrollTo(0, document.body.scrollHeight * 0.55);
});
await new Promise((r) => setTimeout(r, 1500));

const geom = await page.evaluate(() => {
  const marquee = [...document.querySelectorAll("div")].find((d) => d.textContent.trim().startsWith("What is VoiceEye") && d.children.length > 100);
  const box = [...document.querySelectorAll("div")].find((d) => getComputedStyle(d).backgroundImage.includes("linear-gradient") && d.getBoundingClientRect().width > 500);
  const m = marquee?.getBoundingClientRect();
  const b = box?.getBoundingClientRect();
  return {
    marqueeBottom: m ? Math.round(m.bottom) : null,
    boxTop: b ? Math.round(b.top) : null,
    gap: m && b ? Math.round(b.top - m.bottom) : null,
  };
});

const seen = [];
for (let i = 0; i < 14; i += 1) {
  const src = await page.evaluate(() => {
    const img = [...document.querySelectorAll("img")].find((n) => /assets\/images\/t\d/.test(n.src));
    return img ? img.src.split("/").pop() : null;
  });
  if (src && seen[seen.length - 1] !== src) seen.push(src);
  await new Promise((r) => setTimeout(r, 1500));
}
await page.screenshot({ path: out });
await browser.close();
console.log(JSON.stringify({ geom, slidesSeen: seen }, null, 1));
