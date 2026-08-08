import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';

async function analyzeVisualContent() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();

  const files = [
    { type: 'ORIGINAL', label: 'poster-burger.jpg', path: path.join(ROOT_DIR, 'branding', 'cheesecorner', 'assets', 'posters', 'poster-burger.jpg') },
    { type: 'RUNTIME', label: 'poster-burger.jpg', path: path.join(ROOT_DIR, 'public', 'branding', 'cheesecorner', 'posters', 'poster-burger.jpg') },
    { type: 'ORIGINAL', label: 'poster-fries.jpg', path: path.join(ROOT_DIR, 'branding', 'cheesecorner', 'assets', 'posters', 'poster-fries.jpg') },
    { type: 'RUNTIME', label: 'poster-fries.jpg', path: path.join(ROOT_DIR, 'public', 'branding', 'cheesecorner', 'posters', 'poster-fries.jpg') },
    { type: 'ORIGINAL', label: 'poster-mojito.jpg', path: path.join(ROOT_DIR, 'branding', 'cheesecorner', 'assets', 'posters', 'poster-mojito.jpg') },
    { type: 'RUNTIME', label: 'poster-mojito.jpg', path: path.join(ROOT_DIR, 'public', 'branding', 'cheesecorner', 'posters', 'poster-mojito.jpg') },
  ];

  for (const item of files) {
    const fileUrl = 'file:///' + item.path.replace(/\\/g, '/');
    await page.goto(fileUrl);

    const desc = await page.evaluate(() => {
      const img = document.querySelector('img');
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Grid color sampling across 9 sectors
      const grid = [];
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          const pxX = Math.floor((x + 0.5) * (canvas.width / 3));
          const pxY = Math.floor((y + 0.5) * (canvas.height / 3));
          const data = ctx.getImageData(pxX, pxY, 1, 1).data;
          grid.push(`(${x},${y}):[${data[0]},${data[1]},${data[2]}]`);
        }
      }

      return {
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(3),
        gridColors: grid.join(' | ')
      };
    });

    console.log(`[${item.type}] ${item.label} (${desc.width}x${desc.height}, AR: ${desc.aspectRatio}):`);
    console.log(`  Color Grid: ${desc.gridColors}`);
  }

  await browser.close();
}

analyzeVisualContent().catch(console.error);
