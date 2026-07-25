import { PrintJob, PrintJobStatus } from '../models/PrintJob';

export class PrintQueue {
  private queue: PrintJob[] = [];

  public enqueue(job: PrintJob): void {
    this.queue.push(job);
  }

  public getPending(): PrintJob[] {
    return this.queue.filter((j) => j.status === 'QUEUED' || j.status === 'SENDING');
  }

  public getById(id: string): PrintJob | undefined {
    return this.queue.find((j) => j.id === id);
  }

  public updateStatus(id: string, status: PrintJobStatus, errorMessage?: string): PrintJob | undefined {
    const job = this.getById(id);
    if (job) {
      job.status = status;
      job.updatedAt = new Date().toISOString();
      if (errorMessage) {
        job.errorMessage = errorMessage;
      }
    }
    return job;
  }

  public incrementRetry(id: string): number {
    const job = this.getById(id);
    if (job) {
      job.retryCount += 1;
      job.updatedAt = new Date().toISOString();
      return job.retryCount;
    }
    return 0;
  }

  public getAll(): PrintJob[] {
    return [...this.queue];
  }

  public clear(): void {
    this.queue = [];
  }
}
