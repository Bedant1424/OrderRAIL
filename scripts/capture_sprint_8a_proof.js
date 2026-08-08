import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';
const OUTPUT_DIR = path.join(ROOT_DIR, 'sprint_8a_screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function captureSprint8AProof() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox']
  });

  // Desktop Pass (1440x900)
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  const deskHero = path.join(OUTPUT_DIR, 'desktop_01_hero.png');
  await page.screenshot({ path: deskHero, fullPage: false });

  await page.evaluate(() => document.getElementById('recommendations')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const deskRec = path.join(OUTPUT_DIR, 'desktop_02_chefs_recommendations.png');
  await page.screenshot({ path: deskRec, fullPage: false });

  await page.evaluate(() => document.getElementById('fresh-kitchen')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const deskKitchen = path.join(OUTPUT_DIR, 'desktop_03_signature_dishes.png');
  await page.screenshot({ path: deskKitchen, fullPage: false });

  // Mobile Pass (390x844)
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mobilePage.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  await mobilePage.evaluate(() => document.getElementById('recommendations')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const mobRec = path.join(OUTPUT_DIR, 'mobile_01_chefs_recommendations.png');
  await mobilePage.screenshot({ path: mobRec, fullPage: false });

  await mobilePage.evaluate(() => document.getElementById('fresh-kitchen')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const mobKitchen = path.join(OUTPUT_DIR, 'mobile_02_signature_dishes.png');
  await mobilePage.screenshot({ path: mobKitchen, fullPage: false });

  await browser.close();

  console.log("SPRINT_8A_PROOF_CAPTURED");
  console.log(JSON.stringify({
    desktop_hero: deskHero,
    desktop_recommendations: deskRec,
    desktop_kitchen: deskKitchen,
    mobile_recommendations: mobRec,
    mobile_kitchen: mobKitchen
  }, null, 2));
}

captureSprint8AProof().catch(console.error);
