import { ConnectionState } from '../models/ConnectionState';
import { DiscoveredPrinter, PrinterMappingConfig } from '../models/PrinterConfig';
import { PrintJob } from '../models/PrintJob';

/**
 * Interface contract for all Print Providers
 * (MockProvider, QZTrayProvider, OrderRailPrintAgentProvider, etc.)
 */
export interface IPrintProvider {
  readonly id: string;
  readonly name: string;

  /** Initialize provider configuration */
  initialize(config?: PrinterMappingConfig): Promise<void>;

  /** Connect to hardware or underlying background daemon */
  connect(): Promise<void>;

  /** Disconnect from hardware or daemon */
  disconnect(): Promise<void>;

  /** Check current connection state */
  getConnectionState(): ConnectionState;

  /** Discover accessible printers on system */
  discoverPrinters(): Promise<DiscoveredPrinter[]>;

  /** Process a print job */
  print(job: PrintJob): Promise<boolean>;

  /** Send a test print payload */
  testPrint(destination?: PrintJob['destination']): Promise<boolean>;

  /** Dispose provider resources */
  dispose(): Promise<void>;
}
