/**
 * Connection states for physical / proxy print agents
 */
export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface PrinterStatusMeta {
  state: ConnectionState;
  activeProviderId: string;
  activeProviderName: string;
  lastConnectedAt?: string;
  errorMessage?: string;
}
