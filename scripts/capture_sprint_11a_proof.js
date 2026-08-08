import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';
const OUTPUT_DIR = path.join(ROOT_DIR, 'sprint_11a_screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function captureSprint11AProof() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox']
  });

  // Desktop Pass (1440x900)
  const deskPage = await browser.newPage();
  await deskPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await deskPage.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  await deskPage.evaluate(() => document.getElementById('qr-ordering')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 600));
  const deskQr = path.join(OUTPUT_DIR, 'desktop_01_qr_ordering_section.png');
  await deskPage.screenshot({ path: deskQr, fullPage: false });

  // Open Modal
  await deskPage.evaluate(() => {
    const btn = document.querySelector('header button');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  const deskModal = path.join(OUTPUT_DIR, 'desktop_02_ordering_modal.png');
  await deskPage.screenshot({ path: deskModal, fullPage: false });
  await deskPage.close();

  // Mobile Pass (390x844)
  const mobPage = await browser.newPage();
  await mobPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mobPage.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  await mobPage.evaluate(() => document.getElementById('qr-ordering')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 600));
  const mobQr = path.join(OUTPUT_DIR, 'mobile_01_qr_ordering_section.png');
  await mobPage.screenshot({ path: mobQr, fullPage: false });

  await mobPage.evaluate(() => {
    const btn = document.querySelector('header button');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  const mobModal = path.join(OUTPUT_DIR, 'mobile_02_ordering_modal.png');
  await mobPage.screenshot({ path: mobModal, fullPage: false });

  await browser.close();

  console.log("SPRINT_11A_PROOF_CAPTURED");
  console.log(JSON.stringify({
    desktop_qr_section: deskQr,
    desktop_modal: deskModal,
    mobile_qr_section: mobQr,
    mobile_modal: mobModal
  }, null, 2));
}

captureSprint11AProof().catch(console.error);
