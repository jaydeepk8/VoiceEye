import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 780 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
await page.goto(process.argv[2] + "/Home", { waitUntil: "domcontentloaded", timeout: 90000 });
await new Promise((r) => setTimeout(r, 4000));
const info = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Try Now");
  const section = btn?.closest("div")?.parentElement;
  return {
    top: section ? Math.round(section.getBoundingClientRect().top + window.scrollY) : null,
    subtitlePresent: /This ISL is used/.test(document.body.innerText),
    tryNowCount: [...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Try Now").length,
  };
});
if (info.top !== null) {
  await page.screenshot({ path: process.argv[3], captureBeyondViewport: true, clip: { x: 0, y: info.top, width: 1280, height: 740 } });
}
await browser.close();
console.log(JSON.stringify({ ...info, errors }, null, 1));
