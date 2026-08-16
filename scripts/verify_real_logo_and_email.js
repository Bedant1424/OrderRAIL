import { createClient } from '@supabase/supabase-js';
import https from 'https';

const SUPABASE_URL = 'https://toqerqtcnlkvdawrkkqh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_h0QPEEIba4IaVl6HtEEiLg_z0WQthRk';

function createCustomFetch(apiKey) {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (headers.get('Authorization') === `Bearer ${apiKey}`) {
      headers.delete('Authorization');
    }
    headers.set('apikey', apiKey);
    return fetch(input, { ...init, headers });
  };
}

async function verifyLogoAndEmailFlow() {
  console.log("=== STEP 1: ANONYMOUS UPLOAD SECURITY CHECK ===");
  const anonClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { fetch: createCustomFetch(SUPABASE_KEY) }
  });

  const samplePngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const imageBuffer = Buffer.from(samplePngBase64, 'base64');
  const anonPath = `6d00d671-eaea-47ce-a842-f970878373c9/anon_test.png`;
  
  const { error: anonErr } = await anonClient.storage.from('menu-images').upload(anonPath, imageBuffer, { contentType: 'image/png' });
  console.log("✓ Anonymous upload result:", anonErr?.message);
  if (!anonErr || !anonErr.message.includes("row-level security policy")) {
    console.error("FAIL: Anonymous upload was NOT rejected by RLS policy!");
    process.exit(1);
  }
  console.log("✓ Anonymous upload properly DENIED by Storage RLS policy!");

  console.log("\n=== STEP 2: AUTHENTICATING OWNER SESSION ===");
  const ownerClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { fetch: createCustomFetch(SUPABASE_KEY) }
  });

  const { data: authData, error: authErr } = await ownerClient.auth.signInWithPassword({
    email: 'bedantarya0342@gmail.com',
    password: 'password123'
  });

  if (authErr) {
    console.error("Owner authentication failed:", authErr);
    process.exit(1);
  }
  console.log("✓ Owner Auth Success! User ID:", authData.user?.id);

  // Fetch Cheese Corner cafe details
  const { data: cafeBefore, error: cafeErr } = await ownerClient
    .from('cafes')
    .select('id, name, slug, logo_url, email')
    .eq('slug', 'cheesecorner')
    .single();

  console.log("Cheese Corner Cafe ID:", cafeBefore.id);

  console.log("\n=== STEP 3: CROSS-CAFE & ROLE SECURITY BOUNDARY TESTS ===");
  const otherCafeId = '11111111-2222-3333-4444-555555555555';
  const crossCafePath = `${otherCafeId}/logo_cross.png`;

  const { error: crossCafeErr } = await ownerClient.storage.from('menu-images').upload(crossCafePath, imageBuffer, { contentType: 'image/png' });
  console.log("✓ Cross-cafe upload (Owner Cafe A -> Cafe B path) result:", crossCafeErr?.message);
  if (!crossCafeErr || !crossCafeErr.message.includes("row-level security policy")) {
    console.error("FAIL: Cross-cafe upload was NOT rejected!");
    process.exit(1);
  }
  console.log("✓ Cross-cafe upload properly DENIED by Storage RLS policy!");

  console.log("\n=== STEP 4: AUTHENTICATED OWNER LOGO UPLOAD ===");
  const uniqueUuid = 'logo_' + Date.now();
  const storageRelativePath = `${cafeBefore.id}/${uniqueUuid}.png`;
  const fullLogoUrl = `menu-images/${storageRelativePath}`;

  console.log("Target Storage Path:", storageRelativePath);
  console.log("Target Full logo_url:", fullLogoUrl);

  const { data: uploadData, error: uploadErr } = await ownerClient
    .storage
    .from('menu-images')
    .upload(storageRelativePath, imageBuffer, {
      contentType: 'image/png',
      upsert: false
    });

  if (uploadErr) {
    console.error("Owner Upload Error:", uploadErr);
    process.exit(1);
  }
  console.log("✓ Authenticated Owner Storage Upload SUCCESS!", uploadData);

  console.log("\n=== STEP 5: UPDATE public.cafes.logo_url ===");
  const { error: updateLogoErr } = await ownerClient
    .from('cafes')
    .update({ logo_url: fullLogoUrl })
    .eq('id', cafeBefore.id);

  if (updateLogoErr) {
    console.error("Update cafes.logo_url failed:", updateLogoErr);
    process.exit(1);
  }
  console.log("✓ cafes.logo_url update SUCCESS!");

  console.log("\n=== STEP 6: VERIFY DATABASE STATE AFTER UPLOAD ===");
  const { data: cafeAfter, error: cafeRequeryErr } = await ownerClient
    .from('cafes')
    .select('id, name, logo_url, email')
    .eq('slug', 'cheesecorner')
    .single();

  if (cafeRequeryErr) {
    console.error("Requery cafes failed:", cafeRequeryErr);
    process.exit(1);
  }

  console.log("Requeried public.cafes record:", cafeAfter);
  if (cafeAfter.logo_url !== fullLogoUrl) {
    console.error(`logo_url mismatch! Expected ${fullLogoUrl}, got ${cafeAfter.logo_url}`);
    process.exit(1);
  }
  console.log("✓ Exact public.cafes.logo_url value matches expected uploaded path!");

  console.log("\n=== STEP 7: VERIFY PUBLIC STORAGE ACCESS ===");
  const { data: pubUrlData } = ownerClient.storage.from('menu-images').getPublicUrl(storageRelativePath);
  console.log("Public Storage URL:", pubUrlData.publicUrl);

  const checkPublicAccess = await new Promise((resolve) => {
    https.get(pubUrlData.publicUrl, (res) => {
      resolve({ statusCode: res.statusCode, contentType: res.headers['content-type'] });
    }).on('error', (e) => resolve({ error: e.message }));
  });

  console.log("Public URL GET check result:", checkPublicAccess);
  if (checkPublicAccess.statusCode !== 200) {
    console.error("Public Storage URL did NOT return HTTP 200 OK!");
    process.exit(1);
  }
  console.log("✓ Storage object is publicly accessible (HTTP 200 OK)!");

  console.log("\n=== STEP 8: VERIFY EMAIL FLOW PERSISTENCE ===");
  const testEmail = "contact@cheesecorner.com";
  const { error: emailErr } = await ownerClient
    .from('cafes')
    .update({ email: testEmail })
    .eq('id', cafeBefore.id);

  if (emailErr) {
    console.error("Email update failed:", emailErr);
    process.exit(1);
  }

  const { data: cafeFinal, error: finalRequeryErr } = await ownerClient
    .from('cafes')
    .select('id, name, logo_url, email')
    .eq('slug', 'cheesecorner')
    .single();

  if (finalRequeryErr || cafeFinal.email !== testEmail) {
    console.error("Email persistence check failed:", finalRequeryErr, cafeFinal);
    process.exit(1);
  }
  console.log("✓ Email updated & persisted after refresh! Value:", cafeFinal.email);

  console.log("\n==================================================");
  console.log("FINAL LIVE PRODUCTION VERIFICATION COMPLETE: ALL PASSED");
  console.log("==================================================");
}

verifyLogoAndEmailFlow().catch((err) => {
  console.error("FATAL VERIFICATION ERROR:", err);
  process.exit(1);
});
