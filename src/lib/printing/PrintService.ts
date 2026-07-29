import { ConnectionState, PrinterStatusMeta } from './models/ConnectionState';
import { PrintPayloadData } from './models/Payload';
import { PrintJob, PrintJobType } from './models/PrintJob';
import { DEFAULT_PRINTER_CONFIG, LogicalPrinterDestination, PrinterMappingConfig } from './models/PrinterConfig';
import { IPrintProvider } from './providers/PrintProvider';
import { ProviderFactory, providerFactory, ProviderType } from './providers/ProviderFactory';
import { PrintQueue } from './queue/PrintQueue';

export type StatusListener = (status: PrinterStatusMeta) => void;

export class PrintService {
  private static instance: PrintService | null = null;

  private provider: IPrintProvider;
  private queue: PrintQueue;
  private config: PrinterMappingConfig;
  private listeners: Set<StatusListener> = new Set();

  private constructor(provider?: IPrintProvider, config?: PrinterMappingConfig) {
    this.config = config || DEFAULT_PRINTER_CONFIG;
    this.provider = provider || providerFactory.createProvider(undefined, this.config);
    this.queue = new PrintQueue();

    void this.provider.initialize(this.config).catch((err) => {
      console.warn('[PrintService] Provider initialization warning:', err);
    });
  }

  public static getInstance(): PrintService {
    if (!PrintService.instance) {
      PrintService.instance = new PrintService();
    }
    return PrintService.instance;
  }

  public static resetInstanceForTesting(provider?: IPrintProvider): PrintService {
    if (PrintService.instance) {
      void PrintService.instance.provider.dispose().catch(() => {});
    }
    ProviderFactory.resetInstanceForTesting();
    PrintService.instance = new PrintService(provider);
    return PrintService.instance;
  }

  public async setProvider(provider: IPrintProvider): Promise<void> {
    if (this.provider) {
      await this.provider.dispose().catch(() => {});
    }
    this.provider = provider;
    await this.provider.initialize(this.config);
    this.notifyStatusChange();
  }

  public async setDriver(driver: any): Promise<void> {
    if (driver && typeof driver.initialize === 'function') {
      await this.setProvider(driver);
    } else if (driver) {
      const adapterProvider: IPrintProvider = {
        id: driver.driverType || 'legacy-driver',
        name: driver.driverType || 'Legacy Driver',
        initialize: async () => {},
        connect: async () => driver.connect(),
        disconnect: async () => driver.disconnect(),
        getConnectionState: () => (driver.isConnected() ? 'CONNECTED' : 'DISCONNECTED'),
        discoverPrinters: async () => {
          const list = await driver.listPrinters();
          const def = await driver.getDefaultPrinter();
          return list.map((name: string) => ({
            name,
            isDefault: name === def,
            connectionType: 'USB',
          }));
        },
        print: async () => true,
        testPrint: async (dest) => {
          await driver.printTest(dest);
          return true;
        },
        dispose: async () => {},
      };
      if (typeof driver.autoConnect === 'function') {
        (adapterProvider as any).autoConnect = () => driver.autoConnect();
      }
      await this.setProvider(adapterProvider);
    }
  }

  public async setProviderType(type: ProviderType): Promise<void> {
    providerFactory.setActiveProviderType(type);
    const newProvider = providerFactory.createProvider(type, this.config);
    await this.setProvider(newProvider);
  }

  public getActiveProvider(): IPrintProvider {
    return this.provider;
  }

  public setConfig(config: PrinterMappingConfig): void {
    this.config = config;
    void this.provider.initialize(this.config);
  }

  public getConfig(): PrinterMappingConfig {
    return { ...this.config };
  }

  public getConnectionState(): ConnectionState {
    return this.provider ? this.provider.getConnectionState() : 'DISCONNECTED';
  }

  public getStatusMeta(): PrinterStatusMeta {
    return {
      state: this.getConnectionState(),
      activeProviderId: this.provider?.id || 'none',
      activeProviderName: this.provider?.name || 'No Provider Active',
    };
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatusMeta());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyStatusChange(): void {
    const meta = this.getStatusMeta();
    this.listeners.forEach((fn) => fn(meta));
  }

  /**
   * Enqueue a print job and process transactionally.
   * Resolves to { success: true } ONLY when provider resolves print success (COMPLETED / ACCEPTED).
   */
  public async enqueue(
    type: PrintJobType,
    destination: LogicalPrinterDestination,
    payload: PrintPayloadData,
    options: { orderId?: string; maxRetries?: number } = {}
  ): Promise<{ success: boolean; job: PrintJob }> {
    const now = new Date().toISOString();
    const job: PrintJob = {
      id: `job-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      destination,
      payload,
      status: 'QUEUED',
      orderId: options.orderId,
      retryCount: 0,
      maxRetries: options.maxRetries ?? 3,
      createdAt: now,
      updatedAt: now,
    };

    this.queue.enqueue(job);
    const success = await this.executeJob(job);
    return { success, job };
  }

  private async executeJob(job: PrintJob): Promise<boolean> {
    this.queue.updateStatus(job.id, 'SENDING');

    try {
      if (this.provider.getConnectionState() !== 'CONNECTED') {
        await this.provider.connect();
      }

      const accepted = await this.provider.print(job);
      if (accepted) {
        this.queue.updateStatus(job.id, 'COMPLETED');
        this.notifyStatusChange();
        return true;
      } else {
        throw new Error('Provider returned unaccepted print state');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Print processing failed';
      this.queue.updateStatus(job.id, 'FAILED', errMsg);
      this.notifyStatusChange();
      return false;
    }
  }

  public async retryJob(jobId: string): Promise<boolean> {
    const job = this.queue.getById(jobId);
    if (!job) {
      throw new Error(`PrintJob ${jobId} not found in queue`);
    }

    if (job.retryCount >= job.maxRetries) {
      throw new Error(`PrintJob ${jobId} exceeded maximum retry limit (${job.maxRetries})`);
    }

    this.queue.incrementRetry(jobId);
    job.status = 'QUEUED';
    return this.executeJob(job);
  }

  public getJobHistory(): PrintJob[] {
    return this.queue.getAll();
  }

  public getJobById(jobId: string): PrintJob | undefined {
    return this.queue.getById(jobId);
  }

  public clearQueue(): void {
    this.queue.clear();
  }

  // Provider Delegation & Driver Facade Methods
  public get driverType(): string {
    return this.provider ? this.provider.id : 'none';
  }

  public isConnected(): boolean {
    return this.provider ? this.provider.getConnectionState() === 'CONNECTED' : false;
  }

  public async connect(): Promise<void> {
    if (this.provider) {
      await this.provider.connect();
      this.notifyStatusChange();
    }
  }

  public async disconnect(): Promise<void> {
    if (this.provider) {
      await this.provider.disconnect();
      this.notifyStatusChange();
    }
  }

  public async autoConnect(): Promise<boolean> {
    if (!this.provider) return false;
    try {
      if ('autoConnect' in (this.provider as any) && typeof (this.provider as any).autoConnect === 'function') {
        const res = await (this.provider as any).autoConnect();
        this.notifyStatusChange();
        return Boolean(res);
      }
      await this.provider.connect();
      this.notifyStatusChange();
      return this.isConnected();
    } catch {
      return false;
    }
  }

  public async listPrinters(): Promise<string[]> {
    if (!this.provider) return [];
    const discovered = await this.provider.discoverPrinters();
    return discovered.map((p) => p.name);
  }

  public async getDefaultPrinter(): Promise<string | null> {
    if (!this.provider) return null;
    const discovered = await this.provider.discoverPrinters();
    const def = discovered.find((p) => p.isDefault);
    return def ? def.name : (discovered[0]?.name || null);
  }

  public async getRestoredPrinter(): Promise<string | null> {
    const lastUsed = typeof localStorage !== "undefined"
      ? localStorage.getItem("orderrail_last_used_printer")
      : null;

    if (this.isConnected()) {
      try {
        const available = await this.listPrinters();
        if (lastUsed && available.includes(lastUsed)) {
          return lastUsed;
        }
        const def = await this.getDefaultPrinter();
        return def || available[0] || null;
      } catch {
        return lastUsed || null;
      }
    }
    return lastUsed || null;
  }

  public setLastUsedPrinter(printerName: string): void {
    if (typeof localStorage !== "undefined" && printerName) {
      localStorage.setItem("orderrail_last_used_printer", printerName);
    }
  }

  public async printTest(printerName?: string): Promise<boolean> {
    if (!this.provider) return false;
    return this.provider.testPrint(printerName as any);
  }
}

export const printService = PrintService.getInstance();
