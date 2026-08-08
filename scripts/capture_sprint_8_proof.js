import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';
const OUTPUT_DIR = path.join(ROOT_DIR, 'sprint_8_screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function captureSprint8Proof() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox']
  });

  // 1. Desktop Pass (1440x900)
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // Desktop Screenshots
  const deskHero = path.join(OUTPUT_DIR, 'desktop_01_hero_refined.png');
  await page.screenshot({ path: deskHero, fullPage: false });

  await page.evaluate(() => document.getElementById('experience')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const deskExp = path.join(OUTPUT_DIR, 'desktop_02_culinary_experience.png');
  await page.screenshot({ path: deskExp, fullPage: false });

  await page.evaluate(() => document.getElementById('menu-preview')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const deskMenu = path.join(OUTPUT_DIR, 'desktop_03_menu_preview_redesigned.png');
  await page.screenshot({ path: deskMenu, fullPage: false });

  await page.evaluate(() => document.getElementById('gallery')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const deskGallery = path.join(OUTPUT_DIR, 'desktop_04_signature_showcase.png');
  await page.screenshot({ path: deskGallery, fullPage: false });

  // 2. Mobile Pass (390x844 - iPhone 12/13/14 format)
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mobilePage.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  const mobHero = path.join(OUTPUT_DIR, 'mobile_01_hero.png');
  await mobilePage.screenshot({ path: mobHero, fullPage: false });

  await mobilePage.evaluate(() => document.getElementById('menu-preview')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const mobMenu = path.join(OUTPUT_DIR, 'mobile_02_menu_cards.png');
  await mobilePage.screenshot({ path: mobMenu, fullPage: false });

  await mobilePage.evaluate(() => document.getElementById('gallery')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const mobGallery = path.join(OUTPUT_DIR, 'mobile_03_gallery.png');
  await mobilePage.screenshot({ path: mobGallery, fullPage: false });

  await browser.close();

  console.log("SPRINT_8_PROOF_CAPTURED");
  console.log(JSON.stringify({
    desktop_hero: deskHero,
    desktop_experience: deskExp,
    desktop_menu: deskMenu,
    desktop_gallery: deskGallery,
    mobile_hero: mobHero,
    mobile_menu: mobMenu,
    mobile_gallery: mobGallery
  }, null, 2));
}

captureSprint8Proof().catch(console.error);
