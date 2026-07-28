import qz from "qz-tray";
import type { Printer, PrinterDriverType } from "./types";
import { ConnectionFailed, PrinterNotFound, PrintFailed } from "./types";
import { PRINTING_CONSTANTS, ESC_POS } from "./constants";
import { getCertificate } from "./security/certificate";
import { signMessage } from "./security/signature";

export class QZTrayPrinter implements Printer {
  public readonly driverType: PrinterDriverType = "QZ_TRAY";
  private reconnecting = false;

  constructor() {
    this.setupSecurityPromises();
    this.setupAutoReconnect();
  }

  /**
   * Configures QZ Tray security certificate, signature, and algorithm promises.
   */
  private setupSecurityPromises(): void {
    console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} [FORENSIC Audit 1 & 3] Checking qz.security availability:`, !!qz?.security);

    if (!qz?.security) {
      console.error(`${PRINTING_CONSTANTS.LOG_PREFIX} [FORENSIC Audit 3 FAIL] qz.security is NOT available at runtime!`);
      return;
    }

    try {
      // 1. Set Signature Algorithm to SHA256 (QZ Tray 2.2+ default is SHA1 unless overridden)
      if (typeof qz.security.setSignatureAlgorithm === "function") {
        qz.security.setSignatureAlgorithm("SHA256");
        console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} [FORENSIC Audit] Signature algorithm set to SHA256. Active algorithm:`, qz.security.getSignatureAlgorithm());
      } else {
        console.warn(`${PRINTING_CONSTANTS.LOG_PREFIX} [FORENSIC Audit] setSignatureAlgorithm method missing on qz.security.`);
      }

      // 2. Register Certificate Promise
      console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} [FORENSIC Audit 4] Registering setCertificatePromise...`);
      qz.security.setCertificatePromise((resolve: (cert: string) => void, reject: (reason: any) => void) => {
        console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} Certificate callback entered`);
        try {
          const cert = getCertificate();
          console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} Certificate returned (length: ${cert?.length || 0}):`, cert ? cert.substring(0, 40) + "..." : "EMPTY");
          resolve(cert);
        } catch (err: any) {
          console.error(`${PRINTING_CONSTANTS.LOG_PREFIX} Certificate callback exception:`, err);
          reject(err);
        }
      });
      console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} [FORENSIC Audit 4 SUCCESS] setCertificatePromise registered successfully.`);

      // 3. Register Signature Promise
      console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} [FORENSIC Audit 5] Registering setSignaturePromise...`);
      qz.security.setSignaturePromise((toSign: string) => {
        return (resolve: (signature: string) => void, reject: (reason: any) => void) => {
          console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} Signature callback entered`);
          console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} Message to sign:`, toSign);
          signMessage(toSign)
            .then((sig) => {
              console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} Signature generated (length: ${sig?.length || 0}):`, sig ? sig.substring(0, 30) + "..." : "EMPTY");
              console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} Signature length:`, sig?.length || 0);
              resolve(sig);
            })
            .catch((err: any) => {
              console.error(`${PRINTING_CONSTANTS.LOG_PREFIX} Signature callback exception stack trace:`, err?.stack || err);
              reject(err);
            });
        };
      });
      console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} [FORENSIC Audit 5 SUCCESS] setSignaturePromise registered successfully.`);
    } catch (err: any) {
      console.error(`${PRINTING_CONSTANTS.LOG_PREFIX} [FORENSIC Audit FAIL] Exception during setupSecurityPromises:`, err?.stack || err);
    }
  }

  /**
   * Sets up QZ Tray connection error handlers to auto-reconnect if dropped.
   */
  private setupAutoReconnect(): void {
    if (!qz?.websocket) return;

    if (typeof qz.websocket.setClosedCallback === "function") {
      qz.websocket.setClosedCallback((evt: any) => {
        console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} QZ Tray connection closed:`, evt);
        void this.attemptAutoReconnect();
      });
    }

    if (typeof qz.websocket.setErrorCallback === "function") {
      qz.websocket.setErrorCallback((evt: any) => {
        console.error(`${PRINTING_CONSTANTS.LOG_PREFIX} QZ Tray error:`, evt);
      });
    }
  }

  private async attemptAutoReconnect(): Promise<void> {
    if (this.reconnecting) return;
    this.reconnecting = true;

    console.group(`${PRINTING_CONSTANTS.LOG_PREFIX} Auto-Reconnecting to QZ Tray...`);
    for (let attempt = 1; attempt <= PRINTING_CONSTANTS.RECONNECT_ATTEMPTS; attempt++) {
      try {
        console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} Reconnection attempt ${attempt}/${PRINTING_CONSTANTS.RECONNECT_ATTEMPTS}`);
        await new Promise((res) => setTimeout(res, PRINTING_CONSTANTS.RECONNECT_DELAY_MS));
        await this.connect();
        console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} Reconnected successfully.`);
        console.groupEnd();
        this.reconnecting = false;
        return;
      } catch (err) {
        console.warn(`${PRINTING_CONSTANTS.LOG_PREFIX} Reconnection attempt ${attempt} failed:`, err);
      }
    }
    console.groupEnd();
    this.reconnecting = false;
  }

  public isConnected(): boolean {
    try {
      return qz.websocket.isActive();
    } catch {
      return false;
    }
  }

  public async connect(): Promise<void> {
    if (this.isConnected()) return;

    console.group(`${PRINTING_CONSTANTS.LOG_PREFIX} Connecting to QZ Tray`);
    try {
      console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} [FORENSIC Audit 2] Guaranteeing setupSecurityPromises before qz.websocket.connect()...`);
      this.setupSecurityPromises();
      await qz.websocket.connect({ retries: 2, delay: 1 });
      console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} QZ Tray WebSocket active.`);
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error(`${PRINTING_CONSTANTS.LOG_PREFIX} Failed to connect:`, msg);
      throw new ConnectionFailed(msg);
    } finally {
      console.groupEnd();
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected()) return;

    console.group(`${PRINTING_CONSTANTS.LOG_PREFIX} Disconnecting QZ Tray`);
    try {
      await qz.websocket.disconnect();
      console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} Disconnected from QZ Tray.`);
    } catch (error: any) {
      console.warn(`${PRINTING_CONSTANTS.LOG_PREFIX} Disconnect notice:`, error?.message || error);
    } finally {
      console.groupEnd();
    }
  }

  public async listPrinters(): Promise<string[]> {
    await this.ensureConnection();
    console.group(`${PRINTING_CONSTANTS.LOG_PREFIX} Discovering Printers`);
    try {
      const printers = await qz.printers.find();
      const list = Array.isArray(printers) ? printers : printers ? [printers] : [];
      console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} Found ${list.length} printer(s):`, list);
      return list;
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error(`${PRINTING_CONSTANTS.LOG_PREFIX} Failed to list printers:`, msg);
      throw new PrinterNotFound(msg);
    } finally {
      console.groupEnd();
    }
  }

  public async getDefaultPrinter(): Promise<string | null> {
    await this.ensureConnection();
    console.group(`${PRINTING_CONSTANTS.LOG_PREFIX} Querying Default Printer`);
    try {
      const defaultPrinter = await qz.printers.getDefault();
      console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} Default Printer:`, defaultPrinter);
      return defaultPrinter || null;
    } catch (error: any) {
      console.warn(`${PRINTING_CONSTANTS.LOG_PREFIX} No default printer found:`, error?.message || error);
      return null;
    } finally {
      console.groupEnd();
    }
  }

  public async printTest(targetPrinterName?: string): Promise<void> {
    await this.ensureConnection();

    let targetPrinter = targetPrinterName;
    if (!targetPrinter) {
      targetPrinter = (await this.getDefaultPrinter()) || undefined;
    }

    if (!targetPrinter) {
      throw new PrinterNotFound("No default or target printer available for test print.");
    }

    console.group(`${PRINTING_CONSTANTS.LOG_PREFIX} Executing Test Print on "${targetPrinter}"`);

    try {
      const now = new Date();
      const currentDateStr = now.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const currentTimeStr = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      // ESC/POS Plain Text Payload formatted for POS-58 Series (32 cols width)
      const rawPayload = [
        ESC_POS.INIT,
        ESC_POS.ALIGN_CENTER,
        "--------------------------------\n",
        ESC_POS.BOLD_ON,
        "OrderRail Printer Test\n",
        ESC_POS.BOLD_OFF,
        "Printer Connected Successfully\n\n",
        `Date: ${currentDateStr}\n`,
        `Time: ${currentTimeStr}\n\n`,
        "Thank you.\n",
        "--------------------------------\n",
        ESC_POS.LINE_FEED,
        ESC_POS.LINE_FEED,
        ESC_POS.FEED_AND_CUT,
      ];

      const config = qz.configs.create(targetPrinter, {
        encoding: "ISO-8859-1",
      });

      const printData = [
        {
          type: "raw",
          format: "command",
          flavor: "plain",
          data: rawPayload.join(""),
        },
      ];

      await qz.print(config, printData);
      console.log(`${PRINTING_CONSTANTS.LOG_PREFIX} Test receipt sent successfully to "${targetPrinter}".`);
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error(`${PRINTING_CONSTANTS.LOG_PREFIX} Test print failed:`, msg);
      throw new PrintFailed(msg);
    } finally {
      console.groupEnd();
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected()) {
      await this.connect();
    }
  }
}
