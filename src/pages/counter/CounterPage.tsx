import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TableEngineProvider, useTableEngine } from '@/lib/counter/tableEngine/tableStore';
import { TableEntity } from '@/lib/counter/tableEngine/tableTypes';
import { useCafe } from '@/lib/cafe';
import { useAuth } from '@/lib/auth';
import { supabase, formatCurrency } from '@/lib/db';
import { useMenu } from '@/hooks/useMenu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  Search, Plus, Minus, Trash2, Send, CreditCard, DollarSign, 
  QrCode, Printer, CheckCircle, X, ChevronDown, User, Store, 
  Sparkles, AlertTriangle, Utensils, LayoutGrid, Check, Split, RefreshCw, AlertCircle, Clock, ShoppingBag
} from 'lucide-react';

import { getOrCreateDiningSession, createDiningSessionInDb, closeDiningSessionInDb, updateTableStatusInDb, markTableFreeInDb } from '@/lib/tables/tableRepository';
import { createOrderInDb, updateOrderStatusInDb, fetchActiveDiningSessionOrders } from '@/lib/orders/repository';

import './counter.css';

// --- DATA TYPES & INTERFACES ---
interface CatalogItem {
  id: string;
  name: string;
  price: number;
  category: string;
  isVeg: boolean;
  isAvailable: boolean;
  imageUrl?: string | null;
  modifier?: string;
}

interface CartLineItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  notes?: string;
}

export interface SessionOrder {
  id: string;
  orderNumber: number;
  timestamp: string;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'PAID';
  items: CartLineItem[];
  subtotal: number;
}

export interface TableSessionData {
  sessionId: string;
  sessionCode: string;
  startedAt: string;
  guestCount: number;
  orders: SessionOrder[];
  draftCart: CartLineItem[];
}

export interface PaymentTenderRecord {
  id: string;
  method: 'cash' | 'card' | 'upi';
  amount: number;
  tenderedAmount?: number;
  changeDue?: number;
  timestamp: string;
  transactionRef?: string;
}

export interface CompletedOrderReceipt {
  orderId: string;
  sessionId: string;
  tableLabel: string;
  cashierName: string;
  timestamp: string;
  orders: SessionOrder[];
  draftItems: CartLineItem[];
  subtotal: number;
  tax: number;
  discountPct: number;
  discountAmt: number;
  netTotal: number;
  tenders: PaymentTenderRecord[];
}

const FALLBACK_CATALOG: CatalogItem[] = [
  { id: 'm-1', name: 'Double Espresso', price: 180.00, category: 'Coffee', isVeg: true, isAvailable: true, modifier: 'Double Shot' },
  { id: 'm-2', name: 'Americano', price: 160.00, category: 'Coffee', isVeg: true, isAvailable: true, modifier: 'Hot / Iced' },
  { id: 'm-3', name: 'Iced Vanilla Latte', price: 220.00, category: 'Coffee', isVeg: true, isAvailable: true, modifier: 'Oat Milk' },
  { id: 'm-4', name: 'Flat White', price: 200.00, category: 'Coffee', isVeg: true, isAvailable: true },
  { id: 'm-5', name: 'Mocha', price: 220.00, category: 'Coffee', isVeg: true, isAvailable: false, modifier: 'Sold Out' },
  { id: 'm-6', name: 'Cappuccino', price: 180.00, category: 'Coffee', isVeg: true, isAvailable: true },
  { id: 'm-7', name: 'Artisan Club Sandwich', price: 380.00, category: 'Food', isVeg: false, isAvailable: true, modifier: 'Fries included' },
  { id: 'm-8', name: 'Truffle Fries', price: 280.00, category: 'Food', isVeg: true, isAvailable: true, modifier: 'Parmesan Dip' },
  { id: 'm-9', name: 'Margherita Pizza', price: 480.00, category: 'Food', isVeg: true, isAvailable: true, modifier: 'Fresh Basil' },
  { id: 'm-10', name: 'Caesar Salad', price: 320.00, category: 'Food', isVeg: true, isAvailable: true, modifier: 'Croutons' },
  { id: 'm-11', name: 'Grilled Chicken Wrap', price: 360.00, category: 'Food', isVeg: false, isAvailable: true },
  { id: 'm-12', name: 'Mushroom Risotto', price: 450.00, category: 'Food', isVeg: true, isAvailable: true },
  { id: 'm-13', name: 'Sparkling Water', price: 120.00, category: 'Beverages', isVeg: true, isAvailable: true, modifier: '500ml' },
  { id: 'm-14', name: 'Fresh Orange Juice', price: 180.00, category: 'Beverages', isVeg: true, isAvailable: true },
  { id: 'm-15', name: 'Iced Tea', price: 150.00, category: 'Beverages', isVeg: true, isAvailable: true, modifier: 'Lemon' },
  { id: 'm-16', name: 'Tiramisu', price: 280.00, category: 'Desserts', isVeg: true, isAvailable: true },
  { id: 'm-17', name: 'Chocolate Lava Cake', price: 320.00, category: 'Desserts', isVeg: true, isAvailable: true, modifier: 'Vanilla Gelato' },
  { id: 'm-18', name: 'Crème Brûlée', price: 260.00, category: 'Desserts', isVeg: true, isAvailable: true },
];

// --- 1. AUTHENTIC ORDERRAIL HEADER (56px) ---
const Header = memo(() => {
  const { cafe } = useCafe();
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const cashierName = user?.email ? user.email.split('@')[0] : 'Sarah M.';

  return (
    <header className="v8-header">
      <div className="v8-header-left">
        <div className="v8-brand-badge">
          OR
        </div>
        <div className="v8-brand-title">
          <Store className="w-4 h-4 text-primary" />
          <span>{cafe?.name ?? 'OrderRail Cafe'}</span>
        </div>
        <span className="v8-header-station">Station #01 · Production Workstation</span>
      </div>

      <div className="v8-header-right">
        <div className="v8-cashier-pill">
          <User className="w-3.5 h-3.5" />
          <span className="capitalize">{cashierName}</span>
        </div>
        <div className="v8-sync-badge">
          <div className="v8-sync-dot" />
          <span>SYNC 100% OK</span>
        </div>
        <div className="v8-header-clock v8-font-mono">
          {time.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>
    </header>
  );
});
Header.displayName = 'Header';

// --- 2. TABLE RAIL COMPONENT (44px) ---
const TableChip = memo(({ table, isSelected, onClick }: { table: TableEntity; isSelected: boolean; onClick: () => void }) => {
  const labelNum = table.label.replace(/[^0-9]/g, '') || table.label.substring(0, 2);
  const dotClass = `v8-dot-${table.status.toLowerCase()}`;
  const isOccupiedOrBill = table.status === 'OCCUPIED' || table.status === 'BILL_REQUESTED';

  return (
    <button 
      className={cn('v8-table-chip', isSelected && 'v8-table-chip--selected')}
      onClick={onClick}
    >
      <span className={cn('v8-table-dot', dotClass)} />
      <span>{table.label.length > 4 ? `T${labelNum}` : table.label}</span>
      {isOccupiedOrBill && <span className="v8-chip-timer">34m</span>}
    </button>
  );
});
TableChip.displayName = 'TableChip';

const TableRail = memo(({ tables, selectedId, onSelect }: { tables: TableEntity[]; selectedId: string | null; onSelect: (id: string) => void }) => {
  return (
    <div className="v8-table-rail">
      <button className="v8-hall-dropdown">
        <LayoutGrid className="w-3.5 h-3.5" />
        <span>Dining Hall</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      <div className="v8-rail-chips v8-scroll">
        <button 
          className={cn('v8-table-chip', (!selectedId || selectedId === 'express') && 'v8-table-chip--selected')}
          onClick={() => onSelect('express')}
        >
          <span>EXPRESS SALE</span>
        </button>

        {tables.map((t) => (
          <TableChip 
            key={t.id} 
            table={t} 
            isSelected={t.id === selectedId}
            onClick={() => onSelect(t.id)}
          />
        ))}
      </div>
    </div>
  );
});
TableRail.displayName = 'TableRail';

// --- 3. PRODUCTION MENU PANEL WITH REALTIME AVAILABILITY ---
const MenuRow = memo(({ item, onAdd }: { item: CatalogItem; onAdd: (item: CatalogItem) => void }) => {
  const isSoldOut = !item.isAvailable;

  return (
    <button 
      className={cn('v8-menu-row', isSoldOut && 'opacity-50 cursor-not-allowed bg-muted/20')} 
      disabled={isSoldOut}
      onClick={() => onAdd(item)}
    >
      <div className={cn('v8-veg-dot', item.isVeg ? 'v8-veg-true' : 'v8-veg-false')} />
      <span className="v8-menu-row-name">
        {item.name}
        {item.modifier && <span className="v8-menu-row-modifier">({item.modifier})</span>}
      </span>
      {isSoldOut ? (
        <span className="text-[10px] font-bold text-destructive uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/10">
          Sold Out
        </span>
      ) : (
        <span className="v8-menu-row-price v8-font-mono">{formatCurrency(item.price)}</span>
      )}
      <div className={cn('v8-menu-add-btn', isSoldOut && 'bg-muted text-muted-foreground')}>
        <Plus className="w-3.5 h-3.5" />
      </div>
    </button>
  );
});
MenuRow.displayName = 'MenuRow';

const MenuPanel = ({ 
  catalog,
  categoriesList,
  searchRef, 
  onAdd 
}: { 
  catalog: CatalogItem[];
  categoriesList: string[];
  searchRef: React.RefObject<HTMLInputElement>; 
  onAdd: (item: CatalogItem) => void;
}) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = ['All', ...categoriesList];

  const filteredCatalog = catalog.filter((item) => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory;
    const matchQuery = item.name.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <div className="v8-panel-menu">
      <div className="v8-menu-header">
        <div className="v8-search-box">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input 
            ref={searchRef}
            className="v8-search-input"
            placeholder="Search menu catalog... (F2)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="text-muted-foreground hover:text-foreground" onClick={() => setQuery('')}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="v8-categories-track v8-scroll">
          {categories.map((cat) => (
            <button 
              key={cat}
              className={cn('v8-cat-btn', activeCategory === cat && 'v8-cat-btn--active')}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="v8-menu-scroll v8-scroll">
        {filteredCatalog.map((item) => (
          <MenuRow key={item.id} item={item} onAdd={onAdd} />
        ))}
        {filteredCatalog.length === 0 && (
          <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6 text-muted-foreground/60" />
            <span>No menu items match query.</span>
          </div>
        )}
      </div>
    </div>
  );
};

// --- 4. MULTI-ORDER DINING SESSION HERO PANEL ---
const OrderCard = memo(({ order, onAcceptOrder }: { order: SessionOrder; onAcceptOrder?: (id: string, num: number) => void }) => {
  const getStatusBadgeClass = (status: SessionOrder['status']) => {
    switch (status) {
      case 'PENDING': return 'bg-amber-500/20 text-amber-600 border-amber-500/30 animate-pulse';
      case 'PREPARING': return 'bg-blue-500/15 text-blue-600 border-blue-500/20';
      case 'READY': return 'bg-purple-500/15 text-purple-600 border-purple-500/20';
      case 'SERVED': return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20';
      case 'PAID': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const isPending = order.status === 'PENDING';

  return (
    <div className={cn("p-3.5 rounded-xl border flex flex-col gap-2 shadow-xs transition", isPending ? "border-amber-500/40 bg-amber-500/5" : "border-border/40 bg-card/80")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xs text-foreground">Order #{order.orderNumber}</span>
          <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" /> {order.timestamp}
          </span>
        </div>
        <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-extrabold border uppercase tracking-wider', getStatusBadgeClass(order.status))}>
          {isPending ? 'NEW ORDER' : order.status.replace('_', ' ')}
        </span>
      </div>

      <div className="flex flex-col gap-1 py-1 border-y border-border/20 text-xs">
        {order.items.map((it) => (
          <div key={it.id} className="flex justify-between items-center text-xs">
            <span>{it.qty}× {it.name}</span>
            <span className="v8-font-mono text-muted-foreground">{formatCurrency(it.price * it.qty)}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center text-xs font-bold pt-0.5">
        <span className="text-muted-foreground text-[11px]">Order Total:</span>
        <span className="v8-font-mono">{formatCurrency(order.subtotal)}</span>
      </div>

      {isPending && onAcceptOrder && (
        <div className="flex justify-between items-center pt-2 border-t border-amber-500/20">
          <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider">Awaiting Acceptance</span>
          <button 
            className="v8-btn-primary text-xs h-7 px-3 py-0 w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold"
            onClick={() => onAcceptOrder(order.id, order.orderNumber)}
          >
            <Check className="w-3.5 h-3.5 inline mr-1" /> Accept & Send KOT
          </button>
        </div>
      )}
    </div>
  );
});
OrderCard.displayName = 'OrderCard';

const OrderItemRow = memo(({ item, onUpdateQty }: { item: CartLineItem; onUpdateQty: (id: string, delta: number) => void }) => {
  return (
    <div className="v8-order-item-card">
      <div className="v8-item-main">
        <div className="v8-stepper">
          <button className="v8-stepper-btn" onClick={() => onUpdateQty(item.id, -1)}>
            {item.qty === 1 ? <Trash2 className="w-3 h-3 text-destructive" /> : <Minus className="w-3 h-3" />}
          </button>
          <span className="v8-stepper-count v8-font-mono">{item.qty}</span>
          <button className="v8-stepper-btn" onClick={() => onUpdateQty(item.id, 1)}>
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="v8-item-details">
          <span className="v8-item-name">{item.name}</span>
          {item.notes && <span className="v8-item-notes">"{item.notes}"</span>}
        </div>

        <span className="v8-item-price v8-font-mono">
          {formatCurrency(item.price * item.qty)}
        </span>
      </div>
    </div>
  );
});
OrderItemRow.displayName = 'OrderItemRow';

const ActiveOrderPanel = ({
  table,
  session,
  draftCart,
  onOpenSession,
  onReleaseTable,
  onRestoreTable,
  onUpdateQty,
  onAcceptOrder
}: {
  table: TableEntity | null;
  session: TableSessionData | null;
  draftCart: CartLineItem[];
  onOpenSession: () => void;
  onReleaseTable: () => void;
  onRestoreTable: () => void;
  onUpdateQty: (id: string, delta: number) => void;
  onAcceptOrder?: (id: string, num: number) => void;
}) => {
  const isAvailable = table?.status === 'AVAILABLE';
  const isCleaning = table?.status === 'CLEANING';
  const isOutOfService = table?.status === 'OUT_OF_SERVICE';

  const orders = session?.orders ?? [];

  return (
    <div className="v8-panel-order">
      <div className="v8-order-header">
        <div className="v8-order-top-row">
          <h2 className="v8-order-title">{table ? table.label : 'Express Takeaway'}</h2>
          <span className="v8-order-status-badge">
            {table ? table.status : 'WALK-IN'}
          </span>
        </div>
        <div className="v8-order-meta">
          <span>{table ? `${table.seats} Guests` : 'Counter Sale'}</span>
          <span>·</span>
          <span>Session {session ? session.sessionCode : '#S-NEW'} ({session ? session.startedAt : 'Active'})</span>
        </div>
      </div>

      {isAvailable && (
        <div className="px-5 py-2.5 bg-success/10 border-y border-success/20 flex items-center justify-between">
          <span className="text-xs font-semibold text-success">Table is currently free.</span>
          <button className="v8-btn-primary text-xs h-7 px-3 py-0 w-auto" onClick={onOpenSession}>
            + Open Session
          </button>
        </div>
      )}

      {isCleaning && (
        <div className="px-5 py-2.5 bg-blue-500/10 border-y border-blue-500/20 flex items-center justify-between">
          <span className="text-xs font-semibold text-blue-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Needs cleaning.
          </span>
          <button className="v8-btn-secondary text-xs h-7 px-3 py-0 w-auto" onClick={onReleaseTable}>
            Mark Available
          </button>
        </div>
      )}

      {isOutOfService && (
        <div className="px-5 py-2.5 bg-amber-500/10 border-y border-amber-500/20 flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Out of Service.
          </span>
          <button className="v8-btn-secondary text-xs h-7 px-3 py-0 w-auto" onClick={onRestoreTable}>
            Restore Service
          </button>
        </div>
      )}

      <div className="v8-order-items-scroll v8-scroll flex flex-col gap-3">
        {/* Submitted Active Session Orders */}
        {orders.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-primary" /> Active Session Orders ({orders.length})
            </span>
            {orders.map((ord) => (
              <OrderCard key={ord.id} order={ord} onAcceptOrder={onAcceptOrder} />
            ))}
          </div>
        )}

        {/* Current Unsubmitted KOT Draft Items */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider mt-1">
            New KOT Draft Items ({draftCart.length})
          </span>
          {draftCart.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {orders.length > 0 ? 'Tap menu items to add another KOT order.' : 'No active items in dining session.'}
            </div>
          ) : (
            draftCart.map((item) => (
              <OrderItemRow key={item.id} item={item} onUpdateQty={onUpdateQty} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// --- 5. PAYMENT DIALOG MODAL (INR LOCALIZATION) ---
const PaymentDialogModal = ({
  tableLabel,
  netTotal,
  subtotal,
  tax,
  discountPct,
  discountAmt,
  onComplete,
  onClose
}: {
  tableLabel: string;
  netTotal: number;
  subtotal: number;
  tax: number;
  discountPct: number;
  discountAmt: number;
  onComplete: (tenders: PaymentTenderRecord[]) => void;
  onClose: () => void;
}) => {
  const [isSplitMode, setIsSplitMode] = useState<boolean>(false);
  const [method, setMethod] = useState<'cash' | 'card' | 'upi'>('cash');
  const [tenderAmount, setTenderAmount] = useState<string>('');
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [tenders, setTenders] = useState<PaymentTenderRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const paidTotal = tenders.reduce((acc, t) => acc + t.amount, 0);
  const remainingBalance = Math.max(0, netTotal - paidTotal);

  useEffect(() => {
    setTenderAmount(remainingBalance.toFixed(2));
    setReceivedAmount(remainingBalance.toFixed(2));
  }, [remainingBalance, method]);

  const currentTenderVal = parseFloat(tenderAmount) || 0;
  const currentReceivedVal = parseFloat(receivedAmount) || 0;
  const cashChangeDue = Math.max(0, currentReceivedVal - currentTenderVal);

  const handleAddTender = () => {
    if (isSubmitting) return;

    if (currentTenderVal <= 0) {
      toast.error(`Payment amount must be greater than ${formatCurrency(0)}`);
      return;
    }

    if (currentTenderVal > remainingBalance + 0.01) {
      toast.error(`Payment amount (${formatCurrency(currentTenderVal)}) exceeds remaining balance (${formatCurrency(remainingBalance)})`);
      return;
    }

    if (method === 'cash' && currentReceivedVal < currentTenderVal) {
      toast.error(`Cash received (${formatCurrency(currentReceivedVal)}) is less than tender amount (${formatCurrency(currentTenderVal)})`);
      return;
    }

    const newTender: PaymentTenderRecord = {
      id: `tender-${Date.now()}`,
      method,
      amount: currentTenderVal,
      tenderedAmount: method === 'cash' ? currentReceivedVal : currentTenderVal,
      changeDue: method === 'cash' ? cashChangeDue : 0,
      timestamp: new Date().toLocaleTimeString('en-IN'),
      transactionRef: transactionRef || undefined
    };

    const updatedTenders = [...tenders, newTender];
    setTenders(updatedTenders);
    setTransactionRef('');

    const newPaidTotal = updatedTenders.reduce((acc, t) => acc + t.amount, 0);
    const newRemaining = Math.max(0, netTotal - newPaidTotal);

    if (newRemaining < 0.01 || !isSplitMode) {
      setIsSubmitting(true);
      onComplete(updatedTenders);
    } else {
      toast.success(`Recorded ${formatCurrency(currentTenderVal)} ${method.toUpperCase()} payment. Remaining balance: ${formatCurrency(newRemaining)}`);
    }
  };

  const handleRemoveTender = (id: string) => {
    setTenders((prev) => prev.filter((t) => t.id !== id));
  };

  const isHighBill = currentTenderVal > 1000;

  return (
    <div className="v8-modal-overlay">
      <motion.div 
        className="v8-payment-dialog"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15 }}
      >
        <div className="v8-dialog-header">
          <div>
            <h3 className="font-extrabold text-base flex items-center gap-2">
              <IndianRupeeIcon className="w-5 h-5 text-primary" /> Settle Session — {tableLabel}
            </h3>
            <div className="text-xs text-muted-foreground font-mono">
              Net Session Total: {formatCurrency(netTotal)}
            </div>
          </div>
          <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="v8-dialog-body">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/40 text-xs">
            <span className="font-semibold text-muted-foreground">Payment Mode:</span>
            <div className="flex items-center gap-1.5">
              <button 
                className={cn('px-3 py-1 rounded-lg font-bold transition', !isSplitMode ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
                onClick={() => setIsSplitMode(false)}
              >
                Single Payment
              </button>
              <button 
                className={cn('px-3 py-1 rounded-lg font-bold transition flex items-center gap-1', isSplitMode ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground')}
                onClick={() => setIsSplitMode(true)}
              >
                <Split className="w-3 h-3" /> Split Payment
              </button>
            </div>
          </div>

          {tenders.length > 0 && (
            <div className="flex flex-col gap-1.5 p-3 bg-muted/20 rounded-xl border border-border/30">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">Applied Tenders</span>
              {tenders.map((t) => (
                <div key={t.id} className="v8-tender-pill">
                  <span className="uppercase">{t.method}</span>
                  <span className="v8-font-mono">{formatCurrency(t.amount)}</span>
                  {isSplitMode && (
                    <button className="text-destructive hover:opacity-80 ml-2" onClick={() => handleRemoveTender(t.id)}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-border/20">
                <span>Remaining Due:</span>
                <span className="v8-font-mono text-primary">{formatCurrency(remainingBalance)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <button 
              className={cn(
                'h-12 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition',
                method === 'cash' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setMethod('cash')}
            >
              <IndianRupeeIcon className="w-4 h-4" /> Cash
            </button>
            <button 
              className={cn(
                'h-12 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition',
                method === 'card' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setMethod('card')}
            >
              <CreditCard className="w-4 h-4" /> Card
            </button>
            <button 
              className={cn(
                'h-12 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition',
                method === 'upi' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setMethod('upi')}
            >
              <QrCode className="w-4 h-4" /> UPI QR
            </button>
          </div>

          {method === 'cash' && (
            <div className="flex flex-col gap-3 p-4 bg-muted/20 rounded-xl border border-border/40">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-muted-foreground">Tender Amount:</span>
                <span className="v8-font-mono font-extrabold text-sm">{formatCurrency(currentTenderVal)}</span>
              </div>

              {isSplitMode && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Split Cash Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">₹</span>
                    <input 
                      type="number"
                      step="0.01"
                      className="h-10 pl-7 pr-3 w-full rounded-lg border border-border bg-background text-sm font-bold v8-font-mono outline-none focus:border-primary"
                      value={tenderAmount}
                      onChange={(e) => setTenderAmount(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-muted-foreground">Cash Received</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-base font-extrabold text-muted-foreground">₹</span>
                  <input 
                    type="number"
                    step="0.01"
                    className="h-11 pl-8 pr-3 w-full rounded-lg border border-border bg-background text-base font-extrabold v8-font-mono outline-none focus:border-primary"
                    placeholder="0.00"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                <button className="py-1.5 bg-card border border-border/40 rounded-lg text-xs font-bold hover:border-primary" onClick={() => setReceivedAmount(currentTenderVal.toFixed(2))}>Exact</button>
                {!isHighBill ? (
                  <>
                    <button className="py-1.5 bg-card border border-border/40 rounded-lg text-xs font-bold hover:border-primary" onClick={() => setReceivedAmount('100.00')}>₹100</button>
                    <button className="py-1.5 bg-card border border-border/40 rounded-lg text-xs font-bold hover:border-primary" onClick={() => setReceivedAmount('200.00')}>₹200</button>
                    <button className="py-1.5 bg-card border border-border/40 rounded-lg text-xs font-bold hover:border-primary" onClick={() => setReceivedAmount('500.00')}>₹500</button>
                    <button className="py-1.5 bg-card border border-border/40 rounded-lg text-xs font-bold hover:border-primary" onClick={() => setReceivedAmount('1000.00')}>₹1000</button>
                  </>
                ) : (
                  <>
                    <button className="py-1.5 bg-card border border-border/40 rounded-lg text-xs font-bold hover:border-primary" onClick={() => setReceivedAmount('1500.00')}>₹1500</button>
                    <button className="py-1.5 bg-card border border-border/40 rounded-lg text-xs font-bold hover:border-primary" onClick={() => setReceivedAmount('2000.00')}>₹2000</button>
                    <button className="py-1.5 bg-card border border-border/40 rounded-lg text-xs font-bold hover:border-primary" onClick={() => setReceivedAmount('5000.00')}>₹5000</button>
                    <button className="py-1.5 bg-card border border-border/40 rounded-lg text-xs font-bold hover:border-primary" onClick={() => setReceivedAmount((currentTenderVal + 500).toFixed(2))}>+₹500</button>
                  </>
                )}
              </div>

              {currentReceivedVal >= currentTenderVal && (
                <div className="flex justify-between items-center text-xs font-extrabold text-success pt-2 border-t border-border/30">
                  <span>CHANGE DUE:</span>
                  <span className="v8-font-mono text-base">{formatCurrency(cashChangeDue)}</span>
                </div>
              )}
            </div>
          )}

          {method === 'card' && (
            <div className="flex flex-col gap-3 p-4 bg-muted/20 rounded-xl border border-border/40">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-muted-foreground">Card Transaction Ref / Auth Code (Optional)</label>
                <input 
                  type="text"
                  className="h-10 px-3 rounded-lg border border-border bg-background text-xs font-bold outline-none focus:border-primary"
                  placeholder="e.g. AUTH-88210"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                />
              </div>
            </div>
          )}

          {method === 'upi' && (
            <div className="p-4 bg-muted/20 rounded-xl border border-border/40 flex flex-col items-center gap-2 text-center">
              <QrCode className="w-24 h-24 text-primary animate-pulse" />
              <span className="text-xs font-bold">Dynamic UPI QR Ready</span>
              <span className="text-[11px] text-muted-foreground font-mono">Scan to pay {formatCurrency(currentTenderVal)}</span>
            </div>
          )}

          <button 
            className="v8-btn-primary h-11 text-sm mt-2"
            disabled={isSubmitting}
            onClick={handleAddTender}
          >
            <CheckCircle className="w-4 h-4" /> {isSplitMode ? `Record ${method.toUpperCase()} Payment` : `Confirm & Complete Session (${formatCurrency(netTotal)})`}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Helper Rupee Icon
const IndianRupeeIcon = ({ className }: { className?: string }) => (
  <span className={cn("font-bold inline-block text-center", className)}>₹</span>
);

// --- 6. DINING SESSION RECEIPT PRINT MODAL ---
const ReceiptModal = ({
  receipt,
  onClose
}: {
  receipt: CompletedOrderReceipt;
  onClose: () => void;
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="v8-modal-overlay">
      <motion.div 
        className="v8-payment-dialog max-w-md"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
      >
        <div className="v8-dialog-header">
          <div>
            <h3 className="font-extrabold text-sm flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" /> Session Final Bill Receipt
            </h3>
            <span className="text-xs text-muted-foreground">{receipt.tableLabel} · Session {receipt.sessionId}</span>
          </div>
          <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="v8-dialog-body">
          <div className="v8-receipt-paper v8-receipt-printable">
            <div className="text-center pb-2 border-b border-dashed border-gray-300">
              <div className="font-extrabold text-sm tracking-wider">ORDERRAIL CAFE</div>
              <div className="text-[10px] text-gray-500 font-mono">Workstation #01 · Receipt #{receipt.orderId}</div>
              <div className="text-[10px] text-gray-500">{receipt.timestamp} · Cashier: {receipt.cashierName}</div>
            </div>

            <div className="flex justify-between text-xs font-bold pt-1">
              <span>{receipt.tableLabel}</span>
              <span>Dining Session {receipt.sessionId}</span>
            </div>

            <div className="flex flex-col gap-2 py-2 border-y border-dashed border-gray-300 text-xs">
              {receipt.orders.map((ord) => (
                <div key={ord.id} className="flex flex-col gap-0.5">
                  <div className="font-extrabold text-[10px] text-gray-600 uppercase">Order #{ord.orderNumber} ({ord.timestamp})</div>
                  {ord.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-start pl-1">
                      <span>{item.qty}× {item.name}</span>
                      <span>{formatCurrency(item.price * item.qty)}</span>
                    </div>
                  ))}
                </div>
              ))}

              {receipt.draftItems.length > 0 && (
                <div className="flex flex-col gap-0.5 pt-1 border-t border-dotted border-gray-300">
                  <div className="font-extrabold text-[10px] text-gray-600 uppercase">Counter Items</div>
                  {receipt.draftItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-start pl-1">
                      <span>{item.qty}× {item.name}</span>
                      <span>{formatCurrency(item.price * item.qty)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1 text-xs pt-1">
              <div className="flex justify-between text-gray-600">
                <span>Session Subtotal</span>
                <span>{formatCurrency(receipt.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax (8%)</span>
                <span>{formatCurrency(receipt.tax)}</span>
              </div>
              {receipt.discountAmt > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Discount ({receipt.discountPct}%)</span>
                  <span>-{formatCurrency(receipt.discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-sm pt-2 border-t border-gray-800 mt-1">
                <span>SESSION GRAND TOTAL</span>
                <span>{formatCurrency(receipt.netTotal)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-[11px] pt-2 border-t border-dashed border-gray-300">
              <div className="font-bold text-gray-500 text-[10px] uppercase">Payment Tenders</div>
              {receipt.tenders.map((t) => (
                <div key={t.id} className="flex justify-between">
                  <span className="uppercase">{t.method} {t.transactionRef ? `(${t.transactionRef})` : ''}</span>
                  <span>{formatCurrency(t.amount)}</span>
                </div>
              ))}
            </div>

            <div className="text-center text-[10px] text-gray-400 pt-3 border-t border-dashed border-gray-300">
              Thank you for dining with OrderRail!
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button className="v8-btn-secondary flex-1" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> Print Receipt
            </button>
            <button className="v8-btn-primary flex-1" onClick={onClose}>
              <Check className="w-4 h-4" /> Session Closed / Done
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- 7. RUNNING BILL SUMMARY PANEL (~20% WIDTH) ---
const SummaryPanel = ({
  session,
  draftCart,
  tableLabel,
  onClear,
  onKot,
  onPrintBill,
  onOpenPayment
}: {
  session: TableSessionData | null;
  draftCart: CartLineItem[];
  tableLabel: string;
  onClear: () => void;
  onKot: () => void;
  onPrintBill: () => void;
  onOpenPayment: () => void;
}) => {
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [showDiscount, setShowDiscount] = useState<boolean>(false);

  const submittedOrders = session?.orders ?? [];
  const submittedSubtotal = submittedOrders.reduce((sAcc, ord) => sAcc + ord.subtotal, 0);
  const draftSubtotal = draftCart.reduce((acc, item) => acc + item.price * item.qty, 0);
  const totalSubtotal = submittedSubtotal + draftSubtotal;

  const discountAmt = totalSubtotal * (discountPct / 100);
  const tax = (totalSubtotal - discountAmt) * 0.08;
  const netTotal = totalSubtotal - discountAmt + tax;

  const hasAnyItems = submittedOrders.length > 0 || draftCart.length > 0;

  return (
    <div className="v8-panel-summary">
      <div>
        <div className="flex items-center justify-between">
          <span className="v8-summary-title">Running Bill & Checkout</span>
          <button 
            className="text-[11px] font-bold text-primary hover:underline"
            onClick={() => setShowDiscount(!showDiscount)}
          >
            {showDiscount ? 'Hide Discount' : '+ Discount'}
          </button>
        </div>

        {showDiscount && (
          <div className="grid grid-cols-4 gap-1 mt-2">
            {[0, 5, 10, 15].map((pct) => (
              <button
                key={pct}
                onClick={() => setDiscountPct(pct)}
                className={cn(
                  'py-1 rounded text-[10px] font-bold border transition',
                  discountPct === pct 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-muted/30 border-border/40 text-muted-foreground'
                )}
              >
                {pct === 0 ? '0%' : `${pct}%`}
              </button>
            ))}
          </div>
        )}

        <div className="v8-receipt-breakdown">
          <div className="v8-receipt-row">
            <span>Orders Subtotal ({submittedOrders.length} Orders)</span>
            <span className="v8-font-mono">{formatCurrency(submittedSubtotal)}</span>
          </div>

          {draftSubtotal > 0 && (
            <div className="v8-receipt-row text-primary">
              <span>New KOT Draft</span>
              <span className="v8-font-mono">+{formatCurrency(draftSubtotal)}</span>
            </div>
          )}

          <div className="v8-receipt-row">
            <span>Tax (GST 8%)</span>
            <span className="v8-font-mono">{formatCurrency(tax)}</span>
          </div>

          {discountAmt > 0 && (
            <div className="v8-receipt-row text-success font-semibold">
              <span>Discount ({discountPct}%)</span>
              <span className="v8-font-mono">-{formatCurrency(discountAmt)}</span>
            </div>
          )}

          <div className="v8-receipt-total-box">
            <span className="v8-total-label font-extrabold">SESSION RUNNING BILL</span>
            <span className="v8-total-value">{formatCurrency(netTotal)}</span>
          </div>
        </div>
      </div>

      <div className="v8-summary-actions">
        <button 
          className="v8-btn-primary"
          disabled={!hasAnyItems}
          onClick={onOpenPayment}
        >
          <CreditCard className="w-4 h-4" /> Collect Payment (Settle)
        </button>

        <button 
          className="v8-btn-secondary"
          disabled={draftCart.length === 0}
          onClick={onKot}
        >
          <Send className="w-3.5 h-3.5 text-primary" /> Send KOT (F5)
        </button>

        <button 
          className="v8-btn-ghost"
          disabled={!hasAnyItems}
          onClick={onPrintBill}
        >
          <Printer className="w-3.5 h-3.5" /> Print Bill (F8)
        </button>

        <button 
          className="v8-btn-ghost text-xs"
          disabled={draftCart.length === 0}
          onClick={onClear}
        >
          Clear Draft
        </button>
      </div>
    </div>
  );
};

// --- AUTHENTIC STATUS BAR (32px) ---
const StatusBar = memo(() => {
  return (
    <footer className="v8-status-bar">
      <div className="flex items-center gap-3">
        <span className="v8-kbd-shortcut"><kbd>F1</kbd> Takeaway</span>
        <span className="v8-kbd-shortcut"><kbd>F2</kbd> Search</span>
        <span className="v8-kbd-shortcut"><kbd>F5</kbd> KOT</span>
        <span className="v8-kbd-shortcut"><kbd>F8</kbd> Print</span>
        <span className="v8-kbd-shortcut"><kbd>F10</kbd> Pay Cash</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="v8-sync-dot" />
        <span className="font-bold text-foreground">DINING ENGINE REALTIME OK</span>
      </div>
    </footer>
  );
});
StatusBar.displayName = 'StatusBar';

// --- MAIN WORKSPACE COMPONENT ---
const CounterLayout = () => {
  const tableEngine = useTableEngine();
  const { cafeId } = useCafe();
  const { user } = useAuth();
  
  // Database-driven active table sessions map
  const [tableSessions, setTableSessions] = useState<Record<string, TableSessionData>>({});
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);
  const [activeReceipt, setActiveReceipt] = useState<CompletedOrderReceipt | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Consume shared production menu hook
  const menu = useMenu(cafeId);

  const activeTableId = tableEngine.selectedTableId || 'express';

  // Load ACTIVE dining session orders ONLY from repository (Ignore closed/paid/cancelled historical records)
  const loadSessionsFromDb = useCallback(async () => {
    if (!cafeId) return;

    try {
      const { activeSessions, orders: dbOrders } = await fetchActiveDiningSessionOrders(cafeId);

      // Query database tables directly for official active_session_id
      const { data: dbTables } = await supabase
        .from("tables")
        .select("id, active_session_id")
        .eq("cafe_id", cafeId);

      const activeSessionMap = new Map<string, string>(); // table_id -> active_session_id
      if (dbTables) {
        for (const t of dbTables) {
          if (t.active_session_id) {
            activeSessionMap.set(t.id, t.active_session_id);
          }
        }
      }

      if (activeSessions) {
        for (const s of activeSessions) {
          if (s.table_id && s.status !== "closed" && !activeSessionMap.has(s.table_id)) {
            activeSessionMap.set(s.table_id, s.id);
          }
        }
      }

      if (!dbOrders) return;

      const sessionsMap: Record<string, TableSessionData> = {};

      for (const ord of dbOrders) {
        const tId = ord.table_id || "express";

        // Strict Session Enforcement:
        // Table orders MUST belong to the active dining session of that table.
        if (tId !== "express") {
          const activeSessionId = activeSessionMap.get(tId);
          if (activeSessionId && ord.dining_session_id && ord.dining_session_id !== activeSessionId) {
            continue;
          }
        }

        const mappedItems: CartLineItem[] = (ord.order_items || []).map((it: any) => ({
          id: it.id,
          name: it.name,
          price: it.price_cents / 100,
          qty: it.qty,
        }));

        const mappedStatus = (ord.status.toUpperCase() as SessionOrder['status']);

        const sessOrder: SessionOrder = {
          id: ord.id,
          orderNumber: ord.order_number || Math.floor(100 + Math.random() * 900),
          timestamp: new Date(ord.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          status: mappedStatus,
          items: mappedItems,
          subtotal: (ord.total_cents || 0) / 100
        };

        if (!sessionsMap[tId]) {
          const sId = ord.dining_session_id || activeSessionMap.get(tId) || "";
          const codeSuffix = sId ? sId.substring(0, 4).toUpperCase() : "0000";
          sessionsMap[tId] = {
            sessionId: sId,
            sessionCode: `#S-${codeSuffix}`,
            startedAt: new Date(ord.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            guestCount: 2,
            orders: [],
            draftCart: []
          };
        }

        sessionsMap[tId].orders.push(sessOrder);
      }

      setTableSessions((prev) => {
        const merged: Record<string, TableSessionData> = { ...prev };
        for (const tId of Object.keys(merged)) {
          if (!sessionsMap[tId]) {
            merged[tId] = {
              ...merged[tId],
              sessionId: activeSessionMap.get(tId) || "",
              orders: [],
            };
          }
        }
        for (const [tId, sess] of Object.entries(sessionsMap)) {
          merged[tId] = {
            ...sess,
            draftCart: prev[tId]?.draftCart || []
          };
        }
        return merged;
      });
    } catch (e) {
      console.warn("[CounterPage] Error fetching active DB orders:", e);
    }
  }, [cafeId]);

  useEffect(() => {
    void loadSessionsFromDb();
  }, [loadSessionsFromDb]);

  // Real-time synchronization: Subscribes to Supabase PostgreSQL orders, dining_sessions, and tables channels
  useEffect(() => {
    if (!cafeId) return;

    const realtimeChannel = supabase
      .channel(`counter-realtime-${cafeId}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` },
        () => {
          void loadSessionsFromDb();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dining_sessions" },
        () => {
          void loadSessionsFromDb();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables", filter: `cafe_id=eq.${cafeId}` },
        () => {
          void loadSessionsFromDb();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(realtimeChannel);
    };
  }, [cafeId, loadSessionsFromDb]);

  const selectedTable = tableEngine.tables.find((t) => t.id === tableEngine.selectedTableId) || null;

  // Ensure current table session is initialized with a stable session code per table
  const activeSessionData: TableSessionData = tableSessions[activeTableId] || {
    sessionId: selectedTable?.currentSessionId || "",
    sessionCode: `#S-${selectedTable?.label.replace(/[^0-9]/g, '') || '01'}`,
    startedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    guestCount: selectedTable?.seats || 2,
    orders: [],
    draftCart: []
  };

  const catalog: CatalogItem[] = (menu.items && menu.items.length > 0)
    ? menu.items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price_cents / 100,
        category: item.categoryName || 'General',
        isVeg: item.is_veg ?? true,
        isAvailable: item.is_available ?? true,
        imageUrl: item.image_url,
      }))
    : FALLBACK_CATALOG;

  const categoriesList = (menu.categories && menu.categories.length > 0)
    ? menu.categories.map((c) => c.name)
    : Array.from(new Set(catalog.map((i) => i.category)));

  // Table State Actions
  const handleOpenSession = useCallback(async () => {
    if (!selectedTable || !cafeId) return;
    
    let newSessionId = selectedTable.currentSessionId || "";
    try {
      newSessionId = await createDiningSessionInDb(selectedTable.id, cafeId);
    } catch (e) {
      console.warn("[handleOpenSession] DB session creation warning:", e);
    }

    const res = tableEngine.openTable(selectedTable.id);
    if (res.success) {
      setTableSessions((prev) => ({
        ...prev,
        [selectedTable.id]: {
          sessionId: newSessionId,
          sessionCode: `#S-${selectedTable.label.replace(/[^0-9]/g, '') || '01'}`,
          startedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          guestCount: selectedTable.seats || 2,
          orders: [],
          draftCart: []
        }
      }));
      toast.success(`${selectedTable.label} dining session opened`);
    }
  }, [cafeId, selectedTable, tableEngine]);

  const handleReleaseTable = useCallback(async () => {
    if (!selectedTable) return;
    try {
      await markTableFreeInDb(selectedTable.id, selectedTable.currentSessionId);
    } catch (e) {
      console.warn("[handleReleaseTable] Error:", e);
    }
    const res = tableEngine.releaseTable(selectedTable.id);
    if (res.success) toast.success(`${selectedTable.label} marked available`);
  }, [selectedTable, tableEngine]);

  const handleRestoreTable = useCallback(async () => {
    if (!selectedTable) return;
    try {
      await updateTableStatusInDb(selectedTable.id, "free", null);
    } catch (e) {
      console.warn("[handleRestoreTable] Error:", e);
    }
    const res = tableEngine.restoreAvailable(selectedTable.id);
    if (res.success) toast.success(`${selectedTable.label} restored`);
  }, [selectedTable, tableEngine]);

  // Cart & Order Actions scoped per table
  const handleAddToCart = useCallback((item: CatalogItem) => {
    if (!item.isAvailable) {
      toast.error(`"${item.name}" is currently sold out.`);
      return;
    }

    setTableSessions((prev) => {
      const cur = prev[activeTableId] || {
        sessionId: selectedTable?.currentSessionId || "",
        sessionCode: `#S-${activeTableId.replace(/[^0-9]/g, '') || '01'}`,
        startedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        guestCount: 2,
        orders: [],
        draftCart: []
      };

      const existing = cur.draftCart.find((i) => i.name === item.name);
      let updatedDraft: CartLineItem[];

      if (existing) {
        updatedDraft = cur.draftCart.map((i) => (i.name === item.name ? { ...i, qty: i.qty + 1 } : i));
      } else {
        updatedDraft = [...cur.draftCart, { id: `c-${Date.now()}`, name: item.name, price: item.price, qty: 1 }];
      }

      return {
        ...prev,
        [activeTableId]: {
          ...cur,
          draftCart: updatedDraft
        }
      };
    });

    toast.success(`Added ${item.name} to ${selectedTable?.label ?? 'Express'}`);
  }, [activeTableId, selectedTable]);

  const handleUpdateQty = useCallback((id: string, delta: number) => {
    setTableSessions((prev) => {
      const cur = prev[activeTableId];
      if (!cur) return prev;

      const updatedDraft = cur.draftCart
        .map((item) => {
          if (item.id === id) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartLineItem[];

      return {
        ...prev,
        [activeTableId]: {
          ...cur,
          draftCart: updatedDraft
        }
      };
    });
  }, [activeTableId]);

  const handleClearDraft = useCallback(() => {
    setTableSessions((prev) => {
      const cur = prev[activeTableId];
      if (!cur) return prev;
      return {
        ...prev,
        [activeTableId]: { ...cur, draftCart: [] }
      };
    });
    toast('Draft order cleared');
  }, [activeTableId]);

  // Send KOT — Creates kitchen order via single createOrderInDb pipeline with initial status "preparing"
  const handleKot = useCallback(async () => {
    const cur = activeSessionData;
    if (cur.draftCart.length === 0) {
      toast.error('Add items to draft before sending KOT.');
      return;
    }

    const subtotal = cur.draftCart.reduce((a, i) => a + i.price * i.qty, 0);
    const newOrderNumber = 100 + cur.orders.length + 1;

    // Guarantee a valid dining_session_id in Supabase DB before inserting order using getOrCreateDiningSession helper
    let targetSessionId: string | null = (cur.sessionId && cur.sessionId.length > 10 && !cur.sessionId.startsWith("session-"))
      ? cur.sessionId
      : (selectedTable?.currentSessionId || null);
    
    if (selectedTable && !targetSessionId) {
      try {
        const tableRow = {
          id: selectedTable.id,
          cafe_id: cafeId || '',
          active_session_id: selectedTable.currentSessionId || null,
          label: selectedTable.label,
          seats: selectedTable.seats,
          status: 'free'
        };
        targetSessionId = await getOrCreateDiningSession(tableRow as any);
      } catch (e) {
        console.warn("[handleKot] getOrCreateDiningSession warning:", e);
      }
    }

    try {
      // Create order using unified createOrderInDb pipeline with status "preparing"
      await createOrderInDb({
        cafe_id: cafeId || '',
        table_id: selectedTable?.id || '',
        dining_session_id: targetSessionId,
        total_cents: Math.round(subtotal * 100),
        status: "preparing", // Rule 1: Counter orders have initial status = preparing
        items: cur.draftCart.map((i) => ({
          menu_item_id: i.id.startsWith("c-") ? undefined : i.id,
          name: i.name,
          price_cents: Math.round(i.price * 100),
          qty: i.qty,
        })),
      });

      if (selectedTable) {
        tableEngine.openTable(selectedTable.id);
      }
    } catch (e) {
      console.warn("[handleKot] Database write warning:", e);
    }

    // Clear local draft cart and reload database-driven active sessions
    setTableSessions((prev) => ({
      ...prev,
      [activeTableId]: {
        ...(prev[activeTableId] || cur),
        sessionId: targetSessionId || cur.sessionId,
        draftCart: []
      }
    }));

    await loadSessionsFromDb();
    toast.success(`✅ KOT Spooled & Sent to Kitchen! (Order #${newOrderNumber} for ${selectedTable?.label ?? 'Express'})`);
  }, [activeSessionData, activeTableId, cafeId, loadSessionsFromDb, selectedTable, tableEngine]);

  const handlePrintBill = useCallback(() => {
    if (selectedTable) tableEngine.requestBill(selectedTable.id);
    toast.success(`🖨️ Bill Printed for ${selectedTable?.label ?? 'Express Sale'}`);
  }, [selectedTable, tableEngine]);

  // Complete Payment & CLOSE Active Session (Archives active session from Counter view)
  const handlePaymentComplete = useCallback(async (tenders: PaymentTenderRecord[]) => {
    const cur = activeSessionData;
    const submittedSubtotal = cur.orders.reduce((acc, o) => acc + o.subtotal, 0);
    const draftSubtotal = cur.draftCart.reduce((acc, i) => acc + i.price * i.qty, 0);
    const subtotal = submittedSubtotal + draftSubtotal;

    const discountAmt = subtotal * (discountPct / 100);
    const tax = (subtotal - discountAmt) * 0.08;
    const netTotal = subtotal - discountAmt + tax;

    const receipt: CompletedOrderReceipt = {
      orderId: `OR-${Math.floor(1000 + Math.random() * 9000)}`,
      sessionId: cur.sessionId,
      tableLabel: selectedTable ? selectedTable.label : 'Express Takeaway',
      cashierName: user?.email ? user.email.split('@')[0] : 'Sarah M.',
      timestamp: new Date().toLocaleTimeString('en-IN'),
      orders: cur.orders,
      draftItems: cur.draftCart,
      subtotal,
      tax,
      discountPct,
      discountAmt,
      netTotal,
      tenders
    };

    // 1. Mark orders as served via shared repository function
    try {
      const orderIds = cur.orders.map((o) => o.id);
      for (const orderId of orderIds) {
        await updateOrderStatusInDb(orderId, "served", "staff");
      }

      // 2. Close active dining session in database
      if (cur.sessionId && !cur.sessionId.startsWith("session-")) {
        await closeDiningSessionInDb(cur.sessionId);
      }

      // 3. Move table to "cleaning" in Supabase DB
      if (selectedTable) {
        await updateTableStatusInDb(selectedTable.id, "cleaning", null);
      }
    } catch (e) {
      console.warn("[handlePaymentComplete] DB session closure warning:", e);
    }

    if (selectedTable) {
      tableEngine.markCleaning(selectedTable.id);
    }

    // Immediately remove closed session from Counter active view
    setTableSessions((prev) => {
      const copy = { ...prev };
      delete copy[activeTableId];
      return copy;
    });

    toast.success(`💰 Session Paid & Closed! ${selectedTable ? selectedTable.label + ' needs cleaning.' : ''}`);
    setIsPaymentOpen(false);
    setActiveReceipt(receipt);
  }, [activeSessionData, activeTableId, discountPct, selectedTable, tableEngine, user]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') target.blur();
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'F5') {
        e.preventDefault();
        void handleKot();
      } else if (e.key === 'F8') {
        e.preventDefault();
        handlePrintBill();
      } else if (e.key === 'F10') {
        e.preventDefault();
        setIsPaymentOpen(true);
      } else if (e.key === 'Escape') {
        if (isPaymentOpen) setIsPaymentOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKot, handlePrintBill, isPaymentOpen]);

  // Workflow A: Accept Customer QR Order and send KOT
  const handleAcceptQrOrder = useCallback(async (orderId: string, orderNumber: number) => {
    try {
      await updateOrderStatusInDb(orderId, "preparing", "staff");
      toast.success(`✅ QR Order #${orderNumber} Accepted & Sent to Kitchen!`);
      await loadSessionsFromDb();
    } catch (e) {
      console.warn("[handleAcceptQrOrder] Error:", e);
      toast.error("Failed to accept QR order");
    }
  }, [loadSessionsFromDb]);

  // Calculate Cumulative Totals for Active Session
  const submittedSubtotal = activeSessionData.orders.reduce((a, o) => a + o.subtotal, 0);
  const draftSubtotal = activeSessionData.draftCart.reduce((a, i) => a + i.price * i.qty, 0);
  const subtotal = submittedSubtotal + draftSubtotal;
  const discountAmt = subtotal * (discountPct / 100);
  const tax = (subtotal - discountAmt) * 0.08;
  const netTotal = subtotal - discountAmt + tax;

  return (
    <div className="v8-counter-root">
      <Header />
      <TableRail 
        tables={tableEngine.tables}
        selectedId={tableEngine.selectedTableId}
        onSelect={tableEngine.selectTable}
      />
      <div className="v8-workspace">
        <MenuPanel 
          catalog={catalog}
          categoriesList={categoriesList}
          searchRef={searchRef}
          onAdd={handleAddToCart}
        />
        <ActiveOrderPanel 
          table={selectedTable}
          session={activeSessionData}
          draftCart={activeSessionData.draftCart}
          onOpenSession={handleOpenSession}
          onReleaseTable={handleReleaseTable}
          onRestoreTable={handleRestoreTable}
          onUpdateQty={handleUpdateQty}
          onAcceptOrder={handleAcceptQrOrder}
        />
        <SummaryPanel 
          session={activeSessionData}
          draftCart={activeSessionData.draftCart}
          tableLabel={selectedTable?.label ?? 'Express'}
          onClear={handleClearDraft}
          onKot={() => void handleKot()}
          onPrintBill={handlePrintBill}
          onOpenPayment={() => setIsPaymentOpen(true)}
        />
      </div>
      <StatusBar />

      <AnimatePresence>
        {isPaymentOpen && (
          <PaymentDialogModal 
            tableLabel={selectedTable ? selectedTable.label : 'Express Takeaway'}
            netTotal={netTotal}
            subtotal={subtotal}
            tax={tax}
            discountPct={discountPct}
            discountAmt={discountAmt}
            onComplete={(tenders) => void handlePaymentComplete(tenders)}
            onClose={() => setIsPaymentOpen(false)}
          />
        )}

        {activeReceipt && (
          <ReceiptModal 
            receipt={activeReceipt}
            onClose={() => setActiveReceipt(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- DEFAULT EXPORT ---
export default function CounterPage() {
  return (
    <TableEngineProvider>
      <CounterLayout />
    </TableEngineProvider>
  );
}
