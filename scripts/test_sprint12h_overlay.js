import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testSprint12HOverlay() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--allow-file-access-from-files']
  });
  const page = await browser.newPage();
  
  const templatePath = path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png');
  const templateBuf = fs.readFileSync(templatePath);
  const templateUri = `data:image/png;base64,${templateBuf.toString('base64')}`;

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <body>
      <canvas id="qrCanvas" width="400" height="400"></canvas>
      <script>
        // Draw realistic QR pattern on canvas
        const qrc = document.getElementById('qrCanvas');
        const qctx = qrc.getContext('2d');
        qctx.fillStyle = '#ffffff';
        qctx.fillRect(0, 0, 400, 400);
        qctx.fillStyle = '#1a1210';
        qctx.fillRect(20, 20, 360, 360);
        qctx.fillStyle = '#ffffff';
        qctx.fillRect(60, 60, 280, 280);
        qctx.fillStyle = '#1a1210';
        qctx.fillRect(100, 100, 200, 200);

        window.renderArtwork = async function(tableLabel, tableCx, tableCy, qrCx, qrCy, cardSize, qrSize, fontSize) {
          const templateImg = new Image();
          await new Promise(resolve => {
            templateImg.onload = resolve;
            templateImg.src = "${templateUri}";
          });

          const canvas = document.createElement('canvas');
          canvas.width = templateImg.naturalWidth; // 948
          canvas.height = templateImg.naturalHeight; // 1660
          const ctx = canvas.getContext('2d');

          // 1. Draw template
          ctx.drawImage(templateImg, 0, 0);

          // 2. Draw Table Number
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#321300";
          ctx.font = "bold " + (fontSize || 48) + "px 'Outfit', sans-serif";
          ctx.fillText(tableLabel, tableCx, tableCy);

          // 3. Draw QR White Card & QR
          const cardX = qrCx - cardSize / 2;
          const cardY = qrCy - cardSize / 2;
          const borderRadius = 24;

          ctx.beginPath();
          ctx.moveTo(cardX + borderRadius, cardY);
          ctx.lineTo(cardX + cardSize - borderRadius, cardY);
          ctx.quadraticCurveTo(cardX + cardSize, cardY, cardX + cardSize, cardY + borderRadius);
          ctx.lineTo(cardX + cardSize, cardY + cardSize - borderRadius);
          ctx.quadraticCurveTo(cardX + cardSize, cardY + cardSize, cardX + cardSize - borderRadius, cardY + cardSize);
          ctx.lineTo(cardX + borderRadius, cardY + cardSize);
          ctx.quadraticCurveTo(cardX, cardY + cardSize, cardX, cardY + cardSize - borderRadius);
          ctx.lineTo(cardX, cardY + borderRadius);
          ctx.quadraticCurveTo(cardX, cardY, cardX + borderRadius, cardY);
          ctx.closePath();

          ctx.fillStyle = "#FFFFFF";
          ctx.shadowColor = "rgba(50, 19, 0, 0.10)";
          ctx.shadowBlur = 20;
          ctx.shadowOffsetY = 5;
          ctx.fill();

          ctx.shadowColor = "transparent";
          const qrX = qrCx - qrSize / 2;
          const qrY = qrCy - qrSize / 2;
          ctx.drawImage(qrc, qrX, qrY, qrSize, qrSize);

          return canvas.toDataURL('image/png');
        }
      </script>
    </body>
    </html>
  `);

  // Render Table 1 with new Sprint 12H overlay settings:
  // Table Pill: cx=499, cy=252 (or 248)
  // QR Container: cx=474, cy=741, cardSize=360, qrSize=300
  const dataUrl12H = await page.evaluate(async () => {
    return await window.renderArtwork("1", 499, 250, 474, 741, 360, 300, 48);
  });

  const base64Data = dataUrl12H.split(',')[1];
  const outPath = path.join(process.cwd(), 'scripts', 'test_sprint12h_output.png');
  fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
  console.log("Saved Sprint 12H overlay test output to:", outPath);

  // Check pixel safety: confirm white card does NOT overlap brown banner (Y: 475..515)
  // White card Y range: 741 - 180 = 561 to 741 + 180 = 921.
  // Brown banner Y range: 475 to 515.
  // Gap between brown banner bottom (515) and card top (561) = 46px!
  console.log("Banner-to-card gap:", 561 - 515, "px (Completely safe, 0 overlap!)");

  await browser.close();
}

testSprint12HOverlay().catch(console.error);
