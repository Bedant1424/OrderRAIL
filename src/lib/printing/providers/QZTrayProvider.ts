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
    const targetPrinter = this.resolveDestinationPrinter(job.destination);

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
    const targetPrinter = this.resolveDestinationPrinter(destination);
    await this.printer.printTest(targetPrinter);
    return true;
  }

  public async dispose(): Promise<void> {
    await this.disconnect();
  }

  private resolveDestinationPrinter(destination?: PrintJob['destination']): string | undefined {
    if (!destination || !this.config) return undefined;
    if (destination === 'KOT_PRINTER' && this.config.kotPrinterName) {
      return this.config.kotPrinterName;
    }
    if (destination === 'BILL_PRINTER' && this.config.billPrinterName) {
      return this.config.billPrinterName;
    }
    if (typeof destination === 'string' && destination !== 'DEFAULT_PRINTER' && destination !== 'KOT_PRINTER' && destination !== 'BILL_PRINTER') {
      return destination;
    }
    return undefined;
  }
}
