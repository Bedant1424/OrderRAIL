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
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`); });
  page.on('pageerror', err => { errors.push(String(err)); console.error(`[PAGEERROR] ${err}`); });
  page.on('requestfailed', req => console.log(`[REQFAIL] ${req.url()} ${req.failure()?.errorText}`));
  page.on('response', res => { if (!res.ok() && res.url().includes('supabase')) console.log(`[HTTP ${res.status()}] ${res.url()}`); });

  try {
    await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    const tableHref = await page.evaluate(() => {
      const link = document.querySelector('a[href^="/t/"]');
      return link ? link.getAttribute('href') : null;
    });
    console.log('table href:', tableHref);

    // Go to menu, add first item to cart
    await page.goto(base + tableHref, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    const added = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label^="Add "]');
      if (btn) { btn.click(); return true; }
      return false;
    });
    console.log('added item to cart:', added);
    await new Promise(r => setTimeout(r, 500));

    // Go to cart
    await page.goto(base + tableHref + '/cart', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'repro-cart-before-place.png' });

    // Click Place Order
    const placed = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent && b.textContent.includes('Place Order'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    console.log('clicked Place Order:', placed);
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'repro-after-place-order.png' });
    console.log('URL after place order:', page.url());

    const bodyText1 = await page.evaluate(() => document.body.innerText.slice(0, 300));
    console.log('BODY TEXT after place order:', bodyText1);

    // Now test Give Review from cart (need an existing served order typically; but let's just click it and see result)
    await page.goto(base + tableHref + '/cart', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    const reviewClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent && b.textContent.includes('Leave Review'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    console.log('clicked Leave Review:', reviewClicked);
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: 'repro-after-give-review.png' });
    const bodyText2 = await page.evaluate(() => document.body.innerText.slice(0, 300));
    console.log('BODY TEXT after give review:', bodyText2);

    console.log('ERRORS COLLECTED:', JSON.stringify(errors, null, 2));
  } catch (e) {
    console.error('Failed:', e);
  }

  await browser.close();
}

run();
