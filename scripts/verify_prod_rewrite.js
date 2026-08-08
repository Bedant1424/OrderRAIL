import https from 'https';

function checkProdUrl(urlPath) {
  const url = `https://cheese-corner.vercel.app${urlPath}`;
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`\nURL: ${url}`);
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Content-Type: ${res.headers['content-type']}`);
      console.log(`Content-Length: ${res.headers['content-length']}`);
      console.log(`Body Snippet: ${data.substring(0, 150).replace(/\n/g, ' ')}`);
    });
  });
}

checkProdUrl('/branding/cheesecorner/posters/poster-burger.jpg');
checkProdUrl('/branding/cheesecorner/logo/logo.png');
checkProdUrl('/assets/index-D8Y8_x2s.js'); // bundled asset
