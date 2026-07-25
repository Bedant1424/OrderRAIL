import { ConnectionState, PrinterStatusMeta } from './models/ConnectionState';
import { PrintPayloadData } from './models/Payload';
import { PrintJob, PrintJobType } from './models/PrintJob';
import { DEFAULT_PRINTER_CONFIG, LogicalPrinterDestination, PrinterMappingConfig } from './models/PrinterConfig';
import { MockProvider } from './providers/MockProvider';
import { IPrintProvider } from './providers/PrintProvider';
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
    this.provider = provider || new MockProvider();
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
}

export const printService = PrintService.getInstance();
