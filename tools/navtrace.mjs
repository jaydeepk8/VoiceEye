import puppeteer from "puppeteer-core";
const base = process.argv[2];
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const events = [];
page.on("pageerror", (e) => events.push({ type: "pageerror", msg: e.message, stack: (e.stack || "").split("\n").slice(0, 6) }));
page.on("console", (m) => { if (m.type() === "error") events.push({ type: "console", msg: m.text().slice(0, 300) }); });

await page.goto(base + "/Home", { waitUntil: "domcontentloaded", timeout: 90000 });
await new Promise((r) => setTimeout(r, 3500));
events.push({ type: "mark", msg: "--- loaded /Home, now clicking Voice to ISL ---" });
await page.evaluate(() => {
  [...document.querySelectorAll("a")].find((n) => n.textContent.trim() === "Voice to ISL").click();
});
await new Promise((r) => setTimeout(r, 6000));
const state = await page.evaluate(() => ({
  path: location.pathname,
  canvases: document.querySelectorAll("canvas").length,
  rootKids: document.getElementById("root")?.children.length,
  bodyText: document.body.innerText.slice(0, 100).replace(/\n+/g, " | "),
}));
await browser.close();
console.log(JSON.stringify({ state, events }, null, 1));
