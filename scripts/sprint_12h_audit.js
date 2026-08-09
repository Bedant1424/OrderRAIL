import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function auditTemplate() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  const templatePath = path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png');
  const localFileUri = 'file:///' + templatePath.replace(/\\/g, '/');
  await page.goto(localFileUri);

  const result = await page.evaluate(() => {
    const img = document.querySelector('img');
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const centerX = Math.floor(w / 2);

    // Scan vertical line at centerX across all Y
    const colData = [];
    for (let y = 0; y < h; y += 5) {
      const [r, g, b, a] = ctx.getImageData(centerX, y, 1, 1).data;
      colData.push({ y, r, g, b, hex: '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('') });
    }

    return { w, h, centerX, colData };
  });

  console.log(`Template native size: ${result.w} x ${result.h}, centerX: ${result.centerX}`);
  
  // Find regions along vertical line:
  console.log("\n--- Vertical Profile at CenterX ---");
  let prevColor = "";
  for (const p of result.colData) {
    const cat = p.r > 240 && p.g > 240 && p.b > 240 ? "WHITE"
      : p.r > 220 && p.g > 200 && p.b > 150 ? "CREAM"
      : p.r > 200 && p.g < 100 ? "RED/ORANGE"
      : p.r < 50 && p.g < 50 && p.b < 50 ? "DARK/BROWN"
      : p.r > 200 && p.g > 150 && p.b < 80 ? "YELLOW/CHEESE"
      : `RGB(${p.r},${p.g},${p.b})`;
    
    if (cat !== prevColor) {
      console.log(`Y: ${p.y} -> ${cat} (${p.hex})`);
      prevColor = cat;
    }
  }

  await browser.close();
}

auditTemplate().catch(console.error);
