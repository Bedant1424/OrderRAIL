import { LogicalPrinterDestination } from './PrinterConfig';
import { PrintPayloadData } from './Payload';

export type PrintJobType = 'KOT' | 'RECEIPT' | 'TEST';

export type PrintJobStatus =
  | 'QUEUED'
  | 'SENDING'
  | 'ACCEPTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface PrintJob {
  id: string;
  type: PrintJobType;
  destination: LogicalPrinterDestination;
  payload: PrintPayloadData;
  status: PrintJobStatus;
  orderId?: string;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
