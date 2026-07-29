import { ConnectionState } from '../models/ConnectionState';
import { DiscoveredPrinter, PrinterMappingConfig } from '../models/PrinterConfig';
import { PrintJob } from '../models/PrintJob';
import { QZTrayPrinter } from '../qz';
import { IPrintProvider } from './PrintProvider';

export class QZTrayProvider implements IPrintProvider {
  public readonly id = 'qz-tray';
  public readonly name = 'QZ Tray Production Thermal Driver';

  private printer: QZTrayPrinter;
  private config?: PrinterMappingConfig;

  constructor(printer?: QZTrayPrinter) {
    this.printer = printer || new QZTrayPrinter();
  }

  public async initialize(config?: PrinterMappingConfig): Promise<void> {
    this.config = config;
    if (typeof window !== 'undefined' && this.printer.isConnected()) {
      await this.printer.autoConnect().catch(() => {});
    }
  }

  public async connect(): Promise<void> {
    if (!this.printer.isConnected()) {
      await this.printer.connect();
    }
  }

  public async disconnect(): Promise<void> {
    if (this.printer.isConnected()) {
      await this.printer.disconnect().catch(() => {});
    }
  }

  public getConnectionState(): ConnectionState {
    return this.printer.isConnected() ? 'CONNECTED' : 'DISCONNECTED';
  }

  public async discoverPrinters(): Promise<DiscoveredPrinter[]> {
    try {
      const list = await this.printer.listPrinters();
      const defaultPrinter = await this.printer.getDefaultPrinter();
      return list.map((name) => ({
        name,
        isDefault: name === defaultPrinter,
        connectionType: 'USB',
      }));
    } catch {
      return [];
    }
  }

  public async print(job: PrintJob): Promise<boolean> {
    if (!this.printer.isConnected()) {
      await this.printer.connect();
    }

    const payload = job.payload;
    const targetPrinter = await this.resolveDestinationPrinter(job.destination);

    if (payload.escpos) {
      await this.printer.printRaw(payload.escpos, targetPrinter);
      return true;
    }

    if (payload.formattedText) {
      await this.printer.printRaw(payload.formattedText, targetPrinter);
      return true;
    }

    await this.printer.printTest(targetPrinter);
    return true;
  }

  public async testPrint(destination?: PrintJob['destination']): Promise<boolean> {
    const targetPrinter = await this.resolveDestinationPrinter(destination);
    await this.printer.printTest(targetPrinter);
    return true;
  }

  public async dispose(): Promise<void> {
    await this.disconnect();
  }

  private async resolveDestinationPrinter(destination?: PrintJob['destination']): Promise<string | undefined> {
    let configuredName: string | undefined = undefined;

    if (destination === 'KOT_PRINTER' && this.config?.kotPrinterName) {
      configuredName = this.config.kotPrinterName;
    } else if (destination === 'BILL_PRINTER' && this.config?.billPrinterName) {
      configuredName = this.config.billPrinterName;
    } else if (destination === 'DEFAULT_PRINTER' && this.config?.defaultPrinterName) {
      configuredName = this.config.defaultPrinterName;
    } else if (typeof destination === 'string' && destination !== 'DEFAULT_PRINTER' && destination !== 'KOT_PRINTER' && destination !== 'BILL_PRINTER') {
      configuredName = destination;
    }

    // Check if user selected a last-used printer in localStorage
    const restored = typeof localStorage !== 'undefined' ? localStorage.getItem('orderrail_last_used_printer') : null;
    if (restored && restored !== 'Default Printer' && restored.trim() !== '') {
      configuredName = restored;
    }

    // If configured printer is undefined, empty string, or placeholder "Default Printer"
    const isPlaceholder = !configuredName || configuredName.trim() === '' || configuredName === 'Default Printer';

    if (isPlaceholder) {
      try {
        const osDefault = await this.printer.getDefaultPrinter();
        if (osDefault) {
          console.log(`[QZTrayProvider] Placeholder "${configuredName || 'undefined'}" resolved to OS Default Printer: "${osDefault}"`);
          return osDefault;
        }
      } catch (err) {
        console.warn('[QZTrayProvider] Could not resolve OS default printer:', err);
      }
      return undefined;
    }

    console.log(`[QZTrayProvider] Configured target printer: "${configuredName}"`);
    return configuredName;
  }
}
