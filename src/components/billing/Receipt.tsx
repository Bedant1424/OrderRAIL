import React from 'react';
import { BillWithItems } from '@/lib/billing/types';
import { formatCurrency } from '@/lib/db';
import { cn } from '@/lib/utils';
import { Printer } from 'lucide-react';

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
        'w-full max-w-sm mx-auto bg-white text-black p-5 rounded-lg border border-gray-300 font-mono text-xs flex flex-col gap-3 select-none shadow-none',
        className
      )}
    >
      {/* 1. CAFE HEADER */}
      <div className="flex flex-col items-center text-center gap-0.5 border-b border-dashed border-gray-400 pb-3">
        <h2 className="text-base font-black uppercase tracking-wider text-black">{cafeInfo.name}</h2>
        <p className="text-[11px] text-gray-700">{cafeInfo.address}</p>
        <p className="text-[11px] text-gray-700">Ph: {cafeInfo.phone}</p>
        {cafeInfo.gstin && (
          <p className="text-[10px] font-bold text-gray-700 mt-0.5">
            GSTIN: {cafeInfo.gstin}
          </p>
        )}
      </div>

      {/* 2. BILL METADATA */}
      <div className="grid grid-cols-2 gap-1 text-[11px] border-b border-dashed border-gray-400 pb-2">
        <div className="flex flex-col">
          <span className="font-bold text-black">Bill #{bill.bill_number}</span>
          <span className="text-gray-700">{bill.table_id || bill.order_type}</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-gray-700">{formattedDate}</span>
          <span className="text-gray-700">{formattedTime}</span>
        </div>
      </div>

      {/* 3. ITEMIZED TABLE */}
      <div className="flex flex-col gap-1 border-b border-dashed border-gray-400 pb-3">
        <div className="grid grid-cols-12 text-[10px] font-extrabold text-black uppercase tracking-wider pb-1 border-b border-gray-300">
          <span className="col-span-6">Item</span>
          <span className="col-span-2 text-center">Qty</span>
          <span className="col-span-4 text-right">Amt</span>
        </div>
        {bill.items.map((item, idx) => (
          <div key={item.id || idx} className="flex flex-col py-0.5 text-[11px]">
            <div className="grid grid-cols-12 items-baseline text-black">
              <span className="col-span-6 font-semibold pr-1">{item.item_name}</span>
              <span className="col-span-2 text-center">{item.quantity}</span>
              <span className="col-span-4 text-right font-bold">
                {formatCurrency(item.line_total)}
              </span>
            </div>
            {item.special_instructions && (
              <span className="text-[10px] italic text-gray-600 pl-1">
                Note: {item.special_instructions}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 4. FINANCIAL SUMMARY */}
      <div className="flex flex-col gap-1 text-[11px] border-b border-dashed border-gray-400 pb-3 text-black">
        <div className="flex justify-between">
          <span>Subtotal ({bill.total_items} items)</span>
          <span className="font-bold">{formatCurrency(bill.subtotal)}</span>
        </div>
        {bill.discount > 0 && (
          <div className="flex justify-between font-semibold text-black">
            <span>Discount</span>
            <span className="font-bold">-{formatCurrency(bill.discount)}</span>
          </div>
        )}
        {bill.service_charge > 0 && (
          <div className="flex justify-between">
            <span>Service Charge</span>
            <span>{formatCurrency(bill.service_charge)}</span>
          </div>
        )}
        {(bill.cgst > 0 || bill.sgst > 0) && (
          <div className="flex justify-between">
            <span>Tax (GST)</span>
            <span>{formatCurrency(bill.cgst + bill.sgst)}</span>
          </div>
        )}
        {Math.abs(bill.round_off) > 0 && (
          <div className="flex justify-between text-[10px]">
            <span>Round Off</span>
            <span>{bill.round_off >= 0 ? `+${bill.round_off}` : bill.round_off}</span>
          </div>
        )}
        <div className="flex justify-between items-center text-base font-black pt-2 border-t-2 border-black mt-1 text-black">
          <span>GRAND TOTAL</span>
          <span>{formatCurrency(bill.grand_total)}</span>
        </div>
      </div>

      {/* 5. FOOTER */}
      <div className="flex flex-col items-center text-center gap-1 pt-1 text-black">
        <div className="text-[11px] font-bold uppercase tracking-wider">
          PAYMENT: {bill.payment_method} ({bill.payment_status})
        </div>
        <p className="text-[10px] text-gray-700 tracking-wide mt-1">Thank you! Visit Again.</p>
      </div>

      {showFooterButtons && onPrint && (
        <button
          onClick={onPrint}
          className="w-full h-9 mt-2 rounded bg-black text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
        >
          <Printer className="w-4 h-4" /> Print Thermal Receipt
        </button>
      )}
    </div>
  );
};
