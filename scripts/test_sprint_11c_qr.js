import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';
const OUTPUT_DIR = path.join(ROOT_DIR, 'sprint_11c_screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function testQRCompositing() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/owner/tables', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  const pageTitle = await page.title();
  console.log("PAGE_TITLE:", pageTitle);
  
  await browser.close();
}

testQRCompositing().catch(console.error);
