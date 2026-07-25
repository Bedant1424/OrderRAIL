import qz from 'qz-tray';
import { ConnectionState } from '../models/ConnectionState';
import { DiscoveredPrinter, PrinterMappingConfig } from '../models/PrinterConfig';
import { PrintJob } from '../models/PrintJob';
import { IPrintProvider } from './PrintProvider';

export interface QZTrayProviderOptions {
  host?: string;
  usingSecure?: boolean;
  retries?: number;
  delayMs?: number;
}

export class QZTrayProvider implements IPrintProvider {
  public readonly id = 'qz-tray';
  public readonly name = 'QZ Tray Silent Print Provider';

  private connectionState: ConnectionState = 'DISCONNECTED';
  private config?: PrinterMappingConfig;
  private options: QZTrayProviderOptions;
  private isConnecting = false;

  constructor(options: QZTrayProviderOptions = {}) {
    this.options = {
      retries: options.retries ?? 1,
      delayMs: options.delayMs ?? 100,
      ...options,
    };
  }

  public async initialize(config?: PrinterMappingConfig): Promise<void> {
    this.config = config;
    try {
      await this.connect();
    } catch (err) {
      console.warn('[QZTrayProvider] Initial connection attempt notice:', err);
    }
  }

  public async connect(): Promise<void> {
    if (this.connectionState === 'CONNECTED' || (qz.websocket && qz.websocket.isActive())) {
      this.connectionState = 'CONNECTED';
      return;
    }

    if (this.isConnecting) return;
    this.isConnecting = true;
    this.connectionState = 'CONNECTING';

    try {
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect({
          host: this.options.host,
          usingSecure: this.options.usingSecure ?? true,
          retries: this.options.retries,
          delay: this.options.delayMs,
        });
      }
      this.connectionState = 'CONNECTED';
      this.isConnecting = false;
    } catch (err: any) {
      this.connectionState = 'ERROR';
      this.isConnecting = false;
      const errorMsg = err?.message || 'Failed to connect to QZ Tray daemon WSS endpoint.';
      console.error('[QZTrayProvider] Connection error:', errorMsg);
      throw new Error(`QZ Tray Connection Error: ${errorMsg}`);
    }
  }

  public async disconnect(): Promise<void> {
    if (qz.websocket && qz.websocket.isActive()) {
      await qz.websocket.disconnect();
    }
    this.connectionState = 'DISCONNECTED';
  }

  public isConnected(): boolean {
    return Boolean(qz.websocket && qz.websocket.isActive());
  }

  public getConnectionState(): ConnectionState {
    if (qz.websocket && qz.websocket.isActive()) {
      return 'CONNECTED';
    }
    return this.connectionState;
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      return this.isConnected();
    } catch {
      return false;
    }
  }

  public async discoverPrinters(): Promise<DiscoveredPrinter[]> {
    if (!this.isConnected()) {
      await this.connect();
    }

    try {
      const defaultPrinterName = await qz.printers.getDefault().catch(() => null);
      const printerList: string[] = await qz.printers.find();

      return printerList.map((name) => ({
        name,
        isDefault: defaultPrinterName ? name === defaultPrinterName : false,
        connectionType: 'USB',
      }));
    } catch (err: any) {
      console.error('[QZTrayProvider] discoverPrinters error:', err);
      throw new Error(`Printer Discovery Error: ${err?.message || 'Unable to discover printers via QZ Tray.'}`);
    }
  }

  public async testPrint(destination?: PrintJob['destination']): Promise<boolean> {
    if (!this.isConnected()) {
      await this.connect();
    }

    let targetPrinterName = this.config?.defaultPrinterName;
    if (destination === 'KOT_PRINTER' && this.config?.kotPrinterName) {
      targetPrinterName = this.config.kotPrinterName;
    } else if (destination === 'BILL_PRINTER' && this.config?.billPrinterName) {
      targetPrinterName = this.config.billPrinterName;
    }

    if (!targetPrinterName || targetPrinterName === 'Default Printer') {
      targetPrinterName = await qz.printers.getDefault().catch(() => undefined);
    }

    const testPayloadData = [
      '========================\n',
      '       ORDERRAIL        \n',
      '       TEST PRINT       \n',
      'Connection Successful   \n',
      '========================\n\n\n\n'
    ];

    try {
      const printConfig = qz.configs.create(targetPrinterName);
      await qz.print(printConfig, testPayloadData);
      return true;
    } catch (err: any) {
      console.error('[QZTrayProvider] testPrint error:', err);
      throw new Error(`QZ Tray Test Print Error: ${err?.message || 'Print execution failed.'}`);
    }
  }

  public async print(job: PrintJob): Promise<boolean> {
    if (!this.isConnected()) {
      await this.connect();
    }

    let targetPrinterName = this.config?.defaultPrinterName;
    if (job.destination === 'KOT_PRINTER' && this.config?.kotPrinterName) {
      targetPrinterName = this.config.kotPrinterName;
    } else if (job.destination === 'BILL_PRINTER' && this.config?.billPrinterName) {
      targetPrinterName = this.config.billPrinterName;
    }

    if (!targetPrinterName || targetPrinterName === 'Default Printer') {
      targetPrinterName = await qz.printers.getDefault().catch(() => undefined);
    }

    const printData = [
      `Job ID: ${job.id}\n`,
      `Type: ${job.type}\n`,
      `Destination: ${job.destination}\n`,
      `Payload: ${JSON.stringify(job.payload, null, 2)}\n\n\n`
    ];

    try {
      const printConfig = qz.configs.create(targetPrinterName);
      await qz.print(printConfig, printData);
      return true;
    } catch (err: any) {
      console.error('[QZTrayProvider] print error:', err);
      throw new Error(`QZ Tray Print Error: ${err?.message || 'Execution failed.'}`);
    }
  }

  public async dispose(): Promise<void> {
    await this.disconnect();
  }
}
