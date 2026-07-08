import puppeteer from 'puppeteer-core';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = 'http://localhost:5173';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 900 });

  page.on('console', msg => console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.error(`[PAGEERROR] ${err}`));

  try {
    console.log('Navigating home...');
    await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'verify-home.png' });

    const tableHref = await page.evaluate(() => {
      const link = document.querySelector('a[href^="/t/"]');
      return link ? link.getAttribute('href') : null;
    });
    console.log('Found table link:', tableHref);

    if (tableHref) {
      await page.goto(base + tableHref, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));
      await page.screenshot({ path: 'verify-menu.png' });
      console.log('Saved verify-menu.png');

      // Click the "Veg" filter pill if present
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent && b.textContent.includes('Veg') && !b.textContent.includes('Non'));
        if (btn) { btn.click(); return true; }
        return false;
      });
      console.log('Clicked veg filter:', clicked);
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({ path: 'verify-menu-veg-filtered.png' });

      // Go to cart page for quick actions
      await page.goto(base + tableHref + '/cart', { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: 'verify-cart.png' });
      console.log('Saved verify-cart.png');
    } else {
      console.log('No table link found on home page.');
    }
  } catch (e) {
    console.error('Failed:', e);
  }

  await browser.close();
}

run();
