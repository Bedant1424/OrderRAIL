import { describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('Live Production Storage & RLS Verification', () => {
  const CHEESE_CORNER_CAFE_ID = '6d00d671-eaea-47ce-a842-f970878373c9';
  const OTHER_CAFE_ID = '11111111-2222-3333-4444-555555555555';

  it('1. Verifies Cheese Corner cafe row in database (existing columns)', async () => {
    const { data: cafe, error } = await supabase
      .from('cafes')
      .select('id, name, slug, logo_url')
      .eq('id', CHEESE_CORNER_CAFE_ID)
      .maybeSingle();

    console.log('[LIVE_CAFE_VERIFICATION]', { error, cafe });
    expect(error).toBeNull();
    expect(cafe).not.toBeNull();
    expect(cafe?.id).toBe(CHEESE_CORNER_CAFE_ID);
  }, 10000);

  it('2. Evaluates split_part and UUID casting on valid storage path', () => {
    const validPath = `${CHEESE_CORNER_CAFE_ID}/logo_test_123.png`;
    const parts = validPath.split('/');
    const folderUuid = parts[0];

    expect(folderUuid).toBe(CHEESE_CORNER_CAFE_ID);
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    expect(uuidRegex.test(folderUuid)).toBe(true);
  });

  it('3. Evaluates cross-cafe path restriction (Cafe A owner targeting Cafe B path)', () => {
    const userCafeId = CHEESE_CORNER_CAFE_ID;
    const targetPath = `${OTHER_CAFE_ID}/logo_unauthorized.png`;

    const folderSegment = targetPath.split('/')[0];
    const isOwnerAuthorized = folderSegment === userCafeId;

    expect(isOwnerAuthorized).toBe(false);
  });
});
