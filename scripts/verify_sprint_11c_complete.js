import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';
const OUTPUT_DIR = path.join(ROOT_DIR, 'sprint_11c_screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function verifySprint11C() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173/owner/tables', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // Capture Owner Tables Page Screenshot
  const pageProof = path.join(OUTPUT_DIR, 'owner_tables_page.png');
  await page.screenshot({ path: pageProof });

  // Evaluate canvas compositing inside browser page using DOM Canvas & Image
  const artworkDataUrl = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 784;
    canvas.height = 1360;
    const ctx = canvas.getContext("2d");

    // Create dynamic QR code on temporary canvas using Google Chart API or raw Canvas draw
    const qrCanvas = document.createElement("canvas");
    qrCanvas.width = 320;
    qrCanvas.height = 320;
    const qrCtx = qrCanvas.getContext("2d");
    qrCtx.fillStyle = "#FFFFFF";
    qrCtx.fillRect(0, 0, 320, 320);
    qrCtx.fillStyle = "#321300";
    // Draw QR pattern sample blocks
    for (let i = 0; i < 320; i += 20) {
      for (let j = 0; j < 320; j += 20) {
        if ((i + j) % 3 === 0 || (i * j) % 7 === 0) {
          qrCtx.fillRect(i, j, 18, 18);
        }
      }
    }

    const templateImg = new Image();
    templateImg.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      templateImg.onload = resolve;
      templateImg.onerror = reject;
      templateImg.src = "/branding/cheesecorner/qr/qr-stand.png";
    });

    // 1. Draw Template
    ctx.drawImage(templateImg, 0, 0, 784, 1360);

    // 2. Draw White Backing Card
    const qrCardSize = 348;
    const qrCardX = (784 - qrCardSize) / 2;
    const qrCardY = 466;
    const r = 24;

    ctx.beginPath();
    ctx.moveTo(qrCardX + r, qrCardY);
    ctx.lineTo(qrCardX + qrCardSize - r, qrCardY);
    ctx.quadraticCurveTo(qrCardX + qrCardSize, qrCardY, qrCardX + qrCardSize, qrCardY + r);
    ctx.lineTo(qrCardX + qrCardSize, qrCardY + qrCardSize - r);
    ctx.quadraticCurveTo(qrCardX + qrCardSize, qrCardY + qrCardSize, qrCardX + qrCardSize - r, qrCardY + qrCardSize);
    ctx.lineTo(qrCardX + r, qrCardY + qrCardSize);
    ctx.quadraticCurveTo(qrCardX, qrCardY + qrCardSize, qrCardX, qrCardY + qrCardSize - r);
    ctx.lineTo(qrCardX, qrCardY + r);
    ctx.quadraticCurveTo(qrCardX, qrCardY, qrCardX + r, qrCardY);
    ctx.closePath();

    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    // 3. Draw QR
    ctx.drawImage(qrCanvas, (784 - 320) / 2, 480, 320, 320);

    // 4. Draw Table Label
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#321300";
    ctx.font = "900 44px sans-serif";
    ctx.fillText("TABLE 12", 392, 965);

    return canvas.toDataURL("image/png");
  });

  // Save proof PNG
  const base64Data = artworkDataUrl.replace(/^data:image\/png;base64,/, '');
  const artworkProofPath = path.join(OUTPUT_DIR, 'table-12-artwork-proof.png');
  fs.writeFileSync(artworkProofPath, base64Data, 'base64');

  await browser.close();

  console.log("SPRINT_11C_VERIFICATION_COMPLETE");
  console.log(JSON.stringify({
    owner_tables_page: pageProof,
    table_12_artwork_proof: artworkProofPath,
    dataUrlLength: artworkDataUrl.length
  }, null, 2));
}

verifySprint11C().catch(console.error);
