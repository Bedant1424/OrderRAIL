import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Tag, Plus, X, Percent, IndianRupee, AlertCircle, Check } from 'lucide-react';

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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    type: DiscountType;
    value: number;
    reason?: string;
    savedAmt: number;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate actual discount amount saved
  const discountAmt = useMemo(() => {
    if (!discount || discount.value <= 0) return 0;
    if (discount.type === 'PERCENTAGE') {
      return Math.round((subtotal * (discount.value / 100)) * 100) / 100;
    } else {
      return Math.min(subtotal, discount.value);
    }
  }, [discount, subtotal]);

  // Auto-focus and select text upon popover open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    } else {
      setValidationError(null);
      setPendingConfirmation(null);
    }
  }, [isOpen]);

  const handleOpenPopover = () => {
    setEditType(discount.type || 'PERCENTAGE');
    setEditValue(discount.value > 0 ? String(discount.value) : '');
    setEditReason(discount.reason || '');
    setValidationError(null);
    setPendingConfirmation(null);
    setIsOpen(true);
  };

  const handlePresetClick = (pct: number) => {
    onChangeDiscount({
      type: 'PERCENTAGE',
      value: pct,
      reason: pct > 0 ? 'Preset Discount' : undefined,
    });
  };

  const handleClearDiscount = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChangeDiscount({ type: 'PERCENTAGE', value: 0 });
    setIsOpen(false);
  };

  const validateAndProcess = () => {
    setValidationError(null);
    const val = parseFloat(editValue);

    if (isNaN(val) || val <= 0) {
      setValidationError('Please enter a valid positive discount amount.');
      return;
    }

    if (editType === 'PERCENTAGE') {
      if (val < 0.01 || val > 100) {
        setValidationError('Percentage must be between 0.01% and 100%.');
        return;
      }
    } else if (editType === 'FLAT') {
      if (val < 1) {
        setValidationError('Flat amount must be at least ₹1.');
        return;
      }
      if (val > subtotal) {
        setValidationError(`Flat amount cannot exceed subtotal (₹${subtotal.toLocaleString('en-IN')}).`);
        return;
      }
    }

    // Check for large discount threshold (> 25% of subtotal)
    const calculatedAmt =
      editType === 'PERCENTAGE'
        ? Math.round((subtotal * (val / 100)) * 100) / 100
        : Math.min(subtotal, val);

    const isLarge =
      (editType === 'PERCENTAGE' && val > 25) ||
      (editType === 'FLAT' && calculatedAmt > subtotal * 0.25);

    if (isLarge) {
      setPendingConfirmation({
        type: editType,
        value: val,
        reason: editReason || undefined,
        savedAmt: calculatedAmt,
      });
      return;
    }

    // Apply immediately if not large
    onChangeDiscount({
      type: editType,
      value: val,
      reason: editReason || undefined,
    });
    setIsOpen(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateAndProcess();
  };

  const handleConfirmLargeDiscount = () => {
    if (pendingConfirmation) {
      onChangeDiscount({
        type: pendingConfirmation.type,
        value: pendingConfirmation.value,
        reason: pendingConfirmation.reason,
      });
    }
    setPendingConfirmation(null);
    setIsOpen(false);
  };

  const isApplied = discount && discount.value > 0;
  const dynamicPlaceholder = editType === 'PERCENTAGE' ? 'Enter %' : 'Enter ₹ amount';

  return (
    <div className={cn('w-full font-sans text-xs flex flex-col gap-1.5 select-none', className)}>
      <div className="flex items-center justify-between font-bold text-muted-foreground text-[11px] uppercase tracking-wider">
        <span>Discount</span>
      </div>

      {isApplied ? (
        /* APPLIED DISCOUNT BADGE / CHIP STATE */
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 transition-all duration-200">
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={handleOpenPopover}
                className="flex items-center gap-1.5 font-bold hover:underline text-left flex-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/40 rounded-lg"
                title="Click to edit discount"
                aria-label="Click to edit discount"
              >
                <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-extrabold">
                  🏷 {discount.type === 'PERCENTAGE' ? `${discount.value}% OFF` : `₹${discount.value} OFF`}
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold font-mono ml-1">
                  (₹{discountAmt.toFixed(2)} Saved)
                </span>
              </button>
            </PopoverTrigger>

            {/* Popover Form embedded below */}
            <PopoverContent align="end" className="w-68 p-3.5 bg-card border-border shadow-xl rounded-2xl z-50">
              {pendingConfirmation ? (
                /* LARGE DISCOUNT CONFIRMATION STATE */
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 font-extrabold text-amber-600 dark:text-amber-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Apply {pendingConfirmation.type === 'PERCENTAGE' ? `${pendingConfirmation.value}%` : `₹${pendingConfirmation.value}`} discount?</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Customer saves <strong className="text-foreground font-mono font-bold">₹{pendingConfirmation.savedAmt.toFixed(2)}</strong> on this order.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPendingConfirmation(null)}
                      className="px-3 h-8 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmLargeDiscount}
                      className="px-3 h-8 rounded-xl text-xs font-bold bg-amber-500 text-amber-950 hover:bg-amber-400 transition shadow-sm"
                    >
                      Apply Discount
                    </button>
                  </div>
                </div>
              ) : (
                /* CUSTOM DISCOUNT FORM STATE */
                <form onSubmit={handleFormSubmit} className="flex flex-col gap-3">
                  <div className="font-extrabold text-xs text-foreground">Edit Custom Discount</div>

                  {/* Discount Type Toggle */}
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted rounded-xl border border-border/50">
                    <button
                      type="button"
                      onClick={() => setEditType('PERCENTAGE')}
                      className={cn(
                        'py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1',
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
                        'py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1',
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
                      ref={inputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={dynamicPlaceholder}
                      value={editValue}
                      onChange={(e) => {
                        setEditValue(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setIsOpen(false);
                      }}
                      className="h-8 px-2.5 rounded-xl border border-border bg-background text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    {validationError && (
                      <span className="text-[10px] font-semibold text-rose-500 mt-0.5 leading-tight">
                        {validationError}
                      </span>
                    )}
                  </div>

                  {/* Reason Dropdown */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-muted-foreground">Reason (optional)</label>
                    <select
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      className="h-8 px-2 rounded-xl border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                      className="px-3 h-8 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 h-8 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs"
                    >
                      Apply
                    </button>
                  </div>
                </form>
              )}
            </PopoverContent>
          </Popover>

          <button
            onClick={handleClearDiscount}
            className="w-5 h-5 rounded-full hover:bg-rose-500/20 text-muted-foreground hover:text-rose-600 flex items-center justify-center transition shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            title="Remove discount"
            aria-label="Remove discount"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* PRESET ROW WITH CONTEXTUAL "CLEAR" & [+] BUTTON STATE */
        <div className="flex items-center gap-1">
          {[5, 10, 15].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => handlePresetClick(pct)}
              className={cn(
                'flex-1 py-1 rounded-lg text-[11px] font-bold border transition text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40',
                discount.type === 'PERCENTAGE' && discount.value === pct
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              {pct}%
            </button>
          ))}

          {/* Render "Clear" button ONLY if a discount is active */}
          {isApplied && (
            <button
              type="button"
              onClick={handleClearDiscount}
              className="flex-1 py-1 rounded-lg text-[11px] font-bold border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500/40"
              title="Clear active discount"
              aria-label="Clear active discount"
            >
              Clear
            </button>
          )}

          {/* Custom [+] Popover Trigger */}
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={handleOpenPopover}
                className="w-8 py-1 rounded-lg text-[11px] font-bold border border-border/60 bg-muted/40 hover:bg-primary hover:text-primary-foreground hover:border-primary text-foreground transition flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
                title="Custom Discount"
                aria-label="Custom Discount"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>

            <PopoverContent align="end" className="w-68 p-3.5 bg-card border-border shadow-xl rounded-2xl z-50">
              {pendingConfirmation ? (
                /* LARGE DISCOUNT CONFIRMATION STATE */
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 font-extrabold text-amber-600 dark:text-amber-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Apply {pendingConfirmation.type === 'PERCENTAGE' ? `${pendingConfirmation.value}%` : `₹${pendingConfirmation.value}`} discount?</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Customer saves <strong className="text-foreground font-mono font-bold">₹{pendingConfirmation.savedAmt.toFixed(2)}</strong> on this order.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPendingConfirmation(null)}
                      className="px-3 h-8 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmLargeDiscount}
                      className="px-3 h-8 rounded-xl text-xs font-bold bg-amber-500 text-amber-950 hover:bg-amber-400 transition shadow-sm"
                    >
                      Apply Discount
                    </button>
                  </div>
                </div>
              ) : (
                /* CUSTOM DISCOUNT FORM STATE */
                <form onSubmit={handleFormSubmit} className="flex flex-col gap-3">
                  <div className="font-extrabold text-xs text-foreground">Custom Discount</div>

                  {/* Discount Type Toggle */}
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted rounded-xl border border-border/50">
                    <button
                      type="button"
                      onClick={() => setEditType('PERCENTAGE')}
                      className={cn(
                        'py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1',
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
                        'py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1',
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
                      ref={inputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={dynamicPlaceholder}
                      value={editValue}
                      onChange={(e) => {
                        setEditValue(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setIsOpen(false);
                      }}
                      className="h-8 px-2.5 rounded-xl border border-border bg-background text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    {validationError && (
                      <span className="text-[10px] font-semibold text-rose-500 mt-0.5 leading-tight">
                        {validationError}
                      </span>
                    )}
                  </div>

                  {/* Reason Dropdown */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-muted-foreground">Reason (optional)</label>
                    <select
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      className="h-8 px-2 rounded-xl border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                      className="px-3 h-8 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 h-8 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs"
                    >
                      Apply
                    </button>
                  </div>
                </form>
              )}
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
};
