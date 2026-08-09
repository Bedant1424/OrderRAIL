import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function inspectBanner() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  const templatePath = path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png');
  const templateBuf = fs.readFileSync(templatePath);
  const templateUri = `data:image/png;base64,${templateBuf.toString('base64')}`;

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <body>
      <script>
        window.inspectDetailed = async function() {
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
          const cx = Math.floor(w / 2); // 474

          // Let's sample colors down center line from Y=180 to Y=600
          const samples = [];
          for (let y = 180; y <= 600; y += 5) {
            const [r, g, b, a] = ctx.getImageData(cx, y, 1, 1).data;
            samples.push({ y, r, g, b, hex: '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('') });
          }

          // Let's find horizontal span of white pill at Y=241
          let pillLeft = -1, pillRight = -1;
          for (let x = 300; x < 650; x++) {
            const [r, g, b] = ctx.getImageData(x, 241, 1, 1).data;
            if (r > 240 && g > 240 && b > 240) {
              if (pillLeft === -1) pillLeft = x;
              pillRight = x;
            }
          }

          // Let's find horizontal span of cream box at Y=740
          let creamLeft = -1, creamRight = -1;
          for (let x = 100; x < 850; x++) {
            const [r, g, b] = ctx.getImageData(x, 740, 1, 1).data;
            if (r > 225 && g > 195 && b > 140 && r < 245 && g < 215) {
              if (creamLeft === -1) creamLeft = x;
              creamRight = x;
            }
          }

          // Let's find vertical span of cream box at X=474
          let creamTop = -1, creamBottom = -1;
          for (let y = 450; y < 1100; y++) {
            const [r, g, b] = ctx.getImageData(cx, y, 1, 1).data;
            if (r > 225 && g > 195 && b > 140 && r < 245 && g < 215) {
              if (creamTop === -1) creamTop = y;
              creamBottom = y;
            }
          }

          return {
            pillAtY241: { pillLeft, pillRight, width: pillRight - pillLeft, cx: (pillLeft + pillRight) / 2 },
            creamAtY740: { creamLeft, creamRight, width: creamRight - creamLeft, cx: (creamLeft + creamRight) / 2 },
            creamAtX474: { creamTop, creamBottom, height: creamBottom - creamTop, cy: (creamTop + creamBottom) / 2 },
            samples
          };
        };
      </script>
    </body>
    </html>
  `);

  const data = await page.evaluate(async () => window.inspectDetailed());
  console.log("PILL_SPAN:", JSON.stringify(data.pillAtY241, null, 2));
  console.log("CREAM_SPAN_X:", JSON.stringify(data.creamAtY740, null, 2));
  console.log("CREAM_SPAN_Y:", JSON.stringify(data.creamAtX474, null, 2));
  console.log("VERTICAL_PROFILE_180_TO_600:");
  data.samples.forEach(s => console.log(`Y=${s.y}: RGB(${s.r},${s.g},${s.b}) ${s.hex}`));

  await browser.close();
}

inspectBanner().catch(console.error);
