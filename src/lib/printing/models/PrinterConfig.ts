/**
 * Logical Printer Destinations supported by OrderRail.
 * Business logic speaks ONLY to these destinations.
 */
export type LogicalPrinterDestination = 'DEFAULT_PRINTER' | 'KOT_PRINTER' | 'BILL_PRINTER';

export type PrintingMode = 'SINGLE_PRINTER' | 'DUAL_PRINTER';

export interface PrinterMappingConfig {
  mode: PrintingMode;
  kotPrinterName: string;
  billPrinterName: string;
  defaultPrinterName: string;
  paperWidth: '80mm' | '58mm';
  autoCut: boolean;
  kickCashDrawer: boolean;
}

export interface DiscoveredPrinter {
  name: string;
  isDefault: boolean;
  connectionType?: 'USB' | 'NETWORK' | 'SERIAL' | 'VIRTUAL';
}

export const DEFAULT_PRINTER_CONFIG: PrinterMappingConfig = {
  mode: 'SINGLE_PRINTER',
  kotPrinterName: 'Default Printer',
  billPrinterName: 'Default Printer',
  defaultPrinterName: 'Default Printer',
  paperWidth: '80mm',
  autoCut: true,
  kickCashDrawer: true,
};
