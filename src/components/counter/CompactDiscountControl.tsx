import React, { useState, useMemo } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Tag, Plus, X, Percent, IndianRupee } from 'lucide-react';

export type DiscountType = 'PERCENTAGE' | 'FLAT';
export type DiscountReason = 'Loyalty' | 'Promotion' | 'Staff' | 'Complaint' | 'Other';

export interface CustomDiscount {
  type: DiscountType;
  value: number;
  reason?: DiscountReason | string;
}

export interface CompactDiscountControlProps {
  discount: CustomDiscount;
  subtotal: number;
  onChangeDiscount: (newDiscount: CustomDiscount) => void;
  className?: string;
}

export const CompactDiscountControl: React.FC<CompactDiscountControlProps> = ({
  discount,
  subtotal,
  onChangeDiscount,
  className,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [editType, setEditType] = useState<DiscountType>(discount.type || 'PERCENTAGE');
  const [editValue, setEditValue] = useState<string>(
    discount.value > 0 ? String(discount.value) : ''
  );
  const [editReason, setEditReason] = useState<string>(discount.reason || '');

  // Calculate actual discount amount saved
  const discountAmt = useMemo(() => {
    if (!discount || discount.value <= 0) return 0;
    if (discount.type === 'PERCENTAGE') {
      return Math.round((subtotal * (discount.value / 100)) * 100) / 100;
    } else {
      return Math.min(subtotal, discount.value);
    }
  }, [discount, subtotal]);

  const handleOpenPopover = () => {
    setEditType(discount.type || 'PERCENTAGE');
    setEditValue(discount.value > 0 ? String(discount.value) : '');
    setEditReason(discount.reason || '');
    setIsOpen(true);
  };

  const handlePresetClick = (pct: number) => {
    onChangeDiscount({
      type: 'PERCENTAGE',
      value: pct,
      reason: pct > 0 ? 'Preset Discount' : undefined,
    });
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(editValue);
    if (isNaN(val) || val <= 0) {
      onChangeDiscount({ type: 'PERCENTAGE', value: 0 });
    } else {
      onChangeDiscount({
        type: editType,
        value: val,
        reason: editReason || undefined,
      });
    }
    setIsOpen(false);
  };

  const handleRemoveDiscount = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeDiscount({ type: 'PERCENTAGE', value: 0 });
  };

  const isApplied = discount && discount.value > 0;

  return (
    <div className={cn('w-full font-sans text-xs flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between font-bold text-muted-foreground text-[11px] uppercase tracking-wider">
        <span>Discount</span>
      </div>

      {isApplied ? (
        /* APPLIED DISCOUNT BADGE STATE */
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={handleOpenPopover}
                className="flex items-center gap-1.5 font-bold hover:underline text-left flex-1"
                title="Click to edit custom discount"
              >
                <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  🏷 {discount.type === 'PERCENTAGE' ? `${discount.value}% OFF` : `₹${discount.value} OFF`}
                </span>
                <span className="text-[10px] text-muted-foreground font-normal font-mono ml-1">
                  (Saved ₹{discountAmt.toFixed(2)})
                </span>
              </button>
            </PopoverTrigger>

            <PopoverContent align="end" className="w-64 p-3 bg-card border-border shadow-lg rounded-xl z-50">
              <form onSubmit={handleApplyCustom} className="flex flex-col gap-3">
                <div className="font-extrabold text-xs text-foreground">Edit Discount</div>

                {/* Discount Type Toggle */}
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted rounded-lg border border-border/50">
                  <button
                    type="button"
                    onClick={() => setEditType('PERCENTAGE')}
                    className={cn(
                      'py-1 rounded text-[11px] font-bold transition flex items-center justify-center gap-1',
                      editType === 'PERCENTAGE'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Percent className="w-3 h-3" /> Percentage (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType('FLAT')}
                    className={cn(
                      'py-1 rounded text-[11px] font-bold transition flex items-center justify-center gap-1',
                      editType === 'FLAT'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <IndianRupee className="w-3 h-3" /> Flat (₹)
                  </button>
                </div>

                {/* Numeric Value Input */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Discount Value</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={editType === 'PERCENTAGE' ? 'e.g. 10 for 10%' : 'e.g. 150 for ₹150'}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                    autoFocus
                  />
                </div>

                {/* Reason Dropdown */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Reason (optional)</label>
                  <select
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="h-8 px-2 rounded-lg border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">Select Reason...</option>
                    <option value="Loyalty">Loyalty</option>
                    <option value="Promotion">Promotion</option>
                    <option value="Staff">Staff</option>
                    <option value="Complaint">Complaint</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3 h-7 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 h-7 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs"
                  >
                    Apply
                  </button>
                </div>
              </form>
            </PopoverContent>
          </Popover>

          <button
            onClick={handleRemoveDiscount}
            className="w-5 h-5 rounded-full hover:bg-rose-500/20 text-muted-foreground hover:text-rose-600 flex items-center justify-center transition shrink-0"
            title="Remove Discount"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* PRESET ROW WITH [+] BUTTON STATE */
        <div className="flex items-center gap-1">
          {[0, 5, 10, 15].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => handlePresetClick(pct)}
              className={cn(
                'flex-1 py-1 rounded-lg text-[11px] font-bold border transition text-center',
                discount.type === 'PERCENTAGE' && discount.value === pct
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              {pct}%
            </button>
          ))}

          {/* Custom [+] Popover Trigger */}
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={handleOpenPopover}
                className="w-8 py-1 rounded-lg text-[11px] font-bold border border-border/60 bg-muted/40 hover:bg-primary hover:text-primary-foreground hover:border-primary text-foreground transition flex items-center justify-center"
                title="Custom Discount"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>

            <PopoverContent align="end" className="w-64 p-3 bg-card border-border shadow-lg rounded-xl z-50">
              <form onSubmit={handleApplyCustom} className="flex flex-col gap-3">
                <div className="font-extrabold text-xs text-foreground">Custom Discount</div>

                {/* Discount Type Toggle */}
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted rounded-lg border border-border/50">
                  <button
                    type="button"
                    onClick={() => setEditType('PERCENTAGE')}
                    className={cn(
                      'py-1 rounded text-[11px] font-bold transition flex items-center justify-center gap-1',
                      editType === 'PERCENTAGE'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Percent className="w-3 h-3" /> Percentage (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType('FLAT')}
                    className={cn(
                      'py-1 rounded text-[11px] font-bold transition flex items-center justify-center gap-1',
                      editType === 'FLAT'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <IndianRupee className="w-3 h-3" /> Flat (₹)
                  </button>
                </div>

                {/* Numeric Value Input */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Discount Value</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={editType === 'PERCENTAGE' ? 'e.g. 10 for 10%' : 'e.g. 150 for ₹150'}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                    autoFocus
                  />
                </div>

                {/* Reason Dropdown */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Reason (optional)</label>
                  <select
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="h-8 px-2 rounded-lg border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">Select Reason...</option>
                    <option value="Loyalty">Loyalty</option>
                    <option value="Promotion">Promotion</option>
                    <option value="Staff">Staff</option>
                    <option value="Complaint">Complaint</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3 h-7 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 h-7 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs"
                  >
                    Apply
                  </button>
                </div>
              </form>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
};
