/**
 * OrderRail Request Signer
 * 
 * Performs RSA-SHA256 digital signature creation for QZ Tray request signing.
 * Converts QZ Tray `toSign` string into a Base64-encoded digital signature using
 * the private key stored in KeyManager.
 */

import { KeyManager } from "./keyManager";
import { PrintFailed } from "../types";

let cachedCryptoKey: CryptoKey | null = null;
let cachedKeyPem: string | null = null;

/**
 * Converts a Base64 string to Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts ArrayBuffer to Base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Imports a PKCS#8 PEM private key string into a WebCrypto CryptoKey object.
 */
async function getCryptoKey(privateKeyPem: string): Promise<CryptoKey> {
  if (cachedCryptoKey && cachedKeyPem === privateKeyPem) {
    return cachedCryptoKey;
  }

  const cleanPem = privateKeyPem
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  const binaryDer = base64ToUint8Array(cleanPem);

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new PrintFailed("Web Crypto API (crypto.subtle) is not supported in this environment.");
  }

  const importedKey = await subtle.importKey(
    "pkcs8",
    binaryDer.buffer as ArrayBuffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"]
  );

  cachedCryptoKey = importedKey;
  cachedKeyPem = privateKeyPem;
  return importedKey;
}

/**
 * Digitally signs a message using RSA-SHA256 and returns a Base64-encoded signature.
 */
export async function signMessage(toSign: string): Promise<string> {
  try {
    const keyPem = KeyManager.getPrivateKeyPem();
    if (!keyPem) {
      throw new PrintFailed("Private key is missing or not configured.");
    }

    // Node.js fallback if WebCrypto is unavailable in test environment
    if (typeof process !== "undefined" && process.versions?.node && !globalThis.crypto?.subtle) {
      const nodeCrypto = await import("crypto");
      const sign = nodeCrypto.createSign("SHA256");
      sign.update(toSign);
      sign.end();
      return sign.sign(keyPem, "base64");
    }

    const cryptoKey = await getCryptoKey(keyPem);
    const data = new TextEncoder().encode(toSign);

    const signatureBuffer = await globalThis.crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      data
    );

    return arrayBufferToBase64(signatureBuffer);
  } catch (error: any) {
    console.error("[Printing] Security signing error:", error);
    throw new PrintFailed(`Failed to sign QZ Tray request: ${error?.message || String(error)}`);
  }
}
