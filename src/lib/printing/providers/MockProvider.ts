import { ConnectionState } from '../models/ConnectionState';
import { DiscoveredPrinter, PrinterMappingConfig } from '../models/PrinterConfig';
import { PrintJob } from '../models/PrintJob';
import { IPrintProvider } from './PrintProvider';

export interface MockProviderOptions {
  simulatedDelayMs?: number;
  shouldFailNextJob?: boolean;
  failureMessage?: string;
  useBrowserPrintFallback?: boolean;
}

export class MockProvider implements IPrintProvider {
  public readonly id = 'mock-provider';
  public readonly name = 'Development Mock Provider';

  private connectionState: ConnectionState = 'DISCONNECTED';
  private options: MockProviderOptions;
  private config?: PrinterMappingConfig;

  constructor(options: MockProviderOptions = {}) {
    this.options = {
      simulatedDelayMs: 50,
      shouldFailNextJob: false,
      failureMessage: 'Simulated printer hardware failure',
      useBrowserPrintFallback: false,
      ...options,
    };
  }

  public async initialize(config?: PrinterMappingConfig): Promise<void> {
    this.config = config;
    await this.connect();
  }

  public async connect(): Promise<void> {
    this.connectionState = 'CONNECTING';
    if (this.options.simulatedDelayMs) {
      await new Promise((r) => setTimeout(r, Math.min(20, this.options.simulatedDelayMs!)));
    }
    this.connectionState = 'CONNECTED';
  }

  public async disconnect(): Promise<void> {
    this.connectionState = 'DISCONNECTED';
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public async discoverPrinters(): Promise<DiscoveredPrinter[]> {
    return [
      { name: 'Mock KOT Thermal Printer (80mm)', isDefault: true, connectionType: 'USB' },
      { name: 'Mock Counter Bill Printer (80mm)', isDefault: false, connectionType: 'USB' },
      { name: 'Mock Kitchen Station Printer (80mm)', isDefault: false, connectionType: 'NETWORK' },
    ];
  }

  public setShouldFailNextJob(shouldFail: boolean, message?: string): void {
    this.options.shouldFailNextJob = shouldFail;
    if (message) this.options.failureMessage = message;
  }

  public async print(job: PrintJob): Promise<boolean> {
    if (this.connectionState !== 'CONNECTED') {
      throw new Error('MockProvider is disconnected. Call connect() first.');
    }

    if (this.options.simulatedDelayMs) {
      await new Promise((r) => setTimeout(r, this.options.simulatedDelayMs));
    }

    if (this.options.shouldFailNextJob) {
      this.options.shouldFailNextJob = false; // Reset one-shot trigger
      throw new Error(this.options.failureMessage || 'Mock print job failed');
    }

    console.log(`[MockProvider] Print Job ${job.id} (${job.type}) executed for destination "${job.destination}"`, job.payload);

    return true;
  }

  public async testPrint(destination?: PrintJob['destination']): Promise<boolean> {
    const dummyJob: PrintJob = {
      id: `test-${Date.now()}`,
      type: 'TEST',
      destination: destination || 'DEFAULT_PRINTER',
      payload: {
        type: 'TEST',
        timestamp: new Date().toISOString(),
        message: 'OrderRail Development Mock Test Print',
      },
      status: 'QUEUED',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.print(dummyJob);
  }

  public async dispose(): Promise<void> {
    await this.disconnect();
  }
}
