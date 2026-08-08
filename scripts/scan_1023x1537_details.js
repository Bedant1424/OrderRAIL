import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function scanDetails() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  const localFileUri = 'file:///' + path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png').replace(/\\/g, '/');
  await page.goto(localFileUri);

  const scanData = await page.evaluate(() => {
    const img = document.querySelector('img');
    const w = img.naturalWidth; // 1023
    const h = img.naturalHeight; // 1537

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const centerX = Math.floor(w / 2); // 511

    // Scan vertical center column from Y: 200 to 1400 every 5px
    const yScan = [];
    for (let y = 200; y <= 1400; y += 10) {
      const [r, g, b] = ctx.getImageData(centerX, y, 1, 1).data;
      yScan.push({ y, r, g, b });
    }

    return { w, h, centerX, yScan };
  });

  console.log("NATIVE_1023x1537_SCAN:", JSON.stringify(scanData, null, 2));
  await browser.close();
}

scanDetails().catch(console.error);
