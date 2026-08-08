import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';
const OUTPUT_DIR = path.join(ROOT_DIR, 'sprint_7m_screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function captureSprint7MProof() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--window-size=1440,1100']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // 1. Hero Showcase Screenshot
  const heroPath = path.join(OUTPUT_DIR, 'hero_showcase_upgraded.png');
  await page.screenshot({ path: heroPath, fullPage: false });

  // 2. Scroll to Signature Gallery & take screenshot
  await page.evaluate(() => {
    const el = document.getElementById('gallery');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise(r => setTimeout(r, 600));

  const galleryPath = path.join(OUTPUT_DIR, 'signature_gallery_upgraded.png');
  await page.screenshot({ path: galleryPath, fullPage: false });

  await browser.close();

  console.log("SPRINT_7M_PROOF_CAPTURED");
  console.log(JSON.stringify({
    hero_showcase_upgraded: heroPath,
    signature_gallery_upgraded: galleryPath
  }, null, 2));
}

captureSprint7MProof().catch(console.error);
