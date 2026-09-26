import puppeteer from "puppeteer-core";
const base = process.argv[2];
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

async function canvasState(page) {
  return page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return { canvas: false };
    let lit = 0;
    try {
      const t = document.createElement("canvas");
      t.width = 120; t.height = 90;
      t.getContext("2d").drawImage(c, 0, 0, 120, 90);
      const d = t.getContext("2d").getImageData(0, 0, 120, 90).data;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 40 || d[i+1] > 40 || d[i+2] > 55) lit += 1;
    } catch (e) { return { canvas: true, err: e.message }; }
    return { canvas: true, size: `${c.width}x${c.height}`, litPixels: lit };
  });
}

const errors = [];
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));

await page.goto(base + "/Deaf", { waitUntil: "domcontentloaded", timeout: 90000 });
await new Promise((r) => setTimeout(r, 6000));
const direct = await canvasState(page);

await page.evaluate(() => {
  const el = [...document.querySelectorAll("a")].find((n) => n.textContent.trim() === "Home");
  el.click();
});
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => {
  const el = [...document.querySelectorAll("a")].find((n) => n.textContent.trim() === "Voice to ISL");
  el.click();
});
await new Promise((r) => setTimeout(r, 6000));
const afterNav = await canvasState(page);

await browser.close();
console.log(JSON.stringify({ direct, afterNav, errors: errors.slice(0, 4) }, null, 1));
