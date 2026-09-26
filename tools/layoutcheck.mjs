import puppeteer from "puppeteer-core";
const base = process.argv[2];
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 850 });
await page.goto(base + "/Blind", { waitUntil: "domcontentloaded", timeout: 90000 });
await new Promise((r) => setTimeout(r, 3500));
const blind = await page.evaluate(() => {
  const header = document.querySelector("div")?.closest("div");
  const hdr = [...document.querySelectorAll("div")].find((d) => d.textContent.trim().startsWith("VoiceEye") && d.querySelector("a"));
  const video = document.querySelector("video");
  const stage = video?.parentElement;
  const hb = hdr?.getBoundingClientRect();
  const sb = stage?.getBoundingClientRect();
  return {
    headerBottom: hb ? Math.round(hb.bottom) : null,
    cameraTop: sb ? Math.round(sb.top) : null,
    gap: hb && sb ? Math.round(sb.top - hb.bottom) : null,
    navLabels: [...document.querySelectorAll("a")].map((a) => a.textContent.trim()),
  };
});
await page.screenshot({ path: process.argv[3] });
await browser.close();
console.log(JSON.stringify(blind, null, 1));
