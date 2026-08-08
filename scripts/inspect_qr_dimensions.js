import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function inspectImage() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  const localFileUri = 'file:///' + path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png').replace(/\\/g, '/');
  await page.goto(localFileUri);

  const dims = await page.evaluate(() => {
    const img = document.querySelector('img');
    return {
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight
    };
  });

  console.log("IMAGE_DIMENSIONS:", dims);
  await browser.close();
}

inspectImage().catch(console.error);
