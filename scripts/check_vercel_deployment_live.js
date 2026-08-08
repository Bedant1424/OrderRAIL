import https from 'https';

function checkUrlWithNoCache(pathName) {
  return new Promise((resolve) => {
    // Add unique query parameter to bypass edge cache
    const cacheBuster = Date.now() + Math.random().toString(36).substring(2, 7);
    const options = {
      hostname: 'cheese-corner.vercel.app',
      path: `${pathName}?v=${cacheBuster}`,
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          path: pathName,
          statusCode: res.statusCode,
          contentType: res.headers['content-type'],
          contentLength: res.headers['content-length'],
          etag: res.headers['etag'],
          vercelCache: res.headers['x-vercel-cache'],
          bodySnippet: body.substring(0, 120).replace(/\n/g, ' ')
        });
      });
    });

    req.on('error', err => resolve({ error: err.message }));
    req.end();
  });
}

async function testLiveDeployment() {
  console.log("=== VERCEL LIVE DEPLOYMENT CACHE-BYPASS CHECK ===");
  const test1 = await checkUrlWithNoCache('/branding/cheesecorner/posters/poster-burger.jpg');
  console.log("Poster Burger:", JSON.stringify(test1, null, 2));

  const test2 = await checkUrlWithNoCache('/branding/cheesecorner/showcase/paneer-delight-burger.jpg');
  console.log("Showcase Burger:", JSON.stringify(test2, null, 2));

  const test3 = await checkUrlWithNoCache('/branding/cheesecorner/posters/non-existent-image-abc.jpg');
  console.log("Non-existent Branding Path:", JSON.stringify(test3, null, 2));
}

testLiveDeployment().catch(console.error);
