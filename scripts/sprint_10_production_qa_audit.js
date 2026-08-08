import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';
const OUTPUT_DIR = path.join(ROOT_DIR, 'sprint_10_production_screenshots');
const PROD_URL = 'https://cheese-corner.vercel.app';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const DESKTOP_VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 }
];

const MOBILE_VIEWPORTS = [
  { name: '320px', width: 320, height: 600 },
  { name: '360px', width: 360, height: 780 },
  { name: '375px', width: 375, height: 812 },
  { name: '390px', width: 390, height: 844 },
  { name: '430px', width: 430, height: 932 }
];

async function runProductionQA() {
  console.log(`Starting Sprint 10 Production QA Audit for ${PROD_URL}...`);
  
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox']
  });

  const auditResults = {
    consoleErrors: [],
    networkFailures: [],
    accessibility: {},
    performance: {},
    responsiveOverflow: {},
    screenshots: {}
  };

  // 1. Desktop QA Pass (1440x900 main capture + accessibility check)
  const deskPage = await browser.newPage();
  
  deskPage.on('console', msg => {
    if (msg.type() === 'error') {
      auditResults.consoleErrors.push(msg.text());
    }
  });

  deskPage.on('requestfailed', request => {
    auditResults.networkFailures.push(`${request.url()} (${request.failure()?.errorText})`);
  });

  await deskPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await deskPage.goto(PROD_URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  // Capture Desktop Section Screenshots
  const deskHero = path.join(OUTPUT_DIR, 'desktop_1440_01_hero.png');
  await deskPage.screenshot({ path: deskHero, fullPage: false });

  await deskPage.evaluate(() => document.getElementById('why-choose')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 600));
  const deskWhy = path.join(OUTPUT_DIR, 'desktop_1440_02_why_choose.png');
  await deskPage.screenshot({ path: deskWhy, fullPage: false });

  await deskPage.evaluate(() => document.getElementById('specials')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 600));
  const deskSpecials = path.join(OUTPUT_DIR, 'desktop_1440_03_chefs_specials.png');
  await deskPage.screenshot({ path: deskSpecials, fullPage: false });

  await deskPage.evaluate(() => document.getElementById('menu')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 600));
  const deskMenu = path.join(OUTPUT_DIR, 'desktop_1440_04_menu.png');
  await deskPage.screenshot({ path: deskMenu, fullPage: false });

  await deskPage.evaluate(() => document.getElementById('qr-ordering')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 600));
  const deskQr = path.join(OUTPUT_DIR, 'desktop_1440_05_qr_ordering.png');
  await deskPage.screenshot({ path: deskQr, fullPage: false });

  await deskPage.evaluate(() => document.getElementById('gallery')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 600));
  const deskGallery = path.join(OUTPUT_DIR, 'desktop_1440_06_gallery.png');
  await deskPage.screenshot({ path: deskGallery, fullPage: false });

  await deskPage.evaluate(() => document.getElementById('contact')?.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 600));
  const deskContact = path.join(OUTPUT_DIR, 'desktop_1440_07_location.png');
  await deskPage.screenshot({ path: deskContact, fullPage: false });

  // Run Accessibility & DOM Audit
  const a11yAudit = await deskPage.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img'));
    const missingAlt = images.filter(img => !img.alt || img.alt.trim() === '').map(img => img.src);
    
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const smallTargets = buttons.filter(b => {
      const rect = b.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (rect.width < 40 || rect.height < 40);
    }).map(b => ({ tag: b.tagName, text: b.innerText.trim() || b.getAttribute('aria-label') }));

    const unlabelledButtons = buttons.filter(b => {
      const text = b.innerText.trim();
      const ariaLabel = b.getAttribute('aria-label');
      const title = b.getAttribute('title');
      return !text && !ariaLabel && !title;
    }).map(b => b.outerHTML.substring(0, 100));

    return {
      totalImages: images.length,
      missingAltCount: missingAlt.length,
      missingAltSamples: missingAlt.slice(0, 5),
      totalInteractive: buttons.length,
      smallTargetsCount: smallTargets.length,
      smallTargetsSamples: smallTargets.slice(0, 5),
      unlabelledButtonsCount: unlabelledButtons.length,
      unlabelledButtonsSamples: unlabelledButtons
    };
  });

  auditResults.accessibility = a11yAudit;
  await deskPage.close();

  // 2. Mobile Viewports QA Pass
  for (const mobVP of MOBILE_VIEWPORTS) {
    const mobPage = await browser.newPage();
    await mobPage.setViewport({ width: mobVP.width, height: mobVP.height, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await mobPage.goto(PROD_URL, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const overflow = await mobPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    auditResults.responsiveOverflow[mobVP.name] = overflow;

    const mobHero = path.join(OUTPUT_DIR, `mobile_${mobVP.name}_01_hero.png`);
    await mobPage.screenshot({ path: mobHero, fullPage: false });

    await mobPage.evaluate(() => document.getElementById('qr-ordering')?.scrollIntoView({ block: 'start' }));
    await new Promise(r => setTimeout(r, 500));
    const mobQr = path.join(OUTPUT_DIR, `mobile_${mobVP.name}_02_qr_ordering.png`);
    await mobPage.screenshot({ path: mobQr, fullPage: false });

    await mobPage.close();
  }

  await browser.close();

  console.log("SPRINT_10_QA_AUDIT_COMPLETE");
  console.log(JSON.stringify(auditResults, null, 2));
}

runProductionQA().catch(console.error);
