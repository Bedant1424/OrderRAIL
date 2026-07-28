import type { Printer } from "./types";
import { QZTrayPrinter } from "./qz";
import { PRINTING_CONSTANTS } from "./constants";

/**
 * Singleton PrintService Abstraction
 * OrderRail components and services interact exclusively with this service.
 * Supports hot-swapping printer drivers (QZ Tray, LAN, USB, Cloud) for future-proofing.
 */
export class PrintService implements Printer {
  private static instance: PrintService;
  private driver: Printer;

  public get driverType() {
    return this.driver.driverType;
  }

  constructor(driver?: Printer) {
    this.driver = driver || new QZTrayPrinter();
  }

  /**
   * Singleton instance accessor
   */
  public static getInstance(driver?: Printer): PrintService {
    if (!PrintService.instance) {
      PrintService.instance = new PrintService(driver);
    }
    return PrintService.instance;
  }

  /**
   * Hot-swaps the underlying printer driver (e.g., QZTrayPrinter -> LANPrinter)
   */
  public setDriver(driver: Printer): void {
    console.log(
      `${PRINTING_CONSTANTS.LOG_PREFIX} Swapping driver to: ${driver.driverType}`
    );
    this.driver = driver;
  }

  /**
   * Returns the current printer driver instance
   */
  public getDriver(): Printer {
    return this.driver;
  }

  public isConnected(): boolean {
    return this.driver.isConnected();
  }

  public async connect(): Promise<void> {
    return this.driver.connect();
  }

  public async disconnect(): Promise<void> {
    return this.driver.disconnect();
  }

  public async listPrinters(): Promise<string[]> {
    return this.driver.listPrinters();
  }

  public async getDefaultPrinter(): Promise<string | null> {
    return this.driver.getDefaultPrinter();
  }

  public async printTest(printerName?: string): Promise<void> {
    return this.driver.printTest(printerName);
  }
}

/**
 * Default Singleton Export for OrderRail Application
 */
export const printService = PrintService.getInstance();
