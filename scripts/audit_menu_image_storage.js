import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function getEnv(key) {
  for (const file of ['.env.local', '.env']) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith(`${key}=`)) {
          return trimmed.slice(`${key}=`.length).replace(/^["']|["']$/g, '');
        }
      }
    } catch (e) {}
  }
  return '';
}

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || 'https://xkhuhxvxqlyjytndgxvg.supabase.co';
const SUPABASE_KEY = getEnv('VITE_SUPABASE_PUBLISHABLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testAllImagesParallel() {
  const { data: items, error } = await supabase
    .from("menu_items")
    .select("id, name, image_url")
    .not("image_url", "is", null);

  if (error) {
    console.error("DB Query error:", error);
    return;
  }

  console.log(`Total menu items with image_url: ${items?.length}`);

  const results = await Promise.all(
    (items || []).map(async (item) => {
      if (!item.image_url?.startsWith("menu-images/")) {
        return { item, status: "non-storage", ok: true };
      }
      const storagePath = item.image_url.slice("menu-images/".length);
      const { data } = supabase.storage.from("menu-images").getPublicUrl(storagePath);
      try {
        const res = await fetch(data.publicUrl, { method: 'HEAD' });
        return { item, status: res.status, ok: res.ok, publicUrl: data.publicUrl };
      } catch (e) {
        return { item, status: "error", ok: false, error: e.message };
      }
    })
  );

  const okCount = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;

  console.log(`=== PARALLEL AUDIT RESULTS ===`);
  console.log(`Successful 200 OK: ${okCount}`);
  console.log(`Failed / Missing: ${failCount}`);
  const failed = results.filter(r => !r.ok);
  if (failed.length > 0) {
    console.log("Sample failed items:", failed.slice(0, 5));
  }
}

testAllImagesParallel().catch(console.error);
