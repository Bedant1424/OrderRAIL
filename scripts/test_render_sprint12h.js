import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testRender() {
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
        const qrc = document.getElementById('qrCanvas');
        const qctx = qrc.getContext('2d');
        qctx.fillStyle = '#ffffff';
        qctx.fillRect(0, 0, 400, 400);
        qctx.fillStyle = '#000000';
        qctx.fillRect(20, 20, 360, 360);

        window.renderTest = async function(centerX, centerY, cardSize, qrSize, tableCenterX, tableCenterY, fontSize) {
          const templateImg = new Image();
          await new Promise(resolve => {
            templateImg.onload = resolve;
            templateImg.src = "${templateUri}";
          });

          const canvas = document.createElement('canvas');
          canvas.width = templateImg.naturalWidth; // 948
          canvas.height = templateImg.naturalHeight; // 1660
          const ctx = canvas.getContext('2d');

          // Draw template
          ctx.drawImage(templateImg, 0, 0);

          // Draw Table Number
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#321300";
          ctx.font = "bold " + (fontSize || 48) + "px sans-serif";
          ctx.fillText("1", tableCenterX, tableCenterY);

          // Draw QR White Card & QR
          const cardX = centerX - cardSize / 2;
          const cardY = centerY - cardSize / 2;
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
          const qrX = centerX - qrSize / 2;
          const qrY = centerY - qrSize / 2;
          ctx.drawImage(qrc, qrX, qrY, qrSize, qrSize);

          return canvas.toDataURL('image/png');
        }

        window.scanBounds = async function() {
          const templateImg = new Image();
          await new Promise(resolve => {
            templateImg.onload = resolve;
            templateImg.src = "${templateUri}";
          });

          const canvas = document.createElement('canvas');
          canvas.width = templateImg.naturalWidth;
          canvas.height = templateImg.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(templateImg, 0, 0);

          const w = canvas.width;
          const h = canvas.height;
          const cx = Math.floor(w / 2);

          // 1. White Table Pill SCAN (Y: 150..350)
          let pillMinY = -1, pillMaxY = -1, pillMinX = -1, pillMaxX = -1;
          for (let y = 150; y < 350; y++) {
            const [r, g, b] = ctx.getImageData(cx, y, 1, 1).data;
            if (r > 240 && g > 240 && b > 240) {
              if (pillMinY === -1) pillMinY = y;
              pillMaxY = y;
            }
          }
          if (pillMinY !== -1) {
            const midY = Math.floor((pillMinY + pillMaxY) / 2);
            for (let x = 50; x < w - 50; x++) {
              const [r, g, b] = ctx.getImageData(x, midY, 1, 1).data;
              if (r > 240 && g > 240 && b > 240) {
                if (pillMinX === -1) pillMinX = x;
                pillMaxX = x;
              }
            }
          }

          // 2. Cream Container Box SCAN (Y: 450..950)
          // Cream placeholder box RGB around (235..245, 200..215, 145..160)
          let creamMinY = -1, creamMaxY = -1, creamMinX = -1, creamMaxX = -1;
          for (let y = 450; y < 950; y++) {
            const [r, g, b] = ctx.getImageData(cx, y, 1, 1).data;
            // cream background check
            if (r > 225 && g > 195 && b > 140 && r < 245 && g < 215) {
              if (creamMinY === -1) creamMinY = y;
              creamMaxY = y;
            }
          }
          if (creamMinY !== -1) {
            const midY = Math.floor((creamMinY + creamMaxY) / 2);
            for (let x = 50; x < w - 50; x++) {
              const [r, g, b] = ctx.getImageData(x, midY, 1, 1).data;
              if (r > 225 && g > 195 && b > 140 && r < 245 && g < 215) {
                if (creamMinX === -1) creamMinX = x;
                creamMaxX = x;
              }
            }
          }

          return {
            width: w,
            height: h,
            pill: { minX: pillMinX, maxX: pillMaxX, minY: pillMinY, maxY: pillMaxY, cx: (pillMinX+pillMaxX)/2, cy: (pillMinY+pillMaxY)/2, width: pillMaxX - pillMinX, height: pillMaxY - pillMinY },
            creamContainer: { minX: creamMinX, maxX: creamMaxX, minY: creamMinY, maxY: creamMaxY, cx: (creamMinX+creamMaxX)/2, cy: (creamMinY+creamMaxY)/2, width: creamMaxX - creamMinX, height: creamMaxY - creamMinY }
          };
        }
      </script>
    </body>
    </html>
  `);

  const templateBounds = await page.evaluate(async () => {
    return await window.scanBounds();
  });

  console.log("EXACT_TEMPLATE_SCAN_RESULTS:", JSON.stringify(templateBounds, null, 2));

  // Render 12G
  const dataUrl12G = await page.evaluate(async () => {
    return await window.renderTest(474, 675, 360, 300, 499, 241, 48);
  });
  const base64Data = dataUrl12G.split(',')[1];
  const outPath = path.join(process.cwd(), 'scripts', 'test_sprint12g_output.png');
  fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
  console.log("Saved 12G test output to:", outPath);

  await browser.close();
}

testRender().catch(console.error);
