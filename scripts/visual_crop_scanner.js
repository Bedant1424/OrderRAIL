import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function cropVisuals() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  const localFileUri = 'file:///' + path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png').replace(/\\/g, '/');
  await page.goto(localFileUri);

  // Take screenshot of top region (Y: 0 to 600)
  const topProofPath = path.join(process.cwd(), 'sprint_11g_screenshots');
  if (!fs.existsSync(topProofPath)) fs.mkdirSync(topProofPath, { recursive: true });

  await page.screenshot({ path: path.join(topProofPath, 'artwork_top_half.png') });

  // Read pixel colors in title area y: 350 to 450
  const titleData = await page.evaluate(() => {
    const img = document.querySelector('img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const rows = [];
    for (let y = 350; y <= 450; y += 5) {
      let line = "";
      for (let x = 300; x <= 480; x += 10) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        if (r < 100 && g < 100 && b < 100) line += "#"; // dark
        else if (r > 200 && g > 180 && b > 140) line += "."; // light/amber
        else line += "o";
      }
      rows.push({ y, line });
    }
    return rows;
  });

  console.log("PIXEL_MAP_TITLE_AREA:", JSON.stringify(titleData, null, 2));
  await browser.close();
}

cropVisuals().catch(console.error);
