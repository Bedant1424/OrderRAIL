import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function checkQRContent() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  const localFileUri = 'file:///' + path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png').replace(/\\/g, '/');
  await page.goto(localFileUri);

  const analysis = await page.evaluate(() => {
    const img = document.querySelector('img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Sample pixels in center area (where QR card is)
    const centerX = Math.floor(canvas.width / 2);
    const centerY = Math.floor(canvas.height * 0.45);
    
    // Read 100x100 pixels in the center
    const imgData = ctx.getImageData(centerX - 50, centerY - 50, 100, 100);
    let blackPixels = 0;
    let whitePixels = 0;

    for (let i = 0; i < imgData.data.length; i += 4) {
      const r = imgData.data[i];
      const g = imgData.data[i + 1];
      const b = imgData.data[i + 2];
      if (r < 50 && g < 50 && b < 50) blackPixels++;
      if (r > 200 && g > 200 && b > 200) whitePixels++;
    }

    return {
      width: canvas.width,
      height: canvas.height,
      blackPixels,
      whitePixels,
      hasExistingQR: blackPixels > 1000 && whitePixels > 1000
    };
  });

  console.log("ANALYSIS:", JSON.stringify(analysis, null, 2));
  await browser.close();
}

checkQRContent().catch(console.error);
