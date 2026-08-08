import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';
const OUTPUT_DIR = path.join(ROOT_DIR, 'sprint_9_screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const BREAKPOINTS = [
  { name: '320px', width: 320, height: 600 },
  { name: '375px', width: 375, height: 812 },
  { name: '390px', width: 390, height: 844 },
  { name: '430px', width: 430, height: 932 },
  { name: '768px', width: 768, height: 1024 }
];

async function captureSprint9Proof() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox']
  });

  const captured = {};

  for (const bp of BREAKPOINTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: bp.width, height: bp.height, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    // Check horizontal overflow
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(`Breakpoint ${bp.name} - Horizontal Overflow: ${overflow}`);

    const heroPic = path.join(OUTPUT_DIR, `mobile_${bp.name}_01_hero.png`);
    await page.screenshot({ path: heroPic, fullPage: false });

    await page.evaluate(() => document.getElementById('qr-ordering')?.scrollIntoView({ block: 'start' }));
    await new Promise(r => setTimeout(r, 500));
    const qrPic = path.join(OUTPUT_DIR, `mobile_${bp.name}_02_qr_ordering.png`);
    await page.screenshot({ path: qrPic, fullPage: false });

    await page.evaluate(() => document.getElementById('menu')?.scrollIntoView({ block: 'start' }));
    await new Promise(r => setTimeout(r, 500));
    const menuPic = path.join(OUTPUT_DIR, `mobile_${bp.name}_03_menu.png`);
    await page.screenshot({ path: menuPic, fullPage: false });

    captured[bp.name] = { hero: heroPic, qr: qrPic, menu: menuPic, overflow };
    await page.close();
  }

  await browser.close();

  console.log("SPRINT_9_PROOF_CAPTURED");
  console.log(JSON.stringify(captured, null, 2));
}

captureSprint9Proof().catch(console.error);
