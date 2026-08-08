import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function measureTemplate() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  const localFileUri = 'file:///' + path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png').replace(/\\/g, '/');
  await page.goto(localFileUri);

  const scanData = await page.evaluate(() => {
    const img = document.querySelector('img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; // 784
    canvas.height = img.naturalHeight; // 1360
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const centerX = Math.floor(canvas.width / 2); // 392
    
    // 1. Scan for small rounded white rectangle for table number (between Y: 200 and Y: 500)
    // Find top and bottom Y bounds of white/light rect in title area
    let tableNumRectTop = -1;
    let tableNumRectBottom = -1;
    let tableNumRectLeft = -1;
    let tableNumRectRight = -1;

    // Scan vertical center line for white/light pill (R,G,B > 240)
    for (let y = 200; y < 500; y++) {
      const [r, g, b] = ctx.getImageData(centerX, y, 1, 1).data;
      const isWhitePill = (r > 240 && g > 230 && b > 200);
      if (isWhitePill && tableNumRectTop === -1) {
        tableNumRectTop = y;
      } else if (!isWhitePill && tableNumRectTop !== -1 && tableNumRectBottom === -1) {
        tableNumRectBottom = y;
      }
    }

    if (tableNumRectTop !== -1 && tableNumRectBottom !== -1) {
      const midY = Math.floor((tableNumRectTop + tableNumRectBottom) / 2);
      // Scan horizontal bounds at midY
      for (let x = 100; x < canvas.width; x++) {
        const [r, g, b] = ctx.getImageData(x, midY, 1, 1).data;
        const isWhitePill = (r > 240 && g > 230 && b > 200);
        if (isWhitePill && tableNumRectLeft === -1) {
          tableNumRectLeft = x;
        } else if (!isWhitePill && tableNumRectLeft !== -1 && tableNumRectRight === -1) {
          tableNumRectRight = x;
        }
      }
    }

    // 2. Scan for large cream QR placeholder box (between Y: 450 and Y: 950)
    let qrBoxTop = -1;
    let qrBoxBottom = -1;
    let qrBoxLeft = -1;
    let qrBoxRight = -1;

    for (let y = 500; y < 950; y++) {
      const [r, g, b] = ctx.getImageData(centerX, y, 1, 1).data;
      // Cream placeholder box is light cream (r > 235, g > 215, b > 165)
      const isCreamBox = (r > 235 && g > 215 && b > 165 && r - b < 90);
      if (isCreamBox && qrBoxTop === -1) {
        qrBoxTop = y;
      } else if (!isCreamBox && qrBoxTop !== -1 && qrBoxBottom === -1) {
        qrBoxBottom = y;
      }
    }

    if (qrBoxTop !== -1 && qrBoxBottom !== -1) {
      const midY = Math.floor((qrBoxTop + qrBoxBottom) / 2);
      for (let x = 50; x < canvas.width - 50; x++) {
        const [r, g, b] = ctx.getImageData(x, midY, 1, 1).data;
        const isCreamBox = (r > 235 && g > 215 && b > 165 && r - b < 90);
        if (isCreamBox && qrBoxLeft === -1) {
          qrBoxLeft = x;
        } else if (!isCreamBox && qrBoxLeft !== -1 && qrBoxRight === -1) {
          qrBoxRight = x;
        }
      }
    }

    return {
      width: canvas.width,
      height: canvas.height,
      tableNumberPill: {
        top: tableNumRectTop,
        bottom: tableNumRectBottom,
        left: tableNumRectLeft,
        right: tableNumRectRight,
        width: tableNumRectRight - tableNumRectLeft,
        height: tableNumRectBottom - tableNumRectTop,
        centerX: (tableNumRectLeft + tableNumRectRight) / 2,
        centerY: (tableNumRectTop + tableNumRectBottom) / 2
      },
      qrPlaceholderBox: {
        top: qrBoxTop,
        bottom: qrBoxBottom,
        left: qrBoxLeft,
        right: qrBoxRight,
        width: qrBoxRight - qrBoxLeft,
        height: qrBoxBottom - qrBoxTop,
        centerX: (qrBoxLeft + qrBoxRight) / 2,
        centerY: (qrBoxTop + qrBoxBottom) / 2
      }
    };
  });

  console.log("PRECISE_ARTWORK_MEASUREMENTS:", JSON.stringify(scanData, null, 2));
  await browser.close();
}

measureTemplate().catch(console.error);
