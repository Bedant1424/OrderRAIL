# OrderRail Trusted Printing & QZ Tray Request Signing Guide

This guide details the security architecture for OrderRail's local thermal printing infrastructure, including certificate generation, Windows trust installation, cafe deployment, certificate rotation, and key recovery procedures.

---

## 1. Overview & Security Architecture

To eliminate QZ Tray's default **"Untrusted Site / Signature Missing"** warning popups on POS workstations, OrderRail implements RSA 2048-bit digital request signing via Web Crypto / Node Crypto:

- **Certificate**: Self-signed X.509 Certificate (`ORDERRAIL_CERTIFICATE_PEM`).
- **Private Key**: RSA 2048-bit PKCS#8 Key (`ORDERRAIL_PRIVATE_KEY_PEM`).
- **Signature Algorithm**: RSASSA-PKCS1-v1_5 with SHA-256.
- **Promise Handlers**: Handled automatically in `src/lib/printing/qz.ts` via `qz.security.setCertificatePromise()` and `qz.security.setSignaturePromise()`.

```
[ OrderRail App ] ──► [ PrintService ] ──► [ QZTrayPrinter ]
                                                 │
                             ┌───────────────────┴───────────────────┐
                             │ Automatic RSA-SHA256 Digital Signing  │
                             └───────────────────┬───────────────────┘
                                                 ▼
[ Thermal Printer ] ◄── [ Local POS ] ◄── [ QZ Tray Client ] (Signature Verified)
```

---

## 2. Certificate Generation

OrderRail includes an automated script for generating or regenerating RSA 2048-bit keypairs and updating `keyManager.ts`.

### Command:
```bash
node scripts/generate-printing-cert.cjs
```

### Generated Artifacts:
- Private Key: RSA 2048-bit PKCS#8 PEM
- Certificate: Self-signed X.509 PEM
- Storage: Updated in `src/lib/printing/security/keyManager.ts`

---

## 3. Installing Certificate Trust on Windows Workstations

To allow QZ Tray to automatically accept OrderRail print requests without prompting the user on every print job:

### Step-by-Step Installation:
1. Export or copy the certificate PEM content from `src/lib/printing/security/keyManager.ts` and save it as `orderrail-root.crt`.
2. Double-click `orderrail-root.crt` on the target Windows machine.
3. Click **Install Certificate...**
4. Select **Local Machine** (requires Administrator privileges) and click **Next**.
5. Choose **Place all certificates in the following store**.
6. Click **Browse...** and select **Trusted Root Certification Authorities**.
7. Click **Next** -> **Finish**.
8. Restart QZ Tray service. QZ Tray will now report **Signature: Valid / Trusted** for all OrderRail print requests.

---

## 4. Deploying to Another Cafe Workstation

When onboarding a new restaurant workstation:

1. Install QZ Tray v2.2+ on the POS computer.
2. Copy `orderrail-root.crt` to the workstation.
3. Import `orderrail-root.crt` into the Windows **Trusted Root Certification Authorities** store as detailed above.
4. Launch OrderRail in Google Chrome / Edge.
5. Open **Owner Settings -> Advanced -> Printing Diagnostic Tool**.
6. Click **Connect** and verify that QZ Tray displays:
   - Certificate Loaded: `Yes (OrderRail CA)`
   - Signing Enabled: `True`
   - Connection Status: `Connected`
7. Click **Print Test Receipt** to verify signed printing on the POS-58 thermal printer.

---

## 5. Certificate Rotation Procedure

It is recommended to rotate printing certificates annually or whenever key compromise is suspected:

1. Run the generation script:
   ```bash
   node scripts/generate-printing-cert.cjs
   ```
2. Commit and deploy the updated application build.
3. Export the new certificate PEM to `orderrail-root-v2.crt`.
4. Install the new certificate into Windows **Trusted Root Certification Authorities** on all cafe POS machines.
5. Remove the deprecated certificate from the Windows Certificate Manager (`certmgr.msc`).

---

## 6. Recovery Procedure (Lost Private Key)

If the private key is lost or corrupted:

1. Immediately run:
   ```bash
   node scripts/generate-printing-cert.cjs
   ```
2. Re-build and re-deploy OrderRail.
3. Remove the old certificate from `certmgr.msc` under `Trusted Root Certification Authorities`.
4. Import the newly generated certificate into `Trusted Root Certification Authorities`.
5. Open the Developer Printing Diagnostic page to verify `Certificate Loaded: Yes` and test receipt printing.
