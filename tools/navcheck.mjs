import puppeteer from "puppeteer-core";
const base = process.argv[2];
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

const cases = [
  ["/Home", "Home", "/Home"],
  ["/Home", "ISL to Voice", "/Blind"],
  ["/Home", "Voice to ISL", "/Deaf"],
  ["/Blind", "Home", "/Home"],
  ["/Deaf", "ISL to Voice", "/Blind"],
];

const results = [];
for (const [from, label, expect] of cases) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(base + from, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));
  const clicked = await page.evaluate((text) => {
    const el = [...document.querySelectorAll("a, button, div")].find(
      (n) => n.textContent.trim() === text && n.children.length === 0,
    );
    if (!el) return false;
    el.click();
    return true;
  }, label);
  await new Promise((r) => setTimeout(r, 1800));
  const now = new URL(page.url()).pathname;
  const offsite = !page.url().startsWith(base);
  results.push({ from, label, clicked, got: now, expect, ok: clicked && now === expect && !offsite });
  await page.close();
}

const buttons = [];
for (const [label, expect] of [["Try Now", null]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(base + "/Home", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));
  const n = await page.evaluate(() =>
    [...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Try Now").length);
  for (let i = 0; i < n; i += 1) {
    await page.goto(base + "/Home", { waitUntil: "domcontentloaded", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2500));
    await page.evaluate((idx) => {
      [...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Try Now")[idx].click();
    }, i);
    await new Promise((r) => setTimeout(r, 1800));
    buttons.push({ button: `Try Now #${i + 1}`, got: new URL(page.url()).pathname });
  }
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ links: results, buttons }, null, 1));
