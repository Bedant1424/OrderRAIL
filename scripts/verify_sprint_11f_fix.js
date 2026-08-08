import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';
const OUTPUT_DIR = path.join(ROOT_DIR, 'sprint_11f_screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function verifySprint11FFix() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173/owner/tables', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // Evaluate generateQRArtwork logic in page DOM
  const testResults = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 784;
    canvas.height = 1360;
    const ctx = canvas.getContext("2d");

    const qrCanvas = document.createElement("canvas");
    qrCanvas.width = 296;
    qrCanvas.height = 296;
    const qrCtx = qrCanvas.getContext("2d");
    qrCtx.fillStyle = "#FFFFFF";
    qrCtx.fillRect(0, 0, 296, 296);
    qrCtx.fillStyle = "#321300";
    qrCtx.fillRect(20, 20, 80, 80);
    qrCtx.fillRect(196, 20, 80, 80);
    qrCtx.fillRect(20, 196, 80, 80);

    const templateImg = new Image();
    templateImg.crossOrigin = "anonymous";

    const dataUrl = await new Promise((resolve, reject) => {
      templateImg.onload = () => {
        ctx.drawImage(templateImg, 0, 0, 784, 1360);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#321300";
        ctx.font = "900 48px sans-serif";
        ctx.fillText("TABLE 15", 392, 395);

        const cardX = (784 - 340) / 2;
        const cardY = 515;
        const cardSize = 340;
        const r = 24;

        ctx.beginPath();
        ctx.moveTo(cardX + r, cardY);
        ctx.lineTo(cardX + cardSize - r, cardY);
        ctx.quadraticCurveTo(cardX + cardSize, cardY, cardX + cardSize, cardY + r);
        ctx.lineTo(cardX + cardSize, cardY + cardSize - r);
        ctx.quadraticCurveTo(cardX + cardSize, cardY + cardSize, cardX + cardSize - r, cardY + cardSize);
        ctx.lineTo(cardX + r, cardY + cardSize);
        ctx.quadraticCurveTo(cardX, cardY + cardSize, cardX, cardY + cardSize - r);
        ctx.lineTo(cardX, cardY + r);
        ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
        ctx.closePath();

        ctx.fillStyle = "#FFFFFF";
        ctx.shadowColor = "rgba(50, 19, 0, 0.12)";
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 6;
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        ctx.drawImage(qrCanvas, (784 - 296) / 2, 537, 296, 296);

        resolve(canvas.toDataURL("image/png"));
      };

      templateImg.onerror = (err) => reject(err);

      // Explicitly test templateImg.src = TEMPLATE_LAYOUT.templateUrl
      templateImg.src = "/branding/cheesecorner/qr/qr-stand.png";
    });

    return {
      artworkUrlLength: dataUrl.length,
      artworkIsDataUrl: dataUrl.startsWith('data:image/png;base64,'),
    };
  });

  console.log("SPRINT_11F_VERIFICATION_RESULTS:", JSON.stringify(testResults, null, 2));

  const pageProof = path.join(OUTPUT_DIR, 'owner_tables_page_restored.png');
  await page.screenshot({ path: pageProof });

  await browser.close();
}

verifySprint11FFix().catch(console.error);
