import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import puppeteer from 'puppeteer-core';
import https from 'https';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';

function getFileStats(filePath) {
  const stats = fs.statSync(filePath);
  const buf = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  return { size: stats.size, hash };
}

function getAllImages(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllImages(fullPath, results);
    } else if (/\.(jpg|jpeg|png|webp|svg)$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

async function getUrlHeaders(url) {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
      });
    });
    req.on('error', (err) => resolve({ error: err.message }));
    req.end();
  });
}

async function runSprint7M() {
  console.log("=== SPRINT 7M FORENSICS & ASSET AUDIT ===");

  // 1. Inventory of all images under branding/cheesecorner and public/branding/cheesecorner
  const brandingDir = path.join(ROOT_DIR, 'branding', 'cheesecorner');
  const publicBrandingDir = path.join(ROOT_DIR, 'public', 'branding', 'cheesecorner');

  const allImagePaths = [
    ...getAllImages(brandingDir),
    ...getAllImages(publicBrandingDir)
  ];

  console.log(`Found ${allImagePaths.length} image files across branding directories.\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();

  const inventory = [];

  for (const imgPath of allImagePaths) {
    const relativePath = path.relative(ROOT_DIR, imgPath).replace(/\\/g, '/');
    const folder = path.dirname(relativePath);
    const filename = path.basename(imgPath);
    const { size, hash } = getFileStats(imgPath);

    const fileUrl = 'file:///' + imgPath.replace(/\\/g, '/');
    let width = 0, height = 0, orientation = 'unknown', aspectRatio = 0;

    try {
      await page.goto(fileUrl);
      const dimensions = await page.evaluate(() => {
        const img = document.querySelector('img');
        return img ? { width: img.naturalWidth, height: img.naturalHeight } : { width: 0, height: 0 };
      });
      width = dimensions.width;
      height = dimensions.height;
      if (width > 0 && height > 0) {
        aspectRatio = parseFloat((width / height).toFixed(3));
        if (aspectRatio > 1.1) orientation = 'landscape';
        else if (aspectRatio < 0.9) orientation = 'portrait';
        else orientation = 'square';
      }
    } catch (e) {
      // SVG or non-img
    }

    // Determine suitability
    let suitability = [];
    if (orientation === 'landscape' && (width >= 1200 || folder.includes('posters') || folder.includes('menu'))) {
      suitability.push('Hero Carousel');
    }
    if (folder.includes('items') || folder.includes('posters') || folder.includes('gallery')) {
      suitability.push('Gallery');
    }
    if (folder.includes('menu') || folder.includes('items')) {
      suitability.push('Menu Item');
    }
    if (filename.includes('logo') || filename.includes('qr')) {
      suitability.push('Branding/QR');
    }
    if (suitability.length === 0) suitability.push('General Asset');

    inventory.push({
      filename,
      folder,
      relativePath,
      dimensions: `${width}×${height}`,
      width,
      height,
      sizeBytes: size,
      sizeKb: (size / 1024).toFixed(1) + ' KB',
      orientation,
      aspectRatio,
      hash,
      suitability: suitability.join(', ')
    });
  }

  await browser.close();

  // Save inventory to JSON
  fs.writeFileSync(
    path.join(ROOT_DIR, 'scripts', 'image_inventory.json'),
    JSON.stringify(inventory, null, 2)
  );

  console.log("Image inventory generated successfully!");

  // 2. Production URL check
  console.log("\n=== PRODUCTION NETWORK & HEADER INVESTIGATION ===");
  const prodUrls = [
    'https://cheese-corner.vercel.app/branding/cheesecorner/posters/poster-burger.jpg',
    'https://cheese-corner.vercel.app/branding/cheesecorner/posters/poster-fries.jpg',
    'https://cheese-corner.vercel.app/branding/cheesecorner/posters/poster-mojito.jpg',
  ];

  for (const pUrl of prodUrls) {
    const res = await getUrlHeaders(pUrl);
    console.log(`\nURL: ${pUrl}`);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, JSON.stringify(res.headers, null, 2));
  }
}

runSprint7M().catch(console.error);
