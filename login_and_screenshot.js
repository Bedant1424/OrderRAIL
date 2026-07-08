import puppeteer from 'puppeteer-core';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const loginUrl = 'http://localhost:8080/staff/login';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER PAGEERROR] ${err.toString()}`);
  });

  try {
    console.log('Navigating to login page...');
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });
    
    // Switch to Sign Up mode
    console.log('Switching to Sign Up mode...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const signUpBtn = buttons.find(b => b.textContent.includes('Sign up') || b.textContent.includes('Create account'));
      if (signUpBtn) signUpBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    
    const randomEmail = `test-staff-${Math.floor(Math.random() * 100000)}@example.com`;
    console.log(`Typing email: ${randomEmail}`);
    await page.type('input[type="email"]', randomEmail);
    await page.type('input[type="password"]', 'Password123!');
    
    console.log('Submitting form...');
    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 4000));
    
    // Click the "Staff" box to claim demo access role
    console.log('Clicking Staff claim box...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const staffBox = buttons.find(b => b.textContent.includes('Staff') && b.textContent.includes('Live orders'));
      if (staffBox) {
        staffBox.click();
        console.log('Clicked Staff claim box');
      } else {
        console.log('Could not find Staff claim box, buttons:');
        console.log(buttons.map(b => b.textContent));
      }
    });
    await new Promise(r => setTimeout(r, 6000));
    
    console.log('Navigating to /staff dashboard...');
    await page.goto('http://localhost:8080/staff', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 5000));
    
    await page.screenshot({ path: 'C:\\Users\\17042\\Downloads\\orderrail-pro-main old\\orderrail-pro-main\\staff-dashboard-current.png' });
    console.log('Saved staff-dashboard-current.png');
  } catch (e) {
    console.error('Failed:', e);
  }

  await browser.close();
}

run();
