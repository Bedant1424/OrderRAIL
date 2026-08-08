import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function scanYProfile() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  const localFileUri = 'file:///' + path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png').replace(/\\/g, '/');
  await page.goto(localFileUri);

  const profile = await page.evaluate(() => {
    const img = document.querySelector('img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const samples = [];
    for (let y = 100; y <= 1260; y += 20) {
      const p = ctx.getImageData(392, y, 1, 1).data;
      samples.push({ y, color: `rgb(${p[0]},${p[1]},${p[2]})` });
    }
    return samples;
  });

  console.log("DETAILED_Y_PROFILE:", JSON.stringify(profile, null, 2));
  await browser.close();
}

scanYProfile().catch(console.error);
