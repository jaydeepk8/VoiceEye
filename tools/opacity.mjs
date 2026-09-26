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
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.55));
await new Promise((r) => setTimeout(r, 2500));
const samples = [];
for (let i = 0; i < 10; i += 1) {
  samples.push(await page.evaluate(() => {
    const img = [...document.querySelectorAll("img")].find((n) => /assets\/images\/t\d/.test(n.src));
    if (!img) return null;
    const holder = img.closest("div")?.parentElement;
    return { slide: img.src.split("/").pop(), opacity: holder ? getComputedStyle(holder).opacity : "?" };
  }));
  await new Promise((r) => setTimeout(r, 900));
}
await browser.close();
const full = samples.filter((s) => s && Number(s.opacity) > 0.95).length;
console.log(JSON.stringify({ samples: samples.map((s) => s && `${s.slide}@${s.opacity}`), atFullOpacity: `${full}/${samples.length}` }, null, 1));
