import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function precisionAudit() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  const localFileUri = 'file:///' + path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png').replace(/\\/g, '/');
  await page.goto(localFileUri);

  const auditData = await page.evaluate(() => {
    const img = document.querySelector('img');
    const w = img.naturalWidth; // 1023
    const h = img.naturalHeight; // 1537

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const centerX = 511;

    // Scan vertical center between Y: 350 and Y: 520 to locate white pill under "Table" heading
    const pillPixels = [];
    for (let y = 350; y <= 520; y++) {
      const [r, g, b] = ctx.getImageData(centerX, y, 1, 1).data;
      // White pill color (r > 240, g > 230, b > 200)
      if (r > 240 && g > 230 && b > 200) {
        pillPixels.push({ y, r, g, b });
      }
    }

    let pillStartY = -1;
    let pillEndY = -1;
    if (pillPixels.length > 0) {
      pillStartY = pillPixels[0].y;
      pillEndY = pillPixels[pillPixels.length - 1].y;
    }

    // Scan vertical center for Cream QR placeholder box (Y: 600 to 1250)
    const creamPixels = [];
    for (let y = 600; y <= 1250; y++) {
      const [r, g, b] = ctx.getImageData(centerX, y, 1, 1).data;
      if (r > 230 && g > 200 && b > 150 && r - b < 90) {
        creamPixels.push({ y, r, g, b });
      }
    }

    let creamStartY = -1;
    let creamEndY = -1;
    if (creamPixels.length > 0) {
      creamStartY = creamPixels[0].y;
      creamEndY = creamPixels[creamPixels.length - 1].y;
    }

    return {
      w,
      h,
      centerX,
      pillStartY,
      pillEndY,
      pillCenterY: Math.floor((pillStartY + pillEndY) / 2),
      creamStartY,
      creamEndY,
      creamCenterY: Math.floor((creamStartY + creamEndY) / 2)
    };
  });

  console.log("SPRINT_11K_PRECISION_AUDIT:", JSON.stringify(auditData, null, 2));
  await browser.close();
}

precisionAudit().catch(console.error);
