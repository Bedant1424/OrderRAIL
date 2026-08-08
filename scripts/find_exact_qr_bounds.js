import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function findExactBounds() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  const localFileUri = 'file:///' + path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png').replace(/\\/g, '/');
  await page.goto(localFileUri);

  const bounds = await page.evaluate(() => {
    const img = document.querySelector('img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; // 784
    canvas.height = img.naturalHeight; // 1360
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const centerX = Math.floor(canvas.width / 2);
    
    // Sample vertical pixels to find the cream card region (light color vs background)
    let cardStartY = -1;
    let cardEndY = -1;

    for (let y = 0; y < canvas.height; y++) {
      const p = ctx.getImageData(centerX, y, 1, 1).data;
      const r = p[0], g = p[1], b = p[2];
      
      // Cream card background is light cream (r > 230, g > 210, b > 160)
      const isCream = (r > 230 && g > 210 && b > 160 && r - b < 90);
      
      if (isCream && cardStartY === -1 && y > 200) {
        cardStartY = y;
      } else if (!isCream && cardStartY !== -1 && cardEndY === -1 && y > cardStartY + 200) {
        cardEndY = y;
      }
    }

    return {
      width: canvas.width,
      height: canvas.height,
      cardStartY,
      cardEndY,
      cardHeight: cardEndY - cardStartY
    };
  });

  console.log("EXACT_ARTWORK_BOUNDS:", JSON.stringify(bounds, null, 2));
  await browser.close();
}

findExactBounds().catch(console.error);
