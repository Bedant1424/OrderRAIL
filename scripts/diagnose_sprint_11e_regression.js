import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function diagnoseRegression() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();
  
  // Listen for uncaught errors on page
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') console.log("PAGE_CONSOLE_ERROR:", msg.text());
  });

  await page.goto('http://localhost:5173/owner/tables', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // Trigger download button in browser
  const result = await page.evaluate(async () => {
    try {
      // Find Card button
      const buttons = Array.from(document.querySelectorAll('button'));
      const cardBtn = buttons.find(b => b.textContent?.includes('Card'));
      if (!cardBtn) return { error: "Card button not found" };

      cardBtn.click();
      return { clicked: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  console.log("CLICK_RESULT:", result);
  await new Promise(r => setTimeout(r, 1500));
  console.log("UNCAUGHT_PAGE_ERRORS:", pageErrors);

  await browser.close();
}

diagnoseRegression().catch(console.error);
