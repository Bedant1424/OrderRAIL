/**
 * OrderRail Certificate Provider
 * 
 * Provides the X.509 Certificate PEM string and diagnostics info for QZ Tray setup.
 */

import { KeyManager } from "./keyManager";

export function getCertificate(): string {
  return KeyManager.getCertificatePem();
}

export function getCertificateFingerprint(): string {
  return KeyManager.getFingerprint();
}

export function isCertificateValid(): boolean {
  return KeyManager.isCertificateLoaded();
}
