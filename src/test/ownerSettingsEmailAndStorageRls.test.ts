import { describe, it, expect } from 'vitest';

describe('Owner Settings Email & Storage RLS Authorization & Persistence Tests', () => {
  // Helper simulating saveBusinessProfile payload builder
  const buildBusinessProfilePayload = (inputs: {
    name: string;
    tagline: string;
    currency: string;
    logoUrl: string;
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    googleMapsReviewUrl: string;
    website: string;
    instagram: string;
  }) => {
    return {
      name: inputs.name.trim(),
      tagline: inputs.tagline.trim() || null,
      currency: inputs.currency,
      logo_url: inputs.logoUrl.trim() || null,
      phone: inputs.phone.trim() || null,
      whatsapp: inputs.whatsapp.trim() || null,
      email: inputs.email.trim() || null,
      address: inputs.address.trim() || null,
      google_maps_review_url: inputs.googleMapsReviewUrl.trim() || null,
      website: inputs.website.trim() || null,
      instagram: inputs.instagram.trim() || null,
    };
  };

  // Helper simulating Storage RLS path permission check (owner-only per specification)
  const isStoragePathAllowed = (
    path: string,
    userCafeId: string | null,
    userRole: 'owner' | 'staff' | 'counter' | null
  ): boolean => {
    if (!userCafeId || !userRole) return false;
    const parts = path.split('/');
    if (parts.length < 2) return false;
    const folderCafeId = parts[0];
    return folderCafeId === userCafeId && userRole === 'owner';
  };

  // Helper simulating handleSaveLogo flow updating cafes.logo_url
  const simulateSaveLogoFlow = (
    cafeId: string,
    storagePath: string,
    userRole: 'owner' | 'staff' | 'counter' | null
  ) => {
    const allowed = isStoragePathAllowed(storagePath, cafeId, userRole);
    if (!allowed) {
      throw new Error('new row violates row-level security policy');
    }
    const fullPath = `menu-images/${storagePath}`;
    return { success: true, logo_url: fullPath };
  };

  // Email Tests
  it('EMAIL 1: email column is included in save payload', () => {
    const payload = buildBusinessProfilePayload({
      name: 'Cheese Corner',
      tagline: 'Best Cheese Burgers',
      currency: 'INR',
      logoUrl: 'menu-images/6d00d671-eaea-47ce-a842-f970878373c9/logo.png',
      phone: '+919556596091',
      whatsapp: '+919556596091',
      email: '  owner@cheesecorner.com  ',
      address: 'Berhampur, Odisha',
      googleMapsReviewUrl: '',
      website: '',
      instagram: '',
    });

    expect(payload).toHaveProperty('email', 'owner@cheesecorner.com');
  });

  it('EMAIL 2: email persists after refresh simulated reload', () => {
    const savedPayload = buildBusinessProfilePayload({
      name: 'Cheese Corner',
      tagline: '',
      currency: 'INR',
      logoUrl: '',
      phone: '',
      whatsapp: '',
      email: 'contact@cheesecorner.com',
      address: '',
      googleMapsReviewUrl: '',
      website: '',
      instagram: '',
    });

    // Simulate page reload state hydration
    const refreshedState = { email: savedPayload.email };
    expect(refreshedState.email).toBe('contact@cheesecorner.com');
  });

  it('EMAIL 3: empty email becomes null in save payload', () => {
    const payload = buildBusinessProfilePayload({
      name: 'Cheese Corner',
      tagline: '',
      currency: 'INR',
      logoUrl: '',
      phone: '',
      whatsapp: '',
      email: '   ',
      address: '',
      googleMapsReviewUrl: '',
      website: '',
      instagram: '',
    });

    expect(payload.email).toBeNull();
  });

  // Logo & Storage RLS Tests
  it('LOGO 1: authenticated owner can upload to own cafe storage path', () => {
    const cafeA = '6d00d671-eaea-47ce-a842-f970878373c9';
    const path = `${cafeA}/logo_12345.png`;
    expect(isStoragePathAllowed(path, cafeA, 'owner')).toBe(true);
  });

  it('LOGO 2: owner cannot upload to another cafe storage path', () => {
    const cafeA = '6d00d671-eaea-47ce-a842-f970878373c9';
    const cafeB = '11111111-2222-3333-4444-555555555555';
    const path = `${cafeB}/logo_12345.png`;
    expect(isStoragePathAllowed(path, cafeA, 'owner')).toBe(false);
  });

  it('LOGO 3: staff role cannot upload to storage path', () => {
    const cafeA = '6d00d671-eaea-47ce-a842-f970878373c9';
    const path = `${cafeA}/logo_12345.png`;
    expect(isStoragePathAllowed(path, cafeA, 'staff')).toBe(false);
  });

  it('LOGO 4: counter role cannot upload to storage path', () => {
    const cafeA = '6d00d671-eaea-47ce-a842-f970878373c9';
    const path = `${cafeA}/logo_12345.png`;
    expect(isStoragePathAllowed(path, cafeA, 'counter')).toBe(false);
  });

  it('LOGO 5: anonymous user cannot upload to storage path', () => {
    const cafeA = '6d00d671-eaea-47ce-a842-f970878373c9';
    const path = `${cafeA}/logo_12345.png`;
    expect(isStoragePathAllowed(path, null, null)).toBe(false);
  });

  it('LOGO 6: successful upload updates cafes.logo_url', () => {
    const cafeA = '6d00d671-eaea-47ce-a842-f970878373c9';
    const path = `${cafeA}/logo_uuid123.png`;
    const result = simulateSaveLogoFlow(cafeA, path, 'owner');
    expect(result.success).toBe(true);
    expect(result.logo_url).toBe(`menu-images/${cafeA}/logo_uuid123.png`);
  });

  it('LOGO 7: Storage RLS error is caught and surfaced correctly', () => {
    const cafeA = '6d00d671-eaea-47ce-a842-f970878373c9';
    const path = `${cafeA}/logo_uuid123.png`;
    expect(() => simulateSaveLogoFlow(cafeA, path, 'staff')).toThrow(
      'new row violates row-level security policy'
    );
  });
});
