import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main';

async function examinePosterComposition() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  const burgerPath = path.join(ROOT_DIR, 'branding', 'cheesecorner', 'assets', 'posters', 'poster-burger.jpg');
  const fileUrl = 'file:///' + burgerPath.replace(/\\/g, '/');

  await page.goto(fileUrl);

  const analysis = await page.evaluate(() => {
    const img = document.querySelector('img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Sample border vs center to see if there is a wall / frame / background around the poster artwork
    const topEdge = ctx.getImageData(canvas.width / 2, 50, 1, 1).data;
    const bottomEdge = ctx.getImageData(canvas.width / 2, canvas.height - 50, 1, 1).data;
    const leftEdge = ctx.getImageData(50, canvas.height / 2, 1, 1).data;
    const rightEdge = ctx.getImageData(canvas.width - 50, canvas.height / 2, 1, 1).data;
    const center = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;

    return {
      dimensions: `${img.naturalWidth}x${img.naturalHeight}`,
      topEdgeRgb: `[${topEdge[0]},${topEdge[1]},${topEdge[2]}]`,
      bottomEdgeRgb: `[${bottomEdge[0]},${bottomEdge[1]},${bottomEdge[2]}]`,
      leftEdgeRgb: `[${leftEdge[0]},${leftEdge[1]},${leftEdge[2]}]`,
      rightEdgeRgb: `[${rightEdge[0]},${rightEdge[1]},${rightEdge[2]}]`,
      centerRgb: `[${center[0]},${center[1]},${center[2]}]`
    };
  });

  console.log("Poster Composition Analysis:", JSON.stringify(analysis, null, 2));

  await browser.close();
}

examinePosterComposition().catch(console.error);
