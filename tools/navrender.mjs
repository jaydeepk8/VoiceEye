import puppeteer from "puppeteer-core";
const base = process.argv[2];
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 800 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));

await page.goto(base + "/Home", { waitUntil: "domcontentloaded", timeout: 90000 });
await new Promise((r) => setTimeout(r, 3000));
const underline = await page.evaluate(() => {
  const logo = [...document.querySelectorAll("a")].find((a) => a.textContent.trim() === "VoiceEye");
  const nav = [...document.querySelectorAll("a")].find((a) => a.textContent.trim() === "Home");
  return {
    logo: logo ? getComputedStyle(logo).textDecorationLine : "not found",
    navLink: nav ? getComputedStyle(nav).textDecorationLine : "not found",
  };
});
await page.evaluate(() => {
  [...document.querySelectorAll("a")].find((n) => n.textContent.trim() === "Voice to ISL").click();
});
await new Promise((r) => setTimeout(r, 9000));
await page.screenshot({ path: process.argv[3] || "out.png" });
const canvas = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  return c ? { size: `${c.width}x${c.height}`, hasGL: !!(c.getContext("webgl2") || c.getContext("webgl")) } : null;
});
await browser.close();
console.log(JSON.stringify({ underline, path: "/Deaf", canvas, errors }, null, 1));
