import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function measure197MbTemplate() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  const localFileUri = 'file:///' + path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png').replace(/\\/g, '/');
  await page.goto(localFileUri);

  const measurements = await page.evaluate(() => {
    const img = document.querySelector('img');
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // 1. Scan for White Rounded Rectangle (for Table Number) in Y: 300 to 600
    // Pure white or bright cream (R > 245, G > 240, B > 230)
    const whitePixels = [];
    for (let y = 300; y < 650; y += 2) {
      for (let x = 100; x < w - 100; x += 2) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        if (r > 245 && g > 240 && b > 230) {
          whitePixels.push({ x, y });
        }
      }
    }

    let numPill = null;
    if (whitePixels.length > 0) {
      let minX = w, maxX = 0, minY = h, maxY = 0;
      whitePixels.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      numPill = {
        minX, maxX, minY, maxY,
        width: maxX - minX,
        height: maxY - minY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
      };
    }

    // 2. Scan for Cream QR Box in Y: 600 to 1200
    const creamPixels = [];
    for (let y = 600; y < 1250; y += 2) {
      for (let x = 100; x < w - 100; x += 2) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        // Cream box color
        if (r > 230 && g > 210 && b > 160 && r - b < 90) {
          creamPixels.push({ x, y });
        }
      }
    }

    let qrBox = null;
    if (creamPixels.length > 0) {
      let minX = w, maxX = 0, minY = h, maxY = 0;
      creamPixels.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      qrBox = {
        minX, maxX, minY, maxY,
        width: maxX - minX,
        height: maxY - minY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
      };
    }

    return {
      nativeWidth: w,
      nativeHeight: h,
      numPill,
      qrBox
    };
  });

  console.log("197MB_TEMPLATE_MEASUREMENTS:", JSON.stringify(measurements, null, 2));
  await browser.close();
}

measure197MbTemplate().catch(console.error);
