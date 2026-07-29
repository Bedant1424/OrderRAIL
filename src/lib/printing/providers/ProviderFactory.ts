import { IPrintProvider } from './PrintProvider';
import { MockProvider } from './MockProvider';
import { QZTrayProvider } from './QZTrayProvider';
import { ConnectionState } from '../models/ConnectionState';
import { DiscoveredPrinter, PrinterMappingConfig } from '../models/PrinterConfig';
import { PrintJob } from '../models/PrintJob';

export type ProviderType = 'mock' | 'qz-tray' | 'orderrail-agent' | string;

export type ProviderFactoryFn = (config?: PrinterMappingConfig) => IPrintProvider;

/**
 * Placeholder for future Sprint 2 QZ Tray integration
 */
export class QZTrayProviderPlaceholder implements IPrintProvider {
  public readonly id = 'qz-tray';
  public readonly name = 'QZ Tray Silent Print Provider (Sprint 2)';
  private connectionState: ConnectionState = 'DISCONNECTED';

  public async initialize(): Promise<void> {
    throw new Error('QZTrayProvider is scheduled for Sprint 2 implementation.');
  }

  public async connect(): Promise<void> {
    this.connectionState = 'ERROR';
    throw new Error('QZTrayProvider WebSocket connection will be implemented in Sprint 2.');
  }

  public async disconnect(): Promise<void> {
    this.connectionState = 'DISCONNECTED';
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public async discoverPrinters(): Promise<DiscoveredPrinter[]> {
    return [];
  }

  public async print(_job: PrintJob): Promise<boolean> {
    throw new Error('QZTrayProvider silent print execution scheduled for Sprint 2.');
  }

  public async testPrint(): Promise<boolean> {
    throw new Error('QZTrayProvider test print scheduled for Sprint 2.');
  }

  public async dispose(): Promise<void> {
    await this.disconnect();
  }
}

/**
 * Placeholder for future Native Print Agent integration
 */
export class OrderRailPrintAgentPlaceholder implements IPrintProvider {
  public readonly id = 'orderrail-agent';
  public readonly name = 'OrderRail Native Print Agent Provider (Future)';
  private connectionState: ConnectionState = 'DISCONNECTED';

  public async initialize(): Promise<void> {
    throw new Error('OrderRailPrintAgentProvider is scheduled for future agent releases.');
  }

  public async connect(): Promise<void> {
    this.connectionState = 'ERROR';
    throw new Error('OrderRailPrintAgentProvider direct TCP socket connection scheduled for future releases.');
  }

  public async disconnect(): Promise<void> {
    this.connectionState = 'DISCONNECTED';
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public async discoverPrinters(): Promise<DiscoveredPrinter[]> {
    return [];
  }

  public async print(_job: PrintJob): Promise<boolean> {
    throw new Error('OrderRailPrintAgentProvider print execution scheduled for future releases.');
  }

  public async testPrint(): Promise<boolean> {
    throw new Error('OrderRailPrintAgentProvider test print scheduled for future releases.');
  }

  public async dispose(): Promise<void> {
    await this.disconnect();
  }
}

/**
 * ProviderFactory Registry managing selection & instantiation of print providers.
 */
export class ProviderFactory {
  private static instance: ProviderFactory | null = null;
  private registry: Map<string, ProviderFactoryFn> = new Map();
  private activeProviderType: ProviderType = 'qz-tray';

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): ProviderFactory {
    if (!ProviderFactory.instance) {
      ProviderFactory.instance = new ProviderFactory();
    }
    return ProviderFactory.instance;
  }

  public static resetInstanceForTesting(): void {
    ProviderFactory.instance = new ProviderFactory();
  }

  private registerDefaults(): void {
    this.registry.set('mock', () => new MockProvider());
    this.registry.set('qz-tray', () => new QZTrayProvider());
    this.registry.set('orderrail-agent', () => new OrderRailPrintAgentPlaceholder());
  }

  public registerProvider(
    type: string,
    factoryFn: ProviderFactoryFn,
    override = false
  ): void {
    const normalized = type.toLowerCase().trim();
    if (this.registry.has(normalized) && !override) {
      throw new Error(`Provider type "${normalized}" is already registered. Set override=true to replace.`);
    }
    this.registry.set(normalized, factoryFn);
  }

  public isRegistered(type: string): boolean {
    return this.registry.has(type.toLowerCase().trim());
  }

  public getRegisteredTypes(): string[] {
    return Array.from(this.registry.keys());
  }

  public setActiveProviderType(type: ProviderType): void {
    const normalized = type.toLowerCase().trim();
    if (!this.registry.has(normalized)) {
      throw new Error(`Cannot set active provider: "${normalized}" is not registered.`);
    }
    this.activeProviderType = normalized;
  }

  public getActiveProviderType(): ProviderType {
    return this.activeProviderType;
  }

  public createProvider(type?: ProviderType, config?: PrinterMappingConfig): IPrintProvider {
    const targetType = (type || this.activeProviderType).toLowerCase().trim();
    const factoryFn = this.registry.get(targetType);

    if (!factoryFn) {
      console.warn(`[ProviderFactory] Unknown provider type "${targetType}". Falling back to "mock".`);
      const fallbackFn = this.registry.get('mock');
      if (!fallbackFn) throw new Error('Default "mock" provider not registered.');
      return fallbackFn(config);
    }

    return factoryFn(config);
  }
}

export const providerFactory = ProviderFactory.getInstance();
