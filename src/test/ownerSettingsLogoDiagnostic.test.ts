import { describe, it, expect } from 'vitest';

describe('Owner Settings Logo Upload Diagnostic Error Extraction', () => {
  const formatLogoErrorMessage = (e: any): string => {
    return (
      e?.message ||
      e?.error_description ||
      'Unable to save logo.'
    );
  };

  it('1. Extracts exact error message from StorageApiError object', () => {
    const errorObj = { message: 'Bucket menu-images not found' };
    expect(formatLogoErrorMessage(errorObj)).toBe('Bucket menu-images not found');
  });

  it('2. Extracts error_description if message is missing', () => {
    const errorObj = { error_description: 'Row-level security policy violation' };
    expect(formatLogoErrorMessage(errorObj)).toBe('Row-level security policy violation');
  });

  it('3. Falls back to default string if error object is empty', () => {
    expect(formatLogoErrorMessage({})).toBe('Unable to save logo.');
    expect(formatLogoErrorMessage(null)).toBe('Unable to save logo.');
  });
});
