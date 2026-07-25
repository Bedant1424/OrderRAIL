import { useEffect, useState } from 'react';
import { ConnectionState, PrinterStatusMeta } from '../models/ConnectionState';
import { PrintService } from '../PrintService';

export interface UsePrinterStatusResult {
  state: ConnectionState;
  activeProviderId: string;
  activeProviderName: string;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  isError: boolean;
  errorMessage?: string;
}

export function usePrinterStatus(): UsePrinterStatusResult {
  const [status, setStatus] = useState<PrinterStatusMeta>(() =>
    PrintService.getInstance().getStatusMeta()
  );

  useEffect(() => {
    const service = PrintService.getInstance();
    const unsubscribe = service.subscribeStatus((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  return {
    state: status.state,
    activeProviderId: status.activeProviderId,
    activeProviderName: status.activeProviderName,
    isConnected: status.state === 'CONNECTED',
    isConnecting: status.state === 'CONNECTING',
    isDisconnected: status.state === 'DISCONNECTED',
    isError: status.state === 'ERROR',
    errorMessage: status.errorMessage,
  };
}
