import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';
const OUTPUT_DIR = path.join(ROOT_DIR, 'sprint_8b_screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function captureSprint8BProof() {
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

  await page.evaluate(() => document.getElementById('about')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const deskHighlights = path.join(OUTPUT_DIR, 'desktop_01_lucide_about_highlights.png');
  await page.screenshot({ path: deskHighlights, fullPage: false });

  await page.evaluate(() => document.getElementById('categories')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const deskCategories = path.join(OUTPUT_DIR, 'desktop_02_lucide_categories_grid.png');
  await page.screenshot({ path: deskCategories, fullPage: false });

  // Mobile Pass (390x844)
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mobilePage.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  await mobilePage.evaluate(() => document.getElementById('categories')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const mobCategories = path.join(OUTPUT_DIR, 'mobile_01_lucide_categories.png');
  await mobilePage.screenshot({ path: mobCategories, fullPage: false });

  await browser.close();

  console.log("SPRINT_8B_PROOF_CAPTURED");
  console.log(JSON.stringify({
    desktop_highlights: deskHighlights,
    desktop_categories: deskCategories,
    mobile_categories: mobCategories
  }, null, 2));
}

captureSprint8BProof().catch(console.error);
