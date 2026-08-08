import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';

function getFileHash(fp) {
  const buf = fs.readFileSync(fp);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function detailedInspection() {
  const origBurger = path.join(ROOT_DIR, 'branding', 'cheesecorner', 'assets', 'posters', 'poster-burger.jpg');
  const origFries = path.join(ROOT_DIR, 'branding', 'cheesecorner', 'assets', 'posters', 'poster-fries.jpg');
  const origMojito = path.join(ROOT_DIR, 'branding', 'cheesecorner', 'assets', 'posters', 'poster-mojito.jpg');

  const pubBurger = path.join(ROOT_DIR, 'public', 'branding', 'cheesecorner', 'posters', 'poster-burger.jpg');
  const pubFries = path.join(ROOT_DIR, 'public', 'branding', 'cheesecorner', 'posters', 'poster-fries.jpg');
  const pubMojito = path.join(ROOT_DIR, 'public', 'branding', 'cheesecorner', 'posters', 'poster-mojito.jpg');

  console.log("=== ORIGINAL ASSETS (branding/cheesecorner/assets/posters/) ===");
  console.log("poster-burger.jpg:");
  console.log("  Size:", fs.statSync(origBurger).size, "bytes");
  console.log("  SHA256:", getFileHash(origBurger));

  console.log("poster-fries.jpg:");
  console.log("  Size:", fs.statSync(origFries).size, "bytes");
  console.log("  SHA256:", getFileHash(origFries));

  console.log("poster-mojito.jpg:");
  console.log("  Size:", fs.statSync(origMojito).size, "bytes");
  console.log("  SHA256:", getFileHash(origMojito));

  console.log("\n=== RUNTIME ASSETS (public/branding/cheesecorner/posters/) ===");
  console.log("poster-burger.jpg:");
  console.log("  Size:", fs.statSync(pubBurger).size, "bytes");
  console.log("  SHA256:", getFileHash(pubBurger));

  console.log("poster-fries.jpg:");
  console.log("  Size:", fs.statSync(pubFries).size, "bytes");
  console.log("  SHA256:", getFileHash(pubFries));

  console.log("poster-mojito.jpg:");
  console.log("  Size:", fs.statSync(pubMojito).size, "bytes");
  console.log("  SHA256:", getFileHash(pubMojito));

  // Now let's inspect the actual visual contents of the images
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();

  const pairs = [
    { name: 'poster-burger.jpg', orig: origBurger, pub: pubBurger },
    { name: 'poster-fries.jpg', orig: origFries, pub: pubFries },
    { name: 'poster-mojito.jpg', orig: origMojito, pub: pubMojito },
  ];

  for (const pair of pairs) {
    console.log(`\n--- Visual Analysis for ${pair.name} ---`);
    await page.goto('file:///' + pair.orig.replace(/\\/g, '/'));
    const origData = await page.evaluate(() => {
      const img = document.querySelector('img');
      return { width: img.naturalWidth, height: img.naturalHeight };
    });

    await page.goto('file:///' + pair.pub.replace(/\\/g, '/'));
    const pubData = await page.evaluate(() => {
      const img = document.querySelector('img');
      return { width: img.naturalWidth, height: img.naturalHeight };
    });

    console.log(`Original: ${origData.width}x${origData.height}`);
    console.log(`Runtime: ${pubData.width}x${pubData.height}`);
  }

  await browser.close();
}

detailedInspection().catch(console.error);
