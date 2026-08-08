import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';
const OUTPUT_DIR = path.join(ROOT_DIR, 'sprint_8f_screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function captureSprint8FProof() {
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

  await page.evaluate(() => document.getElementById('why-choose')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const deskWhy = path.join(OUTPUT_DIR, 'desktop_02_why_choose.png');
  await page.screenshot({ path: deskWhy, fullPage: false });

  await page.evaluate(() => document.getElementById('specials')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const deskSpecials = path.join(OUTPUT_DIR, 'desktop_03_chefs_specials.png');
  await page.screenshot({ path: deskSpecials, fullPage: false });

  await page.evaluate(() => document.getElementById('menu')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const deskMenu = path.join(OUTPUT_DIR, 'desktop_04_menu.png');
  await page.screenshot({ path: deskMenu, fullPage: false });

  await page.evaluate(() => document.getElementById('qr-ordering')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const deskQr = path.join(OUTPUT_DIR, 'desktop_05_qr_ordering.png');
  await page.screenshot({ path: deskQr, fullPage: false });

  await page.evaluate(() => document.getElementById('gallery')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const deskGallery = path.join(OUTPUT_DIR, 'desktop_06_gallery.png');
  await page.screenshot({ path: deskGallery, fullPage: false });

  await page.evaluate(() => document.getElementById('contact')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const deskContact = path.join(OUTPUT_DIR, 'desktop_07_location.png');
  await page.screenshot({ path: deskContact, fullPage: false });

  // Mobile Pass (390x844)
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mobilePage.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  await mobilePage.evaluate(() => document.getElementById('qr-ordering')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 500));
  const mobQr = path.join(OUTPUT_DIR, 'mobile_01_qr_ordering.png');
  await mobilePage.screenshot({ path: mobQr, fullPage: false });

  await browser.close();

  console.log("SPRINT_8F_PROOF_CAPTURED");
  console.log(JSON.stringify({
    desktop_hero: deskHero,
    desktop_why: deskWhy,
    desktop_specials: deskSpecials,
    desktop_menu: deskMenu,
    desktop_qr: deskQr,
    desktop_gallery: deskGallery,
    desktop_contact: deskContact,
    mobile_qr: mobQr
  }, null, 2));
}

captureSprint8FProof().catch(console.error);
