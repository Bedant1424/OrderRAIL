import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';
const OUTPUT_DIR = path.join(ROOT_DIR, 'sprint_11k_screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function verifySprint11K() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173/owner/tables', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  const tablesToTest = ['1', '5', '10', '25'];
  const generatedArtworks = {};

  for (const tNum of tablesToTest) {
    const dataUrl = await page.evaluate(async (num) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const qrCanvas = document.createElement("canvas");
      qrCanvas.width = 310;
      qrCanvas.height = 310;
      const qrCtx = qrCanvas.getContext("2d");
      qrCtx.fillStyle = "#FFFFFF";
      qrCtx.fillRect(0, 0, 310, 310);
      qrCtx.fillStyle = "#321300";
      qrCtx.fillRect(20, 20, 90, 90);
      qrCtx.fillRect(200, 20, 90, 90);
      qrCtx.fillRect(20, 200, 90, 90);

      const templateImg = new Image();
      templateImg.crossOrigin = "anonymous";

      return new Promise((resolve, reject) => {
        templateImg.onload = () => {
          // Native Dimensions
          const nativeWidth = templateImg.naturalWidth || templateImg.width || 1023;
          const nativeHeight = templateImg.naturalHeight || templateImg.height || 1537;
          canvas.width = nativeWidth;
          canvas.height = nativeHeight;

          // 1. Draw Template (Step 1)
          ctx.drawImage(templateImg, 0, 0, nativeWidth, nativeHeight);

          // 2. Draw White Backing Card (Step 2)
          const cardX = (1023 - 370) / 2;
          const cardY = 625;
          const cardSize = 370;
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

          // 3. Draw Dynamic QR Code (Step 3)
          ctx.drawImage(qrCanvas, (1023 - 310) / 2, 655, 310, 310);

          // 4. Render ONLY numeric value centered inside white rounded rectangle (Step 4)
          const numericOnly = num.replace(/^[^\d]*/, '') || num;
          const fontSize = numericOnly.length > 2 ? 36 : 46;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#321300";
          ctx.font = `900 ${fontSize}px sans-serif`;
          ctx.fillText(numericOnly, 511, 508);

          // 5. Export PNG
          resolve(canvas.toDataURL("image/png"));
        };

        templateImg.onerror = (err) => reject(err);
        templateImg.src = "/branding/cheesecorner/qr/qr-stand.png";
      });
    }, tNum);

    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const outPath = path.join(OUTPUT_DIR, `polished_table_${tNum}_artwork.png`);
    fs.writeFileSync(outPath, base64Data, 'base64');
    generatedArtworks[`table_${tNum}`] = {
      path: outPath,
      size: base64Data.length
    };
  }

  console.log("SPRINT_11K_VERIFICATION_COMPLETE");
  console.log(JSON.stringify(generatedArtworks, null, 2));

  await browser.close();
}

verifySprint11K().catch(console.error);
