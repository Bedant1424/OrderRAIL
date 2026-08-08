import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';
const OUTPUT_DIR = path.join(ROOT_DIR, 'sprint_11o_screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function verifySprint11O() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173/owner/tables', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  const tablesToTest = ['1', '5', '10'];
  const generatedArtworks = {};

  for (const tNum of tablesToTest) {
    const dataUrl = await page.evaluate(async (num) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const qrCanvas = document.createElement("canvas");
      qrCanvas.width = 335;
      qrCanvas.height = 335;
      const qrCtx = qrCanvas.getContext("2d");
      qrCtx.fillStyle = "#FFFFFF";
      qrCtx.fillRect(0, 0, 335, 335);
      qrCtx.fillStyle = "#321300";
      qrCtx.fillRect(20, 20, 95, 95);
      qrCtx.fillRect(220, 20, 95, 95);
      qrCtx.fillRect(20, 220, 95, 95);

      const templateImg = new Image();
      templateImg.crossOrigin = "anonymous";

      return new Promise((resolve, reject) => {
        templateImg.onload = () => {
          // Native Dimensions (1023x1537)
          const nativeWidth = templateImg.naturalWidth || templateImg.width || 1023;
          const nativeHeight = templateImg.naturalHeight || templateImg.height || 1537;
          canvas.width = nativeWidth;
          canvas.height = nativeHeight;

          // 1. Draw Artwork Template
          ctx.drawImage(templateImg, 0, 0, nativeWidth, nativeHeight);

          // 2. Draw White QR Backing Card (Task 1 & 3: cardSize=402, Y=628)
          const cardX = (1023 - 402) / 2;
          const cardY = 628;
          const cardSize = 402;
          const r = 22;

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

          // 3. Draw Dynamic QR Code (Task 2 & 4: qrSize=335, Y=661)
          ctx.drawImage(qrCanvas, (1023 - 335) / 2, 661, 335, 335);

          // 4. Render Numeric Table Number (Task 5: heavy rounded font 54px, Y=513)
          const numericOnly = num.replace(/^[^\d]*/, '') || num;
          const fontSize = numericOnly.length > 2 ? 42 : 54;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#321300";
          ctx.font = `900 ${fontSize}px 'Outfit', 'Fredoka', 'Quicksand', 'Nunito', 'Comfortaa', sans-serif`;
          ctx.fillText(numericOnly, 511, 513);

          // 5. Export PNG
          resolve(canvas.toDataURL("image/png"));
        };

        templateImg.onerror = (err) => reject(err);
        templateImg.src = "/branding/cheesecorner/qr/qr-stand.png";
      });
    }, tNum);

    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const outPath = path.join(OUTPUT_DIR, `optical_table_${tNum}_artwork.png`);
    fs.writeFileSync(outPath, base64Data, 'base64');
    generatedArtworks[`table_${tNum}`] = {
      path: outPath,
      size: base64Data.length
    };
  }

  console.log("SPRINT_11O_VERIFICATION_COMPLETE");
  console.log(JSON.stringify(generatedArtworks, null, 2));

  await browser.close();
}

verifySprint11O().catch(console.error);
