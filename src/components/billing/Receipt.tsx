import React from 'react';
import { BillWithItems } from '@/lib/billing/types';
import { formatCurrency } from '@/lib/db';
import { cn } from '@/lib/utils';
import { Store, User, Phone, Calendar, Receipt as ReceiptIcon, CheckCircle2 } from 'lucide-react';

export interface CafeBrandingInfo {
  name?: string;
  address?: string;
  phone?: string;
  gstin?: string;
  logoUrl?: string;
}

export interface ReceiptProps {
  bill: BillWithItems;
  cafeInfo?: CafeBrandingInfo;
  className?: string;
  showFooterButtons?: boolean;
  onPrint?: () => void;
}

export const Receipt: React.FC<ReceiptProps> = ({
  bill,
  cafeInfo = {
    name: 'ORDERRAIL CAFE',
    address: '123 Main Street, Food Street City',
    phone: '+91 98765 43210',
    gstin: '27AAAAA0000A1Z5',
  },
  className,
  showFooterButtons = false,
  onPrint,
}) => {
  const formattedDate = new Date(bill.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = new Date(bill.created_at).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div
      className={cn(
        'w-full max-w-sm mx-auto bg-card text-card-foreground p-5 rounded-2xl border border-border/60 shadow-lg font-sans text-xs flex flex-col gap-4 select-none',
        className
      )}
    >
      {/* 1. CAFE HEADER */}
      <div className="flex flex-col items-center text-center gap-1 border-b border-border/40 pb-3">
        {cafeInfo.logoUrl ? (
          <img src={cafeInfo.logoUrl} alt="Cafe Logo" className="w-12 h-12 object-contain mb-1 rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold mb-1">
            <Store className="w-5 h-5" />
          </div>
        )}
        <h2 className="text-base font-extrabold uppercase tracking-wide text-foreground">{cafeInfo.name}</h2>
        <p className="text-[11px] text-muted-foreground">{cafeInfo.address}</p>
        <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
          <Phone className="w-3 h-3" /> {cafeInfo.phone}
        </p>
        {cafeInfo.gstin && (
          <p className="text-[10px] font-mono font-semibold text-muted-foreground/80 mt-0.5">
            GSTIN: {cafeInfo.gstin}
          </p>
        )}
      </div>

      {/* 2. BILL & CUSTOMER METADATA */}
      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/30 text-[11px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Bill No</span>
          <span className="font-mono font-bold text-foreground text-xs">Bill #{bill.bill_number}</span>
        </div>
        <div className="flex flex-col gap-0.5 text-right">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Table / Type</span>
          <span className="font-bold text-foreground">{bill.table_id || bill.order_type}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" /> Date & Time
          </span>
          <span className="font-medium text-foreground">{formattedDate} {formattedTime}</span>
        </div>
        <div className="flex flex-col gap-0.5 text-right">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cashier</span>
          <span className="font-medium text-foreground">{bill.cashier_id || 'Counter'}</span>
        </div>
        {bill.customer_name && (
          <div className="col-span-2 flex items-center justify-between pt-1 border-t border-border/30 text-[11px]">
            <span className="text-muted-foreground flex items-center gap-1">
              <User className="w-3 h-3" /> {bill.customer_name}
            </span>
            {bill.customer_phone && <span className="font-mono text-muted-foreground">{bill.customer_phone}</span>}
          </div>
        )}
      </div>

      {/* 3. ITEMIZED TABLE */}
      <div className="flex flex-col gap-1 border-b border-border/40 pb-3">
        <div className="grid grid-cols-12 text-[10px] font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/40">
          <span className="col-span-6">Item</span>
          <span className="col-span-2 text-center">Qty</span>
          <span className="col-span-4 text-right">Amount</span>
        </div>
        {bill.items.map((item, idx) => (
          <div key={item.id || idx} className="flex flex-col py-1 text-[11px] border-b border-border/20 last:border-0">
            <div className="grid grid-cols-12 items-baseline font-medium">
              <span className="col-span-6 font-semibold text-foreground pr-1">{item.item_name}</span>
              <span className="col-span-2 text-center font-mono text-muted-foreground">{item.quantity}</span>
              <span className="col-span-4 text-right font-mono font-bold text-foreground">
                {formatCurrency(item.line_total)}
              </span>
            </div>
            {item.special_instructions && (
              <span className="text-[10px] italic text-muted-foreground pl-1 mt-0.5">
                Note: {item.special_instructions}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 4. FINANCIAL SUMMARY */}
      <div className="flex flex-col gap-1.5 text-[11px] border-b border-border/40 pb-3">
        <div className="flex justify-between text-muted-foreground">
          <span>Total Items</span>
          <span className="font-mono font-semibold">{bill.total_items}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="font-mono font-semibold">{formatCurrency(bill.subtotal)}</span>
        </div>
        {bill.discount > 0 && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
            <span>Discount</span>
            <span className="font-mono">-{formatCurrency(bill.discount)}</span>
          </div>
        )}
        {bill.service_charge > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Service Charge</span>
            <span className="font-mono">{formatCurrency(bill.service_charge)}</span>
          </div>
        )}
        {bill.cgst > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>CGST (2.5%)</span>
            <span className="font-mono">{formatCurrency(bill.cgst)}</span>
          </div>
        )}
        {bill.sgst > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>SGST (2.5%)</span>
            <span className="font-mono">{formatCurrency(bill.sgst)}</span>
          </div>
        )}
        {Math.abs(bill.round_off) > 0 && (
          <div className="flex justify-between text-muted-foreground text-[10px]">
            <span>Round Off</span>
            <span className="font-mono">{bill.round_off >= 0 ? `+${bill.round_off}` : bill.round_off}</span>
          </div>
        )}
        <div className="flex justify-between items-center text-sm font-extrabold text-foreground pt-1.5 border-t border-border/40">
          <span>Grand Total</span>
          <span className="font-mono text-base text-primary">{formatCurrency(bill.grand_total)}</span>
        </div>
      </div>

      {/* 5. FOOTER & PAYMENT BADGE */}
      <div className="flex flex-col items-center text-center gap-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Payment: {bill.payment_method} ({bill.payment_status})</span>
        </div>
        <p className="text-[11px] font-bold text-foreground tracking-wide mt-1">Thank you! Visit Again.</p>
      </div>

      {/* Optional Print Action Button */}
      {showFooterButtons && onPrint && (
        <button
          onClick={onPrint}
          className="w-full h-10 mt-1 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
        >
          <ReceiptIcon className="w-4 h-4" /> Print Customer Receipt
        </button>
      )}
    </div>
  );
};
