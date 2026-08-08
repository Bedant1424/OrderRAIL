import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function inspectVisual() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  const localFileUri = 'file:///' + path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png').replace(/\\/g, '/');
  await page.goto(localFileUri);

  const info = await page.evaluate(() => {
    const img = document.querySelector('img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Let's sample colors down the vertical center line of the image
    const samples = [];
    for (let y = 0; y < canvas.height; y += 40) {
      const data = ctx.getImageData(canvas.width / 2, y, 1, 1).data;
      samples.push({ y, r: data[0], g: data[1], b: data[2], a: data[3] });
    }
    return samples;
  });

  console.log("CENTER_VERTICAL_SAMPLES:", JSON.stringify(info, null, 2));
  await browser.close();
}

inspectVisual().catch(console.error);
