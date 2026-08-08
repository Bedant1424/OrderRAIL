import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';

function getSHA256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function getFileSize(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stats = fs.statSync(filePath);
  return stats.size;
}

// Search for all instances of poster images across the entire directory
function findFilesByName(dir, fileNames, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findFilesByName(fullPath, fileNames, results);
    } else if (fileNames.includes(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

async function inspectImagesWithPuppeteer(filePaths) {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  const details = {};

  for (const fp of filePaths) {
    if (!fs.existsSync(fp)) continue;
    const fileUrl = 'file:///' + fp.replace(/\\/g, '/');
    await page.goto(fileUrl);

    const info = await page.evaluate(() => {
      const img = document.querySelector('img');
      if (!img) return null;

      // Draw to canvas to sample colors & evaluate visual content
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Sample center, corners, top, bottom
      const centerPixel = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
      const topLeftPixel = ctx.getImageData(10, 10, 1, 1).data;
      
      return {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(3),
        centerRgb: `rgb(${centerPixel[0]}, ${centerPixel[1]}, ${centerPixel[2]})`,
        topLeftRgb: `rgb(${topLeftPixel[0]}, ${topLeftPixel[1]}, ${topLeftPixel[2]})`,
      };
    });

    details[fp] = info;
  }

  await browser.close();
  return details;
}

async function runInvestigation() {
  console.log("=== SPRINT 7L HERO ASSET FORENSICS INVESTIGATION ===");

  const targetNames = ['poster-burger.jpg', 'poster-fries.jpg', 'poster-mojito.jpg'];

  // 1. Search Repo for all occurrences
  console.log("\n--- ITEM 7: REPOSITORY SEARCH FOR POSTER FILES ---");
  const foundFiles = findFilesByName(ROOT_DIR, targetNames);
  foundFiles.forEach(f => console.log(`Found: ${f}`));

  // Check public folder
  const publicDir = path.join(ROOT_DIR, 'public', 'branding', 'cheesecorner', 'posters');
  const originalAssetDir = path.join(ROOT_DIR, 'branding', 'cheesecorner', 'assets', 'posters');
  const srcAssetDir = path.join(ROOT_DIR, 'src', 'branding', 'cheesecorner', 'posters');
  
  console.log("\n--- ITEM 1, 2, 3: FILE METADATA & SHA256 HASHES ---");
  const allPathsToInspect = [
    ...foundFiles,
    path.join(publicDir, 'poster-burger.jpg'),
    path.join(publicDir, 'poster-fries.jpg'),
    path.join(publicDir, 'poster-mojito.jpg'),
    path.join(originalAssetDir, 'poster-burger.jpg'),
    path.join(originalAssetDir, 'poster-fries.jpg'),
    path.join(originalAssetDir, 'poster-mojito.jpg'),
  ];
  const uniquePaths = [...new Set(allPathsToInspect)];

  const metadata = {};
  for (const fp of uniquePaths) {
    const exists = fs.existsSync(fp);
    if (exists) {
      metadata[fp] = {
        exists: true,
        sizeBytes: getFileSize(fp),
        sha256: getSHA256(fp),
      };
    } else {
      metadata[fp] = { exists: false };
    }
  }

  // Puppeteer inspection for dimensions
  const imageDetails = await inspectImagesWithPuppeteer(uniquePaths.filter(p => fs.existsSync(p)));
  for (const fp in imageDetails) {
    if (metadata[fp]) {
      metadata[fp] = { ...metadata[fp], ...imageDetails[fp] };
    }
  }

  console.log(JSON.stringify(metadata, null, 2));

  // 6. Check Git History
  console.log("\n--- ITEM 6: GIT HISTORY INSPECTION ---");
  targetNames.forEach(name => {
    try {
      const gitLog = execSync(`git log --follow --stat --oneline -- "public/branding/cheesecorner/posters/${name}"`, { cwd: ROOT_DIR }).toString();
      console.log(`\nGit History for public/.../${name}:\n${gitLog}`);
    } catch (e) {
      console.log(`Error checking git log for ${name}:`, e.message);
    }
  });

  // Check all commits touching cheesecorner posters
  try {
    const gitLogAll = execSync(`git log --stat --oneline --grep="Sprint 7" --grep="optimize" --grep="poster" --grep="image"`, { cwd: ROOT_DIR }).toString();
    console.log(`\nGit History matching optimization/sprint:\n${gitLogAll}`);
  } catch (e) {
    console.log("Error checking general git log:", e.message);
  }
}

runInvestigation().catch(console.error);
