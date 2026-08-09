import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function measureStartup() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const page = await browser.newPage();

  // Listen to network requests
  const requests = [];
  const startTime = Date.now();

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/rest/v1/') || url.includes('/rpc/')) {
      requests.push({
        url,
        method: req.method(),
        startTime: Date.now() - startTime,
      });
    }
  });

  // Navigate to local app or dev server URL if running, or file mode
  // Let's check if dev server is running on localhost or test via local URI
  console.log("Measuring QR startup request waterfall...");

  // Let's use a real table UUID from the codebase
  const tableId = "b8ce9675-e147-4268-a4d7-37038dcac67a"; // Table 1 UUID from test suite
  
  // Navigate to dev server URL (e.g. http://localhost:8080/t/${tableId} or http://localhost:5173/t/${tableId})
  // If no dev server is active, we will start preview or vite server to capture exact timing.

  await browser.close();
}

measureStartup().catch(console.error);
