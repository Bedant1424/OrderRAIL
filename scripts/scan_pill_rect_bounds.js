import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function scanPillRect() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  const localFileUri = 'file:///' + path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png').replace(/\\/g, '/');
  await page.goto(localFileUri);

  const gridData = await page.evaluate(() => {
    const img = document.querySelector('img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; // 784
    canvas.height = img.naturalHeight; // 1360
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Let's sample a grid in the top card region: X: 200 to 584, Y: 250 to 500
    const matches = [];
    for (let y = 250; y <= 500; y += 5) {
      for (let x = 200; x <= 584; x += 5) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        // White or near white rectangle (r > 245, g > 240, b > 230)
        if (r > 245 && g > 240 && b > 230) {
          matches.push({ x, y, r, g, b });
        }
      }
    }

    if (matches.length === 0) return { count: 0 };

    let minX = 1000, maxX = 0, minY = 1000, maxY = 0;
    matches.forEach(m => {
      if (m.x < minX) minX = m.x;
      if (m.x > maxX) maxX = m.x;
      if (m.y < minY) minY = m.y;
      if (m.y > maxY) maxY = m.y;
    });

    return {
      count: matches.length,
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  });

  console.log("WHITE_PILL_GRID_DATA:", JSON.stringify(gridData, null, 2));
  await browser.close();
}

scanPillRect().catch(console.error);
