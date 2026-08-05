/**
 * Sprint 9.2.3.2 & 9.2.3.3 — Printer Adapter Layer
 * 
 * Hardware-isolated printer abstraction.
 * Bridges business logic / Operations Engine with physical, ESC/POS, QZ Tray, or Mock printers.
 */

import { printService } from "./PrintService";
import { KotBuilder, renderKotText, type KotRenderPayload } from "./kotRenderer";
import { ReceiptBuilder, renderReceiptText, type ReceiptRenderPayload } from "./receiptRenderer";
import { getReceiptSettings } from "../billing/receiptSettings";

export type PrinterAdapterState = 'CONNECTED' | 'DISCONNECTED' | 'OUT_OF_PAPER' | 'ERROR';

export interface PrinterAdapterStatusMeta {
  state: PrinterAdapterState;
  isOnline: boolean;
  printerName: string;
  simulatedState: PrinterAdapterState | null;
}

export type PrinterAdapterStatusListener = (status: PrinterAdapterStatusMeta) => void;

class PrinterAdapterClass {
  private simulatedState: PrinterAdapterState | null = null;
  private listeners: Set<PrinterAdapterStatusListener> = new Set();
  private printerName: string = "Counter Bill Thermal Printer (80mm)";

  constructor() {
    printService.subscribeStatus(() => {
      this.notifyListeners();
    });
  }

  public getStatus(): PrinterAdapterStatusMeta {
    if (this.simulatedState) {
      return {
        state: this.simulatedState,
        isOnline: this.simulatedState === 'CONNECTED',
        printerName: `${this.printerName} (Simulated)`,
        simulatedState: this.simulatedState,
      };
    }

    const serviceState = printService.getConnectionState();
    const isConnected = serviceState === 'CONNECTED';
    const state: PrinterAdapterState = isConnected ? 'CONNECTED' : 'DISCONNECTED';

    return {
      state,
      isOnline: isConnected,
      printerName: this.printerName,
      simulatedState: null,
    };
  }

  public setSimulatedState(state: PrinterAdapterState | null): void {
    this.simulatedState = state;
    console.log(`[PrinterAdapter] Simulated state changed to: ${state || 'REAL'}`);
    this.notifyListeners();
  }

  public async connect(): Promise<boolean> {
    if (this.simulatedState) {
      return this.simulatedState === 'CONNECTED';
    }
    try {
      const provider = printService.getActiveProvider();
      await provider.connect();
      this.notifyListeners();
      return true;
    } catch {
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.simulatedState) {
      this.simulatedState = 'DISCONNECTED';
      this.notifyListeners();
      return;
    }
    const provider = printService.getActiveProvider();
    await provider.disconnect();
    this.notifyListeners();
  }

  public async printKot(payload: KotRenderPayload & { destination?: string }): Promise<{ success: boolean; error?: string }> {
    let currentStatus = this.getStatus();

    if (!currentStatus.isOnline && !this.simulatedState) {
      await this.connect();
      currentStatus = this.getStatus();
    }

    if (!currentStatus.isOnline) {
      const errReason =
        currentStatus.state === 'OUT_OF_PAPER'
          ? 'Printer Out of Paper'
          : currentStatus.state === 'ERROR'
          ? 'Printer Hardware Fault'
          : 'Printer Disconnected';
      throw new Error(`[PrinterAdapter] ${errReason}`);
    }

    // Build dedicated production KOT ticket using ESC/POS KotBuilder
    const kotBuild = KotBuilder.build(payload, 58);

    const res = await printService.enqueue(
      'KOT',
      (payload.destination as any) || 'KOT_PRINTER',
      {
        type: 'KOT',
        orderId: payload.orderId,
        orderNumber: typeof payload.orderNumber === 'number' ? payload.orderNumber : parseInt(payload.orderNumber, 10) || 101,
        tableLabel: payload.tableLabel,
        timestamp: payload.timestamp,
        notes: payload.notes,
        items: payload.items.map((i) => ({
          id: i.id || `i-${Date.now()}`,
          name: i.name,
          price: i.price,
          qty: i.qty,
          notes: i.notes,
          modifiers: (i as any).modifiers,
        })),
        escpos: kotBuild.escpos,
        formattedText: kotBuild.text,
      },
      { orderId: payload.orderId }
    );

    if (res.success) {
      console.log(`[PrinterAdapter] KOT #${payload.kotNumber} printed successfully:\n${kotBuild.text}`);
      return { success: true };
    }

    throw new Error(res.job.errorMessage || 'KOT Print Failed');
  }

  public async printReceipt(payload: ReceiptRenderPayload & { destination?: string }): Promise<{ success: boolean; error?: string }> {
    let currentStatus = this.getStatus();

    if (!currentStatus.isOnline && !this.simulatedState) {
      await this.connect();
      currentStatus = this.getStatus();
    }

    if (!currentStatus.isOnline) {
      const errReason =
        currentStatus.state === 'OUT_OF_PAPER'
          ? 'Printer Out of Paper'
          : currentStatus.state === 'ERROR'
          ? 'Printer Hardware Fault'
          : 'Printer Disconnected';
      throw new Error(`[PrinterAdapter] ${errReason}`);
    }

    const settings = getReceiptSettings((payload as any).cafeId);
    const widthmm: 58 | 80 = settings.receiptWidth === "58mm" ? 58 : 80;

    // Build dedicated customer receipt using ESC/POS ReceiptBuilder with owner configured width (58mm or 80mm)
    const receiptBuild = ReceiptBuilder.build(payload, widthmm);

    const res = await printService.enqueue(
      'RECEIPT',
      (payload.destination as any) || 'BILL_PRINTER',
      {
        type: 'RECEIPT',
        orderId: payload.orderId,
        billNumber: String(payload.billNumber),
        tableLabel: payload.tableLabel,
        cashierName: payload.cashierName || 'Counter',
        timestamp: payload.timestamp,
        items: payload.items.map((i) => ({
          id: i.id || `i-${Date.now()}`,
          name: i.name,
          price: i.price,
          qty: i.qty,
        })),
        subtotal: payload.subtotal,
        tax: payload.tax,
        discountPct: payload.discountPct || 0,
        discountAmt: payload.discountAmt || 0,
        netTotal: payload.netTotal,
        tenders: payload.tenders || [],
        escpos: receiptBuild.escpos,
        formattedText: receiptBuild.text,
      },
      { orderId: payload.orderId }
    );

    if (res.success) {
      console.log(`[PrinterAdapter] Bill Receipt #${payload.billNumber} printed successfully:\n${receiptBuild.text}`);
      return { success: true };
    }

    throw new Error(res.job.errorMessage || 'Receipt Print Failed');
  }

  public subscribeStatus(listener: PrinterAdapterStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(status);
      } catch (err) {
        console.error('[PrinterAdapter] Listener error:', err);
      }
    }
  }
}

export const PrinterAdapter = new PrinterAdapterClass();
