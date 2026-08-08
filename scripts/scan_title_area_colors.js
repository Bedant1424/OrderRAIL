import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function scanTitleArea() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  const localFileUri = 'file:///' + path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png').replace(/\\/g, '/');
  await page.goto(localFileUri);

  const samples = await page.evaluate(() => {
    const img = document.querySelector('img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const centerX = 392;
    const list = [];

    // Scan vertically every 10px from Y: 240 to Y: 500
    for (let y = 240; y <= 500; y += 10) {
      const [r, g, b] = ctx.getImageData(centerX, y, 1, 1).data;
      list.push({ y, r, g, b });
    }
    return list;
  });

  console.log("TITLE_AREA_Y_SCAN:", JSON.stringify(samples, null, 2));
  await browser.close();
}

scanTitleArea().catch(console.error);
