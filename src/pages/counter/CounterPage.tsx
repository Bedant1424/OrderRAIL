import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
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
  QrCode, Printer, CheckCircle, X, ChevronDown, ChevronUp, User, Store, 
  Sparkles, AlertTriangle, Utensils, LayoutGrid, Check, Split, RefreshCw, AlertCircle, Clock, ShoppingBag, Bell, CheckCheck,
  Settings, ArrowLeft, Volume2, VolumeX, BellOff, HandPlatter, Droplet, HelpCircle, Receipt, Smartphone
} from 'lucide-react';

import { getOrCreateDiningSession, createDiningSessionInDb, closeDiningSessionInDb, updateTableStatusInDb, markTableFreeInDb } from '@/lib/tables/tableRepository';
import { createOrderInDb, updateOrderStatusInDb, fetchActiveDiningSessionOrders } from '@/lib/orders/repository';
import { fetchActiveServiceRequests } from '@/lib/serviceRequests/repository';
import { getSessionId } from '@/lib/session';
import { sortTablesNatural } from '@/lib/tables/naturalTableSort';
import { sortCounterOrders } from '@/lib/orders/sortCounterOrders';
import { formatSessionElapsed } from '@/lib/tables/liveSessionTimer';
import {
  loadCounterNotifications,
  saveCounterNotifications,
  sortNotificationsNewestFirst,
  formatRelativeTime,
  loadNotificationSettings,
  saveNotificationSettings,
  isEventNotificationEnabled,
  playNotificationSound,
  triggerBrowserNotification,
  type CounterNotification,
  type CounterNotificationSettings
} from '@/lib/counter/counterNotifications';
import { printService, type KotPrintPayloadData, type ReceiptPrintPayloadData } from '@/lib/printing';

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
  menuItemId?: string;
  name: string;
  price: number;
  qty: number;
  notes?: string;
}

export interface SessionOrder {
  id: string;
  orderNumber: number;
  timestamp: string;
  createdAt?: string;
  status: 'PENDING' | 'ACCEPTED' | 'KOT_SENT' | 'PREPARING' | 'READY' | 'SERVED' | 'PAID' | string;
  items: CartLineItem[];
  subtotal: number;
}

export interface KotPrintPayload {
  orderNumber: number;
  tableLabel: string;
  timestamp: string;
  items: CartLineItem[];
}

export interface TableSessionData {
  sessionId: string;
  sessionCode: string;
  startedAt: string;
  startedAtTimestamp?: string;
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
const Header = memo(({ 
  unreadCount,
  onOpenNotifications,
  onOpenSettings,
}: { 
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
}) => {
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition shadow-soft active:scale-95 shrink-0 cursor-pointer"
            onClick={onOpenNotifications}
            title="Notifications"
            aria-label="Notification center"
          >
            <Bell className="h-4.5 w-4.5 text-foreground" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center bg-destructive text-destructive-foreground"
                style={{
                  minWidth: "16px",
                  height: "16px",
                  borderRadius: "9999px",
                  fontSize: "10px",
                  fontWeight: 700,
                  lineHeight: 1,
                  paddingLeft: unreadCount >= 10 ? "4px" : "0px",
                  paddingRight: unreadCount >= 10 ? "4px" : "0px",
                }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition shadow-soft active:scale-95 shrink-0 cursor-pointer"
            onClick={onOpenSettings}
            title="Notification Settings"
            aria-label="Notification Settings"
          >
            <Settings className="h-4.5 w-4.5 text-foreground" />
          </button>
        </div>

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
const TableChip = memo(({ 
  table, 
  session, 
  nowMs, 
  isSelected, 
  onClick 
}: { 
  table: TableEntity; 
  session?: TableSessionData; 
  nowMs: number; 
  isSelected: boolean; 
  onClick: () => void 
}) => {
  const labelNum = table.label.replace(/[^0-9]/g, '') || table.label.substring(0, 2);
  const dotClass = `v8-dot-${table.status.toLowerCase()}`;
  const isOccupiedOrBill = table.status === 'OCCUPIED' || table.status === 'BILL_REQUESTED';
  const elapsedStr = isOccupiedOrBill ? formatSessionElapsed(session?.startedAtTimestamp, nowMs) : null;

  return (
    <button 
      className={cn('v8-table-chip', isSelected && 'v8-table-chip--selected')}
      onClick={onClick}
    >
      <span className={cn('v8-table-dot', dotClass)} />
      <span>{table.label.length > 4 ? `T${labelNum}` : table.label}</span>
      {elapsedStr && <span className="v8-chip-timer">{elapsedStr}</span>}
    </button>
  );
});
TableChip.displayName = 'TableChip';

const TableRail = memo(({ 
  tables, 
  tableSessions, 
  nowMs, 
  selectedId, 
  onSelect 
}: { 
  tables: TableEntity[]; 
  tableSessions: Record<string, TableSessionData>; 
  nowMs: number; 
  selectedId: string | null; 
  onSelect: (id: string) => void;
}) => {
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
            session={tableSessions[t.id]}
            nowMs={nowMs}
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
const OrderCard = memo(({ 
  order, 
  tableLabel, 
  onAcceptOrder, 
  onSendKot, 
  onReprintKot 
}: { 
  order: SessionOrder; 
  tableLabel: string; 
  onAcceptOrder?: (id: string, num: number) => void;
  onSendKot?: (order: SessionOrder, label: string) => void;
  onReprintKot?: (order: SessionOrder, label: string) => void;
}) => {
  const getStatusBadgeClass = (status: string) => {
    const s = (status || 'PENDING').toUpperCase();
    switch (s) {
      case 'PENDING':
      case 'NEW':
        return 'bg-amber-500/20 text-amber-600 border-amber-500/30 animate-pulse';
      case 'ACCEPTED':
        return 'bg-blue-500/15 text-blue-600 border-blue-500/20';
      case 'KOT_SENT':
      case 'KOT SENT':
        return 'bg-indigo-500/15 text-indigo-600 border-indigo-500/20';
      case 'PREPARING':
        return 'bg-orange-500/15 text-orange-600 border-orange-500/20';
      case 'READY':
        return 'bg-purple-500/15 text-purple-600 border-purple-500/20';
      case 'SERVED':
        return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20';
      case 'PAID':
        return 'bg-muted text-muted-foreground border-border';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const statusUpper = (order.status || 'PENDING').toUpperCase();
  const isPending = statusUpper === 'PENDING' || statusUpper === 'NEW';
  const isAccepted = statusUpper === 'ACCEPTED';
  const isKotSentOrBeyond = ['KOT_SENT', 'KOT SENT', 'PREPARING', 'READY', 'SERVED', 'PAID'].includes(statusUpper);

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
          {isPending ? 'NEW' : statusUpper === 'KOT_SENT' ? 'KOT SENT' : order.status.replace('_', ' ')}
        </span>
      </div>

      <div className="flex flex-col gap-1 py-1 border-y border-border/20 text-xs">
        {order.items.map((it) => (
          <div key={it.id} className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center text-xs">
              <span><strong className="text-primary">{it.qty}×</strong> {it.name}</span>
              <span className="v8-font-mono text-muted-foreground">{formatCurrency(it.price * it.qty)}</span>
            </div>
            {it.notes && (
              <span className="text-[10px] italic text-muted-foreground pl-3">"{it.notes}"</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center text-xs font-bold pt-0.5">
        <span className="text-muted-foreground text-[11px]">Order Total:</span>
        <span className="v8-font-mono">{formatCurrency(order.subtotal)}</span>
      </div>

      <div className="pt-2 border-t border-border/30 flex justify-end items-center">
        {isPending && onAcceptOrder && (
          <button 
            className="v8-btn-primary text-xs h-7 px-3 py-0 w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1"
            onClick={() => onAcceptOrder(order.id, order.orderNumber)}
          >
            <Check className="w-3.5 h-3.5" /> Accept Order
          </button>
        )}

        {isAccepted && onSendKot && (
          <button 
            className="v8-btn-primary text-xs h-7 px-3 py-0 w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold flex items-center gap-1 shadow-sm"
            onClick={() => onSendKot(order, tableLabel)}
          >
            <Printer className="w-3.5 h-3.5" /> Send KOT
          </button>
        )}

        {isKotSentOrBeyond && onReprintKot && (
          <button 
            className="v8-btn-secondary text-xs h-7 px-3 py-0 w-auto text-muted-foreground hover:text-foreground font-bold flex items-center gap-1 border border-border/50"
            onClick={() => onReprintKot(order, tableLabel)}
          >
            <Printer className="w-3.5 h-3.5" /> Reprint KOT
          </button>
        )}
      </div>
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
  nowMs = Date.now(),
  draftCart,
  onOpenSession,
  onReleaseTable,
  onRestoreTable,
  onUpdateQty,
  onAcceptOrder,
  onSendKot,
  onReprintKot
}: {
  table: TableEntity | null;
  session: TableSessionData | null;
  nowMs?: number;
  draftCart: CartLineItem[];
  onOpenSession: () => void;
  onReleaseTable: () => void;
  onRestoreTable: () => void;
  onUpdateQty: (id: string, delta: number) => void;
  onAcceptOrder?: (id: string, num: number) => void;
  onSendKot?: (order: SessionOrder, label: string) => void;
  onReprintKot?: (order: SessionOrder, label: string) => void;
}) => {
  const isAvailable = table?.status === 'AVAILABLE';
  const isCleaning = table?.status === 'CLEANING';
  const isOutOfService = table?.status === 'OUT_OF_SERVICE';

  const rawOrders = session?.orders ?? [];
  const orders = useMemo(() => sortCounterOrders(rawOrders), [rawOrders]);
  const tableLabel = table ? table.label : 'Express Takeaway';

  const sessionElapsed = (table?.status === 'OCCUPIED' || table?.status === 'BILL_REQUESTED') && session?.startedAtTimestamp
    ? formatSessionElapsed(session.startedAtTimestamp, nowMs)
    : null;

  return (
    <div className="v8-panel-order">
      <div className="v8-order-header">
        <div className="v8-order-top-row">
          <h2 className="v8-order-title">{tableLabel}</h2>
          <span className="v8-order-status-badge">
            {table ? table.status : 'WALK-IN'}
          </span>
        </div>
        <div className="v8-order-meta">
          <span>{table ? `${table.seats} Guests` : 'Counter Sale'}</span>
          <span>·</span>
          <span>Session {session ? session.sessionCode : '#S-NEW'} ({sessionElapsed ? `${sessionElapsed} active` : (session ? session.startedAt : 'Active')})</span>
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
              <OrderCard 
                key={ord.id} 
                order={ord} 
                tableLabel={tableLabel}
                onAcceptOrder={onAcceptOrder} 
                onSendKot={onSendKot}
                onReprintKot={onReprintKot}
              />
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
  session,
  onComplete,
  onClose
}: {
  tableLabel: string;
  netTotal: number;
  subtotal: number;
  tax: number;
  discountPct: number;
  discountAmt: number;
  session?: TableSessionData;
  onComplete: (tenders: PaymentTenderRecord[]) => void;
  onClose: () => void;
}) => {
  const [isSplitMode, setIsSplitMode] = useState<boolean>(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState<boolean>(false);
  const [method, setMethod] = useState<'cash' | 'card' | 'upi'>('cash');
  const [tenderAmount, setTenderAmount] = useState<string>('');
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [tenders, setTenders] = useState<PaymentTenderRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Compute itemized list & statistics across active orders & draft cart
  const { totalOrdersCount, totalItemsCount, itemizedItems } = useMemo(() => {
    let ordersCount = session?.orders?.length || 1;
    if (session?.draftCart && session.draftCart.length > 0) {
      ordersCount += 1;
    }

    let itemsCount = 0;
    const itemMap = new Map<string, { name: string; qty: number; totalPrice: number }>();

    session?.orders?.forEach((ord) => {
      ord.items?.forEach((i) => {
        itemsCount += i.qty;
        const existing = itemMap.get(i.name);
        if (existing) {
          existing.qty += i.qty;
          existing.totalPrice += i.price * i.qty;
        } else {
          itemMap.set(i.name, { name: i.name, qty: i.qty, totalPrice: i.price * i.qty });
        }
      });
    });

    session?.draftCart?.forEach((i) => {
      itemsCount += i.qty;
      const existing = itemMap.get(i.name);
      if (existing) {
        existing.qty += i.qty;
        existing.totalPrice += i.price * i.qty;
      } else {
        itemMap.set(i.name, { name: i.name, qty: i.qty, totalPrice: i.price * i.qty });
      }
    });

    const itemsList = Array.from(itemMap.values());
    if (itemsCount === 0 && itemsList.length === 0) {
      itemsCount = 1;
    }

    return {
      totalOrdersCount: ordersCount,
      totalItemsCount: itemsCount,
      itemizedItems: itemsList,
    };
  }, [session]);

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

  const displayTableLabel = tableLabel.toLowerCase().startsWith('table') ? tableLabel : `Table ${tableLabel}`;

  return (
    <div className="v8-modal-overlay">
      <motion.div 
        className="v8-payment-dialog"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15 }}
      >
        {/* 1. FIXED HEADER */}
        <div className="v8-dialog-header">
          <div>
            <h3 className="font-extrabold text-lg text-foreground flex items-center gap-2">
              Collect Payment
            </h3>
            <div className="text-xs font-semibold text-muted-foreground mt-0.5">
              {displayTableLabel}
            </div>
          </div>
          <button className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. FIXED AMOUNT DUE Visual Focus Card */}
        <div className="p-3.5 bg-primary/5 dark:bg-primary/10 border-b border-border/30 text-center flex flex-col items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Amount Due</span>
          <span className="text-3xl font-black text-primary v8-font-mono tracking-tight mt-0.5">
            {formatCurrency(netTotal)}
          </span>
        </div>

        {/* 3. SCROLLABLE CENTER CONTENT BODY */}
        <div className="v8-dialog-body">
          {/* Collapsible Bill Summary Card */}
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden transition-all text-left">
            <button
              type="button"
              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between font-bold text-xs bg-muted/30 hover:bg-muted/50 transition cursor-pointer select-none"
            >
              <span className="flex items-center gap-1.5 text-foreground">
                {isSummaryExpanded ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                Bill Summary
              </span>
              <span className="text-[11px] font-mono text-muted-foreground font-normal">
                Items: {totalItemsCount}
              </span>
            </button>

            {!isSummaryExpanded ? (
              <div className="p-3 flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Items</span>
                  <span className="font-mono font-medium">{totalItemsCount}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>GST</span>
                  <span className="font-mono font-medium">{formatCurrency(tax)}</span>
                </div>
                {discountAmt > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                    <span>Discount ({discountPct}%)</span>
                    <span className="font-mono font-medium">-{formatCurrency(discountAmt)}</span>
                  </div>
                )}
                <div className="border-t border-border/40 pt-1.5 mt-0.5 flex justify-between items-center font-bold text-foreground">
                  <span>Total</span>
                  <span className="font-mono text-sm text-primary">{formatCurrency(netTotal)}</span>
                </div>
              </div>
            ) : (
              <div className="p-3 flex flex-col gap-2 text-xs">
                <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1 divide-y divide-border/20">
                  {itemizedItems.length === 0 ? (
                    <div className="py-2 text-center text-muted-foreground text-xs">No items on bill</div>
                  ) : (
                    itemizedItems.map((item, idx) => (
                      <div key={idx} className="pt-1.5 first:pt-0 flex justify-between items-center">
                        <span className="font-medium text-foreground">
                          <span className="font-bold text-primary mr-1.5">{item.qty} ×</span>
                          {item.name}
                        </span>
                        <span className="font-mono text-muted-foreground">{formatCurrency(item.totalPrice)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-border/40 pt-2 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>GST</span>
                    <span className="font-mono font-medium">{formatCurrency(tax)}</span>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                      <span>Discount ({discountPct}%)</span>
                      <span className="font-mono font-medium">-{formatCurrency(discountAmt)}</span>
                    </div>
                  )}
                  <div className="border-t border-border/40 pt-1.5 flex justify-between items-center font-extrabold text-foreground">
                    <span>Grand Total</span>
                    <span className="font-mono text-sm text-primary">{formatCurrency(netTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

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
              <Smartphone className="w-4 h-4" /> UPI
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
            <div className="p-4 bg-muted/20 rounded-xl border border-border/40 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <Smartphone className="w-4 h-4 text-primary" />
                  <span>📱 UPI Payment</span>
                </div>
                <span className="v8-font-mono font-extrabold text-xs text-foreground">
                  {formatCurrency(currentTenderVal)}
                </span>
              </div>

              <p className="text-xs text-muted-foreground text-left">
                Customer is paying using the restaurant's QR.
              </p>

              <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-card border border-border/40 text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</span>
                {isSubmitting ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>✅ Payment Received</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>⏳ Awaiting cashier confirmation</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4. FIXED STICKY FOOTER ACTION BUTTON */}
        <div className="v8-dialog-footer">
          <button 
            className="v8-btn-primary w-full h-11 text-sm font-bold flex items-center justify-center gap-2"
            disabled={isSubmitting}
            onClick={handleAddTender}
          >
            <CheckCircle className="w-4 h-4" /> {
              method === 'upi'
                ? (isSubmitting ? '✅ Payment Received' : '✓ Confirm Payment')
                : (isSplitMode ? `Record ${method.toUpperCase()} Payment` : `Confirm & Complete Session (${formatCurrency(netTotal)})`)
            }
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
// Helper to aggregate item quantities and total prices across all orders + draft items
function aggregateReceiptItems(receipt: CompletedOrderReceipt) {
  const itemMap = new Map<string, { id: string; name: string; qty: number; unitPrice: number; totalPrice: number }>();

  const allItems = [
    ...receipt.orders.flatMap((o) => o.items),
    ...receipt.draftItems
  ];

  for (const item of allItems) {
    const key = `${item.name.trim().toLowerCase()}_${item.price}`;
    const existing = itemMap.get(key);
    if (existing) {
      existing.qty += item.qty;
      existing.totalPrice += item.price * item.qty;
    } else {
      itemMap.set(key, {
        id: item.id || key,
        name: item.name,
        qty: item.qty,
        unitPrice: item.price,
        totalPrice: item.price * item.qty
      });
    }
  }

  return Array.from(itemMap.values());
}

// --- 6. DINING SESSION RECEIPT PRINT MODAL ---
const ReceiptModal = ({
  receipt,
  onClose
}: {
  receipt: CompletedOrderReceipt;
  onClose: () => void;
}) => {
  const handlePrint = async () => {
    const aggregated = aggregateReceiptItems(receipt);
    const payload: ReceiptPrintPayloadData = {
      type: 'RECEIPT',
      orderId: receipt.orderId,
      billNumber: `BILL-${receipt.orderId.replace(/[^0-9]/g, '') || '101'}`,
      sessionId: receipt.sessionId,
      tableLabel: receipt.tableLabel,
      cashierName: receipt.cashierName,
      timestamp: receipt.timestamp,
      items: aggregated.map((i) => ({ id: i.id, name: i.name, price: i.unitPrice, qty: i.qty })),
      subtotal: receipt.subtotal,
      tax: receipt.tax,
      discountPct: receipt.discountPct,
      discountAmt: receipt.discountAmt,
      netTotal: receipt.netTotal,
      tenders: receipt.tenders.map((t) => ({ method: t.method, amount: t.amount })),
    };

    const { success } = await printService.enqueue('RECEIPT', 'BILL_PRINTER', payload, { orderId: receipt.orderId });
    if (success) {
      toast.success('🖨️ Receipt sent to printer.');
    } else {
      toast.error('❌ Failed to print receipt.');
    }
  };

  const aggregatedItems = aggregateReceiptItems(receipt);
  const rawBillId = receipt.orderId ? receipt.orderId.replace(/^OR-?/i, '') : '';
  const billLabel = rawBillId ? `Bill #${rawBillId}` : 'Bill #101';

  return (
    <div className="v8-modal-overlay">
      <motion.div 
        className="v8-payment-dialog v8-receipt-modal-dialog max-w-md"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
      >
        <div className="v8-dialog-header">
          <div>
            <h3 className="font-extrabold text-sm flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" /> Receipt Preview
            </h3>
            <span className="text-xs text-muted-foreground">{receipt.tableLabel}{receipt.timestamp ? ` · ${receipt.timestamp}` : ''}</span>
          </div>
          <button className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="v8-receipt-preview-container">
          <div className="v8-receipt-paper v8-receipt-printable">
            {/* Simplified Restaurant Customer Bill Header */}
            <div className="text-center pb-2 border-b border-dashed border-gray-300">
              <div className="font-extrabold text-base tracking-wider text-gray-900">ORDERRAIL CAFE</div>
              <div className="font-extrabold text-xs text-gray-800 mt-0.5">{billLabel}</div>
              <div className="text-[10px] text-gray-500 mt-1 flex justify-center items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-gray-700">{receipt.tableLabel}</span>
                <span>·</span>
                <span>{receipt.timestamp}</span>
              </div>
              {receipt.cashierName && (
                <div className="text-[10px] text-gray-400 mt-0.5">Cashier: {receipt.cashierName}</div>
              )}
            </div>

            {/* Consolidated Aggregated Items List */}
            <div className="flex flex-col gap-1.5 py-2 border-b border-dashed border-gray-300 text-xs">
              <div className="flex justify-between items-center text-[9px] font-extrabold text-gray-400 uppercase tracking-wider pb-1 border-b border-gray-100">
                <span>Items</span>
                <span>Amount</span>
              </div>
              {aggregatedItems.map((item) => (
                <div key={item.id} className="flex justify-between items-start text-gray-800 pl-0.5">
                  <span className="font-medium pr-2">
                    <span className="font-bold text-gray-900">{item.qty}×</span> {item.name}
                  </span>
                  <span className="font-mono text-gray-900 shrink-0">{formatCurrency(item.totalPrice)}</span>
                </div>
              ))}
            </div>

            {/* Totals Section */}
            <div className="flex flex-col gap-1 text-xs pt-1">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-mono">{formatCurrency(receipt.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax (8%)</span>
                <span className="font-mono">{formatCurrency(receipt.tax)}</span>
              </div>
              {receipt.discountAmt > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Discount ({receipt.discountPct}%)</span>
                  <span className="font-mono">-{formatCurrency(receipt.discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-sm pt-2 border-t border-gray-800 mt-1 text-gray-900">
                <span>GRAND TOTAL</span>
                <span className="font-mono">{formatCurrency(receipt.netTotal)}</span>
              </div>
            </div>

            {/* Payment Tenders */}
            <div className="flex flex-col gap-1 text-[11px] pt-2 border-t border-dashed border-gray-300">
              <div className="font-bold text-gray-500 text-[10px] uppercase">Payment Tenders</div>
              {receipt.tenders.map((t) => (
                <div key={t.id} className="flex justify-between">
                  <span className="uppercase">{t.method} {t.transactionRef ? `(${t.transactionRef})` : ''}</span>
                  <span className="font-mono">{formatCurrency(t.amount)}</span>
                </div>
              ))}
            </div>

            <div className="text-center text-[10px] text-gray-400 pt-3 border-t border-dashed border-gray-300">
              Thank you for dining with OrderRail!
            </div>
          </div>
        </div>

        <div className="v8-dialog-footer">
          <button className="v8-btn-secondary flex-1" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Print Receipt
          </button>
          <button className="v8-btn-primary flex-1" onClick={onClose}>
            <Check className="w-4 h-4" /> Session Closed / Done
          </button>
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

// --- NOTIFICATION CENTER DRAWER ---
const CounterNotificationDrawer = ({
  isOpen,
  initialTab = 'notifications',
  notifications,
  settings,
  nowMs,
  onClose,
  onMarkAllAsRead,
  onClearHistory,
  onDismiss,
  onMarkAsRead,
  onUpdateSettings,
}: {
  isOpen: boolean;
  initialTab?: 'notifications' | 'settings';
  notifications: CounterNotification[];
  settings: CounterNotificationSettings;
  nowMs: number;
  onClose: () => void;
  onMarkAllAsRead: () => void;
  onClearHistory: () => void;
  onDismiss: (id: string) => void;
  onMarkAsRead: (id: string) => void;
  onUpdateSettings: (updated: CounterNotificationSettings) => void;
}) => {
  const [activeTab, setActiveTab] = useState<'notifications' | 'settings'>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const toggleGeneralSetting = (key: keyof CounterNotificationSettings['general']) => {
    const updated: CounterNotificationSettings = {
      ...settings,
      general: {
        ...settings.general,
        [key]: !settings.general[key],
      },
    };

    if (key === 'enableSound' && updated.general.enableSound) {
      playNotificationSound();
    }

    if (key === 'enableBrowserNotifications' && updated.general.enableBrowserNotifications) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        void Notification.requestPermission();
      }
    }

    onUpdateSettings(updated);
  };

  const toggleEventTypeSetting = (key: keyof CounterNotificationSettings['eventTypes']) => {
    const updated: CounterNotificationSettings = {
      ...settings,
      eventTypes: {
        ...settings.eventTypes,
        [key]: !settings.eventTypes[key],
      },
    };
    onUpdateSettings(updated);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 250 }}
          className="w-full max-w-sm h-full bg-card border-l border-border shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeTab === 'settings' ? (
                <button
                  onClick={() => setActiveTab('notifications')}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground mr-1"
                  title="Back to Notifications"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <Bell className="w-4 h-4 text-primary" />
              )}
              <h3 className="font-bold text-sm text-foreground">
                {activeTab === 'settings' ? 'Notification Settings' : 'Notifications'}
              </h3>
              {activeTab === 'notifications' && unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'notifications' ? (
                <>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition"
                    title="Notification Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {activeTab === 'settings' ? (
            /* Settings Panel */
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 text-xs">
              {/* 1. General Settings */}
              <div className="flex flex-col gap-3">
                <h4 className="font-extrabold text-foreground uppercase tracking-wider text-[10px] text-muted-foreground">
                  General
                </h4>

                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/50">
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">Enable notifications</span>
                    <span className="text-[11px] text-muted-foreground">Master alert notifications</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.general.enableNotifications}
                    onChange={() => toggleGeneralSetting('enableNotifications')}
                    className="w-4 h-4 rounded-md border-border accent-primary cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/50">
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-primary" /> Notification sound
                    </span>
                    <span className="text-[11px] text-muted-foreground">Play chime on new alert</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.general.enableSound}
                    onChange={() => toggleGeneralSetting('enableSound')}
                    className="w-4 h-4 rounded-md border-border accent-primary cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/50">
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">Browser notifications</span>
                    <span className="text-[11px] text-muted-foreground">Desktop popups when unfocused</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.general.enableBrowserNotifications}
                    onChange={() => toggleGeneralSetting('enableBrowserNotifications')}
                    className="w-4 h-4 rounded-md border-border accent-primary cursor-pointer"
                  />
                </div>
              </div>

              {/* 2. Event Types */}
              <div className="flex flex-col gap-3">
                <h4 className="font-extrabold text-foreground uppercase tracking-wider text-[10px] text-muted-foreground">
                  Event Types
                </h4>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card/30">
                  <span className="font-medium text-foreground flex items-center gap-2">
                    <ShoppingBag className="w-3.5 h-3.5 text-amber-500" /> New customer orders
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.eventTypes.newOrder}
                    onChange={() => toggleEventTypeSetting('newOrder')}
                    className="w-4 h-4 rounded-md border-border accent-primary cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card/30">
                  <span className="font-medium text-foreground flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Order served
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.eventTypes.orderServed}
                    onChange={() => toggleEventTypeSetting('orderServed')}
                    className="w-4 h-4 rounded-md border-border accent-primary cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card/30">
                  <span className="font-medium text-foreground flex items-center gap-2">
                    <Droplet className="w-3.5 h-3.5 text-blue-500" /> Need Water
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.eventTypes.needWater}
                    onChange={() => toggleEventTypeSetting('needWater')}
                    className="w-4 h-4 rounded-md border-border accent-primary cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card/30">
                  <span className="font-medium text-foreground flex items-center gap-2">
                    <Receipt className="w-3.5 h-3.5 text-warning" /> Need Bill
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.eventTypes.needBill}
                    onChange={() => toggleEventTypeSetting('needBill')}
                    className="w-4 h-4 rounded-md border-border accent-primary cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card/30">
                  <span className="font-medium text-foreground flex items-center gap-2">
                    <HandPlatter className="w-3.5 h-3.5 text-purple-500" /> Call Waiter
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.eventTypes.callWaiter}
                    onChange={() => toggleEventTypeSetting('callWaiter')}
                    className="w-4 h-4 rounded-md border-border accent-primary cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card/30">
                  <span className="font-medium text-foreground flex items-center gap-2">
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" /> Need Help
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.eventTypes.needHelp}
                    onChange={() => toggleEventTypeSetting('needHelp')}
                    className="w-4 h-4 rounded-md border-border accent-primary cursor-pointer"
                  />
                </div>
              </div>

              {/* 3. History Actions */}
              <div className="flex flex-col gap-3 pt-2 border-t border-border">
                <h4 className="font-extrabold text-foreground uppercase tracking-wider text-[10px] text-muted-foreground">
                  History
                </h4>

                <div className="flex items-center gap-2">
                  <button
                    onClick={onMarkAllAsRead}
                    disabled={unreadCount === 0}
                    className="flex-1 py-2 px-3 rounded-xl border border-border bg-secondary/50 hover:bg-secondary disabled:opacity-50 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-primary" /> Mark all as read
                  </button>

                  <button
                    onClick={onClearHistory}
                    disabled={notifications.length === 0}
                    className="flex-1 py-2 px-3 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear history
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Notification List */
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <Bell className="w-8 h-8 text-muted-foreground/40" />
                  <span>No notifications yet.</span>
                </div>
              ) : (
                notifications.map((n) => {
                  const relativeTime = formatRelativeTime(n.timestamp, nowMs);

                  const renderNotifIcon = () => {
                    switch (n.type) {
                      case 'order_served':
                        return (
                          <div className="p-2 rounded-xl shrink-0 mt-0.5 bg-emerald-500/10 text-emerald-600">
                            <CheckCircle className="w-4 h-4" />
                          </div>
                        );
                      case 'need_water':
                        return (
                          <div className="p-2 rounded-xl shrink-0 mt-0.5 bg-blue-500/10 text-blue-600">
                            <Droplet className="w-4 h-4" />
                          </div>
                        );
                      case 'need_bill':
                        return (
                          <div className="p-2 rounded-xl shrink-0 mt-0.5 bg-yellow-500/10 text-yellow-600">
                            <Receipt className="w-4 h-4" />
                          </div>
                        );
                      case 'call_waiter':
                        return (
                          <div className="p-2 rounded-xl shrink-0 mt-0.5 bg-purple-500/10 text-purple-600">
                            <HandPlatter className="w-4 h-4" />
                          </div>
                        );
                      case 'need_help':
                        return (
                          <div className="p-2 rounded-xl shrink-0 mt-0.5 bg-indigo-500/10 text-indigo-600">
                            <HelpCircle className="w-4 h-4" />
                          </div>
                        );
                      case 'new_order':
                      default:
                        return (
                          <div className="p-2 rounded-xl shrink-0 mt-0.5 bg-amber-500/10 text-amber-600">
                            <ShoppingBag className="w-4 h-4" />
                          </div>
                        );
                    }
                  };

                  return (
                    <div
                      key={n.id}
                      onClick={() => onMarkAsRead(n.id)}
                      className={cn(
                        "p-3 rounded-xl border flex items-start gap-3 transition cursor-pointer relative",
                        n.read
                          ? "bg-card/40 border-border/40 opacity-70"
                          : "bg-card border-border shadow-xs"
                      )}
                    >
                      {renderNotifIcon()}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-xs text-foreground">
                            {n.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {relativeTime}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {n.description}
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDismiss(n.id);
                        }}
                        className="text-muted-foreground/60 hover:text-foreground p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>

                      {!n.read && (
                        <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
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
  
  // Single shared 1-second interval timer tick for the entire Counter page
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Database-driven active table sessions map & real DB tables state
  const [tableSessions, setTableSessions] = useState<Record<string, TableSessionData>>({});
  const [dbTablesList, setDbTablesList] = useState<any[]>([]);
  const [dbTablesMap, setDbTablesMap] = useState<Record<string, { status: string; active_session_id: string | null }>>({});
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);
  const [activeReceipt, setActiveReceipt] = useState<CompletedOrderReceipt | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Consume shared production menu hook
  const menu = useMenu(cafeId);

  // Notification State, Settings & Event Trackers
  const [notifications, setNotifications] = useState<CounterNotification[]>(() => loadCounterNotifications(cafeId));
  const [notifSettings, setNotifSettings] = useState<CounterNotificationSettings>(() => loadNotificationSettings(cafeId));
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<'notifications' | 'settings'>('notifications');
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const knownServedOrderIdsRef = useRef<Set<string>>(new Set());
  const knownServiceRequestIdsRef = useRef<Set<string>>(new Set());
  const notifSettingsRef = useRef<CounterNotificationSettings>(notifSettings);

  const handleOpenNotifications = useCallback(() => {
    setDrawerTab('notifications');
    setIsNotifOpen(true);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setDrawerTab('settings');
    setIsNotifOpen(true);
  }, []);

  useEffect(() => {
    notifSettingsRef.current = notifSettings;
  }, [notifSettings]);

  // Load persisted notifications and settings on cafeId change
  useEffect(() => {
    if (cafeId) {
      setNotifications(loadCounterNotifications(cafeId));
      setNotifSettings(loadNotificationSettings(cafeId));
    }
  }, [cafeId]);

  // Save notifications to localStorage whenever updated
  useEffect(() => {
    if (cafeId) {
      saveCounterNotifications(cafeId, notifications);
    }
  }, [cafeId, notifications]);

  const handleUpdateSettings = useCallback((updated: CounterNotificationSettings) => {
    setNotifSettings(updated);
    if (cafeId) {
      saveNotificationSettings(cafeId, updated);
    }
  }, [cafeId]);

  const handleClearHistory = useCallback(() => {
    setNotifications([]);
    if (cafeId) {
      saveCounterNotifications(cafeId, []);
    }
    toast.success("Notification history cleared");
  }, [cafeId]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const handleMarkAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleMarkAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const handleDismissNotif = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Load ACTIVE dining session orders ONLY from repository (Ignore closed/paid/cancelled historical records)
  const loadSessionsFromDb = useCallback(async () => {
    if (!cafeId) return;

    try {
      const { activeSessions, orders: dbOrders } = await fetchActiveDiningSessionOrders(cafeId);

      // Query database tables directly for official status & active_session_id
      const { data: dbTablesData } = await supabase
        .from("tables")
        .select("*")
        .eq("cafe_id", cafeId)
        .order("label", { numeric: true, sensitivity: "base" });

      const tableMap: Record<string, { status: string; active_session_id: string | null }> = {};
      const activeSessionMap = new Map<string, string>(); // table_id -> active_session_id
      const activeSessionCreatedAtMap = new Map<string, string>(); // table_id -> created_at ISO

      if (dbTablesData) {
        const sortedDbTables = sortTablesNatural(dbTablesData);
        setDbTablesList(sortedDbTables);
        for (const t of sortedDbTables) {
          tableMap[t.id] = { status: t.status, active_session_id: t.active_session_id };
          if (t.active_session_id) {
            activeSessionMap.set(t.id, t.active_session_id);
          }
        }
      }
      setDbTablesMap(tableMap);

      if (activeSessions) {
        for (const s of activeSessions) {
          if (s.table_id && s.status !== "closed") {
            if (!activeSessionMap.has(s.table_id)) {
              activeSessionMap.set(s.table_id, s.id);
            }
            if (s.created_at) {
              activeSessionCreatedAtMap.set(s.table_id, s.created_at);
            }
          }
        }
      }

      if (!dbOrders) return;

      const incomingNotifs: CounterNotification[] = [];
      const isFirstLoad = knownOrderIdsRef.current.size === 0;

      for (const ord of dbOrders) {
        const ordId = ord.id;
        const tableObj = dbTablesData?.find((t: any) => t.id === ord.table_id);
        const tableLabel = tableObj ? tableObj.label : (ord.table_id ? 'Table' : 'Takeaway');
        const cleanTableLabel = tableLabel.toLowerCase().startsWith('table') ? tableLabel.substring(5).trim() : tableLabel;
        const orderNum = ord.order_number || Math.floor(100 + Math.random() * 900);
        const isServed = ord.status === 'served' || ord.status === 'SERVED' || ord.status === 'paid' || ord.status === 'PAID';

        // Event 1: New Customer Order
        if (!knownOrderIdsRef.current.has(ordId)) {
          knownOrderIdsRef.current.add(ordId);
          if (!isFirstLoad) {
            incomingNotifs.push({
              id: `notif-new-${ordId}`,
              type: 'new_order',
              title: 'New Order',
              description: cleanTableLabel !== 'Takeaway' ? `Table ${cleanTableLabel} placed Order #${orderNum}` : `Takeaway placed Order #${orderNum}`,
              timestamp: ord.created_at || new Date().toISOString(),
              read: false,
              tableLabel: cleanTableLabel,
              orderNumber: orderNum,
            });
          }
        }

        // Event 2: Order Served
        if (isServed && !knownServedOrderIdsRef.current.has(ordId)) {
          knownServedOrderIdsRef.current.add(ordId);
          if (!isFirstLoad) {
            incomingNotifs.push({
              id: `notif-served-${ordId}`,
              type: 'order_served',
              title: 'Order Served',
              description: cleanTableLabel !== 'Takeaway' ? `Order #${orderNum} served for Table ${cleanTableLabel}` : `Order #${orderNum} served`,
              timestamp: new Date().toISOString(),
              read: false,
              tableLabel: cleanTableLabel,
              orderNumber: orderNum,
            });
          }
        }
      }

      // Event 3: Customer Service Requests (Water, Bill, Waiter, Help)
      try {
        const activeSRs = await fetchActiveServiceRequests(cafeId);
        if (activeSRs && activeSRs.length > 0) {
          for (const sr of activeSRs) {
            const srId = sr.id;
            const tObj = dbTablesData?.find((t: any) => t.id === sr.table_id);
            const tLabel = (sr.tables as any)?.label || tObj?.label || (sr.table_id ? 'Table' : 'Takeaway');
            const cleanTableLabel = tLabel.toLowerCase().startsWith('table') ? tLabel.substring(5).trim() : tLabel;

            if (!knownServiceRequestIdsRef.current.has(srId)) {
              knownServiceRequestIdsRef.current.add(srId);
              
              let notifType: CounterNotification['type'] = 'need_help';
              let notifTitle = 'Need Help';
              let notifDesc = cleanTableLabel !== 'Takeaway' ? `Table ${cleanTableLabel} requested assistance` : `Takeaway requested assistance`;

              const normalizedType = (sr.type || '').toLowerCase();
              if (normalizedType === 'water' || normalizedType === 'need_water') {
                notifType = 'need_water';
                notifTitle = 'Need Water';
                notifDesc = cleanTableLabel !== 'Takeaway' ? `Table ${cleanTableLabel} requested water` : `Takeaway requested water`;
              } else if (normalizedType === 'bill' || normalizedType === 'need_bill') {
                notifType = 'need_bill';
                notifTitle = 'Need Bill';
                notifDesc = cleanTableLabel !== 'Takeaway' ? `Table ${cleanTableLabel} requested the bill` : `Takeaway requested the bill`;
              } else if (normalizedType === 'waiter' || normalizedType === 'call_waiter') {
                notifType = 'call_waiter';
                notifTitle = 'Call Waiter';
                notifDesc = cleanTableLabel !== 'Takeaway' ? `Table ${cleanTableLabel} called a waiter` : `Takeaway called a waiter`;
              }

              if (!isFirstLoad) {
                incomingNotifs.push({
                  id: `notif-sr-${srId}`,
                  type: notifType,
                  title: notifTitle,
                  description: notifDesc,
                  timestamp: sr.created_at || new Date().toISOString(),
                  read: false,
                  tableLabel: cleanTableLabel,
                });
              }
            }
          }
        }
      } catch (srErr) {
        console.warn("[CounterPage] Error fetching active service requests:", srErr);
      }

      if (incomingNotifs.length > 0) {
        const filteredNotifs = incomingNotifs.filter((n) => isEventNotificationEnabled(n.type, notifSettingsRef.current));
        if (filteredNotifs.length > 0) {
          setNotifications((prev) => sortNotificationsNewestFirst([...filteredNotifs, ...prev]));

          if (notifSettingsRef.current.general.enableSound) {
            playNotificationSound();
          }

          if (notifSettingsRef.current.general.enableBrowserNotifications) {
            filteredNotifs.forEach((n) => void triggerBrowserNotification(n.title, n.description));
          }
        }
      }

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
          createdAt: ord.created_at || new Date().toISOString(),
          status: mappedStatus,
          items: mappedItems,
          subtotal: (ord.total_cents || 0) / 100
        };

        if (!sessionsMap[tId]) {
          const sId = ord.dining_session_id || activeSessionMap.get(tId) || "";
          const codeSuffix = sId ? sId.substring(0, 4).toUpperCase() : "0000";
          const sessCreatedAt = activeSessionCreatedAtMap.get(tId) || ord.created_at || new Date().toISOString();
          sessionsMap[tId] = {
            sessionId: sId,
            sessionCode: `#S-${codeSuffix}`,
            startedAt: new Date(sessCreatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            startedAtTimestamp: sessCreatedAt,
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
          const sessCreatedAt = activeSessionCreatedAtMap.get(tId) || merged[tId]?.startedAtTimestamp;
          if (!sessionsMap[tId]) {
            merged[tId] = {
              ...merged[tId],
              sessionId: activeSessionMap.get(tId) || "",
              startedAtTimestamp: sessCreatedAt,
              orders: merged[tId]?.orders || [],
            };
          }
        }
        for (const [tId, sess] of Object.entries(sessionsMap)) {
          const sessCreatedAt = activeSessionCreatedAtMap.get(tId) || sess.startedAtTimestamp;
          const prevOrders = prev[tId]?.orders || [];
          const combinedOrdersMap = new Map<string, SessionOrder>();
          for (const o of sess.orders) combinedOrdersMap.set(o.id, o);
          for (const o of prevOrders) {
            if (!combinedOrdersMap.has(o.id)) combinedOrdersMap.set(o.id, o);
          }
          merged[tId] = {
            ...sess,
            startedAtTimestamp: sessCreatedAt,
            orders: Array.from(combinedOrdersMap.values()),
            draftCart: prev[tId]?.draftCart || []
          };
        }
        return merged;
      });

      return { activeSessions, dbOrders };
    } catch (e) {
      console.warn("[CounterPage] Error fetching active DB orders:", e);
      return { activeSessions: [], dbOrders: [] };
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_requests", filter: `cafe_id=eq.${cafeId}` },
        () => {
          void loadSessionsFromDb();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(realtimeChannel);
    };
  }, [cafeId, loadSessionsFromDb]);

  // Build database-synced tables list using real PostgreSQL table UUIDs
  const syncedTables: TableEntity[] = sortTablesNatural((dbTablesList.length > 0 ? dbTablesList : tableEngine.tables).map((dbT, idx) => {
    const protoT = tableEngine.tables.find((t) => t.id === dbT.id);
    const tableId = dbT.id || protoT?.id || `table-${idx}`;
    const sess = tableSessions[tableId];

    const dbStatus = (dbT ? dbT.status : (protoT?.status || '')).toLowerCase();

    let effectiveStatus: TableEntity['status'] = 'AVAILABLE';
    if (dbStatus === 'cleaning' || dbStatus === 'cleaning_required') {
      effectiveStatus = 'CLEANING';
    } else if (dbStatus === 'out_of_service') {
      effectiveStatus = 'OUT_OF_SERVICE';
    } else if (Boolean(dbT ? dbT.active_session_id : (protoT?.activeSession ? true : false)) || dbStatus === 'occupied') {
      effectiveStatus = 'OCCUPIED';
    }

    const rawLabel = dbT?.label || protoT?.label || `${idx + 1}`;
    const formattedLabel = rawLabel.toLowerCase().startsWith('table') ? rawLabel : `Table ${rawLabel}`;

    return {
      id: tableId,
      label: formattedLabel,
      seats: dbT?.seats || protoT?.seats || 4,
      status: effectiveStatus,
      currentSessionId: dbT ? dbT.active_session_id : (sess?.sessionId || null),
      notes: protoT?.notes
    };
  }));

  const isExpress = tableEngine.selectedTableId === 'express';

  const selectedTable = isExpress
    ? null
    : (syncedTables.find((t) => t.id === tableEngine.selectedTableId) || (syncedTables.length > 0 ? syncedTables[0] : null));

  const activeTableId = isExpress
    ? 'express'
    : (selectedTable?.id || tableEngine.selectedTableId || 'express');

  // Ensure tableEngine.selectedTableId is synced to a real PostgreSQL table UUID from syncedTables
  useEffect(() => {
    if (syncedTables.length === 0 || tableEngine.selectedTableId === 'express') return;

    const currentId = tableEngine.selectedTableId;
    const exists = syncedTables.some((t) => t.id === currentId);

    if (!exists) {
      let match: TableEntity | undefined;
      if (currentId && currentId.startsWith('t-')) {
        const protoNum = currentId.replace('t-', '');
        match = syncedTables.find(
          (t) => t.label.endsWith(` ${protoNum}`) || t.label.endsWith(protoNum)
        );
        if (!match) {
          const idx = parseInt(protoNum, 10) - 1;
          if (idx >= 0 && idx < syncedTables.length) {
            match = syncedTables[idx];
          }
        }
      }
      const targetId = match ? match.id : syncedTables[0].id;
      tableEngine.selectTable(targetId);
    }
  }, [syncedTables, tableEngine]);

  // Ensure current table session is initialized with a stable session code per table
  const activeSessionData: TableSessionData = tableSessions[activeTableId] || {
    sessionId: selectedTable?.currentSessionId || "",
    sessionCode: `#S-${selectedTable?.label.replace(/[^0-9]/g, '') || '01'}`,
    startedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    startedAtTimestamp: new Date().toISOString(),
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

    const res = await tableEngine.openTable(selectedTable.id);
    if (res.success) {
      setTableSessions((prev) => ({
        ...prev,
        [selectedTable.id]: {
          sessionId: newSessionId,
          sessionCode: `#S-${selectedTable.label.replace(/[^0-9]/g, '') || '01'}`,
          startedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          startedAtTimestamp: new Date().toISOString(),
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
      await updateTableStatusInDb(selectedTable.id, "free", null);
      await markTableFreeInDb(selectedTable.id, selectedTable.currentSessionId);
    } catch (e) {
      console.warn("[handleReleaseTable] Error:", e);
    }
    const res = await tableEngine.releaseTable(selectedTable.id);
    await loadSessionsFromDb();
    if (res.success) toast.success(`${selectedTable.label} marked available`);
  }, [selectedTable, tableEngine, loadSessionsFromDb]);

  const handleRestoreTable = useCallback(async () => {
    if (!selectedTable) return;
    try {
      await updateTableStatusInDb(selectedTable.id, "free", null);
    } catch (e) {
      console.warn("[handleRestoreTable] Error:", e);
    }
    const res = await tableEngine.restoreAvailable(selectedTable.id);
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
        startedAtTimestamp: new Date().toISOString(),
        guestCount: 2,
        orders: [],
        draftCart: []
      };

      const existing = cur.draftCart.find((i) => i.name === item.name);
      let updatedDraft: CartLineItem[];

      if (existing) {
        updatedDraft = cur.draftCart.map((i) => (i.name === item.name ? { ...i, qty: i.qty + 1 } : i));
      } else {
        updatedDraft = [...cur.draftCart, { id: item.id || `c-${Date.now()}`, menuItemId: item.id, name: item.name, price: item.price, qty: 1 }];
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

  const [activeKot, setActiveKot] = useState<KotPrintPayload | null>(null);

  // Accept QR / New Order (Transitions status from New -> Accepted)
  const handleAcceptOrder = useCallback(async (orderId: string, orderNumber: number) => {
    try {
      await updateOrderStatusInDb(orderId, "accepted" as any, "staff");
      toast.success(`✅ Order #${orderNumber} Accepted!`);
      await loadSessionsFromDb();
    } catch (e) {
      console.warn("[handleAcceptOrder] Error:", e);
      toast.error("Failed to accept order");
    }
  }, [loadSessionsFromDb]);

  // Send KOT (Prints KOT slip & updates status to KOT Sent)
  const handleSendKotOrder = useCallback(async (order: SessionOrder, tableLabel: string) => {
    const cleanLabel = tableLabel.toLowerCase().startsWith('table') ? tableLabel : `Table ${tableLabel}`;
    const payload: KotPrintPayloadData = {
      type: 'KOT',
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableLabel: cleanLabel,
      timestamp: order.timestamp || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      items: order.items.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, notes: i.notes })),
    };

    const { success } = await printService.enqueue('KOT', 'KOT_PRINTER', payload, { orderId: order.id });

    if (success) {
      try {
        await updateOrderStatusInDb(order.id, "kot_sent" as any, "staff");
        toast.success(`🍳 KOT #${order.orderNumber} Printed & Sent to Kitchen!`);
        await loadSessionsFromDb();
      } catch (e) {
        console.warn("[handleSendKotOrder] Error updating status:", e);
      }
    } else {
      toast.error(`❌ Print Failed for KOT #${order.orderNumber}. Order status remains ACCEPTED.`);
    }
  }, [loadSessionsFromDb]);

  // Reprint KOT (Prints the same KOT again without modifying order status)
  const handleReprintKotOrder = useCallback(async (order: SessionOrder, tableLabel: string) => {
    const cleanLabel = tableLabel.toLowerCase().startsWith('table') ? tableLabel : `Table ${tableLabel}`;
    const payload: KotPrintPayloadData = {
      type: 'KOT',
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableLabel: cleanLabel,
      timestamp: order.timestamp || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      items: order.items.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, notes: i.notes })),
    };

    const { success } = await printService.enqueue('KOT', 'KOT_PRINTER', payload, { orderId: order.id });
    if (success) {
      toast.info(`🖨️ KOT #${order.orderNumber} Reprinted.`);
    } else {
      toast.error(`❌ Reprint Failed for KOT #${order.orderNumber}.`);
    }
  }, []);

  // Send KOT — Creates kitchen order via single createOrderInDb pipeline with initial status "kot_sent"
  const handleKot = useCallback(async () => {
    const cur = activeSessionData;
    if (cur.draftCart.length === 0) {
      toast.error('Add items to draft before sending KOT.');
      return;
    }

    const subtotal = cur.draftCart.reduce((a, i) => a + i.price * i.qty, 0);

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

    let createdOrderId: string | null = null;
    try {
      createdOrderId = await createOrderInDb({
        cafe_id: cafeId || '',
        table_id: selectedTable?.id || '',
        session_id: getSessionId(),
        dining_session_id: targetSessionId,
        total_cents: Math.round(subtotal * 100),
        status: "kot_sent" as any,
        items: cur.draftCart.map((i) => ({
          menu_item_id: i.menuItemId || (i.id.startsWith("c-") ? undefined : i.id),
          name: i.name,
          price_cents: Math.round(i.price * 100),
          qty: i.qty,
        })),
      });

      if (selectedTable) {
        await tableEngine.openTable(selectedTable.id);
      }
    } catch (e) {
      console.warn("[handleKot] Database write warning:", e);
    }

    const newSessionOrder: SessionOrder = {
      id: createdOrderId || `ord-kot-${Date.now()}`,
      orderNumber: Math.floor(100 + Math.random() * 900),
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      status: 'KOT_SENT',
      items: cur.draftCart,
      subtotal
    };

    setTableSessions((prev) => ({
      ...prev,
      [activeTableId]: {
        ...(prev[activeTableId] || cur),
        sessionId: targetSessionId || cur.sessionId,
        orders: [...(prev[activeTableId]?.orders || cur.orders), newSessionOrder],
        draftCart: []
      }
    }));

    const res = await loadSessionsFromDb("Send KOT Post-Write");
    const dbOrders = res?.dbOrders;

    const createdDbOrder = dbOrders?.find((o: any) => o.id === createdOrderId);
    const rawLabel = selectedTable ? selectedTable.label : 'Express';
    const cleanTableLabel = rawLabel.toLowerCase().startsWith('table') ? rawLabel.substring(5).trim() : rawLabel;

    const orderNum = createdDbOrder?.order_number 
      ? createdDbOrder.order_number 
      : newSessionOrder.orderNumber;

    const orderTimestamp = createdDbOrder?.created_at || new Date().toISOString();

    // Spool & print KOT for draft order via PrintService
    const kotPayload: KotPrintPayloadData = {
      type: 'KOT',
      orderId: createdOrderId || undefined,
      orderNumber: orderNum,
      tableLabel: cleanTableLabel !== 'Express' ? `Table ${cleanTableLabel}` : 'Express Takeaway',
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      items: cur.draftCart.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, notes: i.notes })),
    };

    const { success: printSuccess } = await printService.enqueue('KOT', 'KOT_PRINTER', kotPayload, { orderId: createdOrderId || undefined });
    if (printSuccess) {
      toast.success(`✅ KOT Spooled & Sent to Kitchen! (Order #${orderNum})`);
    } else {
      toast.warn(`⚠️ Order created, but KOT printing failed for Order #${orderNum}.`);
    }

    const eventPayload: CounterNotification = {
      id: `notif-new-${createdOrderId || Date.now()}`,
      type: 'new_order',
      title: 'New Order',
      description: cleanTableLabel !== 'Express' ? `Table ${cleanTableLabel} placed Order #${orderNum}` : `Express placed Order #${orderNum}`,
      timestamp: orderTimestamp,
      read: false,
      tableLabel: cleanTableLabel,
      orderNumber: orderNum,
    };

    if (createdOrderId) {
      knownOrderIdsRef.current.add(createdOrderId);
    }

    if (isEventNotificationEnabled('new_order', notifSettingsRef.current)) {
      setNotifications((prev) => sortNotificationsNewestFirst([eventPayload, ...prev.filter((n) => n.id !== eventPayload.id)]));
      
      if (notifSettingsRef.current.general.enableSound) {
        playNotificationSound();
      }

      if (notifSettingsRef.current.general.enableBrowserNotifications) {
        void triggerBrowserNotification(eventPayload.title, eventPayload.description);
      }
    }

    toast.success(`✅ KOT Spooled & Sent to Kitchen! (Order #${eventPayload.orderNumber} for ${cleanTableLabel !== 'Express' ? 'Table ' + cleanTableLabel : 'Express'})`);
  }, [activeSessionData, activeTableId, cafeId, loadSessionsFromDb, selectedTable, tableEngine]);

  const handlePrintBill = useCallback(async () => {
    if (selectedTable) await tableEngine.requestBill(selectedTable.id);
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

    console.log("[INSTRUMENT_STEP_1]", {
      sessionId: cur.sessionId,
      selectedTableId: selectedTable?.id,
      selectedTableStatus: selectedTable?.status
    });

    try {
      const orderIds = cur.orders.map((o) => o.id);
      for (const orderId of orderIds) {
        await updateOrderStatusInDb(orderId, "served", "staff");
      }
    } catch (e) {
      console.warn("[handlePaymentComplete] Error updating order status to served:", e);
    }

    if (selectedTable) {
      let updateRes: any = null;
      let updateErr: any = null;
      try {
        updateRes = await updateTableStatusInDb(selectedTable.id, "cleaning_required", null);
        console.log("[INSTRUMENT_STEP_2_UPDATE_SUCCESS]", { updateRes });
      } catch (e: any) {
        updateErr = e?.message || e;
        console.log("[INSTRUMENT_STEP_2_UPDATE_EXCEPTION]", { updateErr });
      }
      await tableEngine.markCleaning(selectedTable.id);

      const { data: freshDbTable, error: readErr } = await supabase
        .from("tables")
        .select("*")
        .eq("id", selectedTable.id)
        .single();

      console.log("[INSTRUMENT_STEP_2_FRESH_DB_READ]", {
        id: freshDbTable?.id,
        status: freshDbTable?.status,
        active_session_id: freshDbTable?.active_session_id,
        readErr: readErr?.message || readErr
      });
    }

    if (cur.sessionId && !cur.sessionId.startsWith("session-")) {
      try {
        await closeDiningSessionInDb(cur.sessionId);
      } catch (e: any) {
        console.warn("[handlePaymentComplete] DB session closure notice:", e?.message || e);
        toast.info("Session payment recorded. Active kitchen tickets remain for staff review.");
      }
    }

    await loadSessionsFromDb();

    if (selectedTable) {
      const { data: postLoadTable } = await supabase
        .from("tables")
        .select("*")
        .eq("id", selectedTable.id)
        .single();

      console.log("[INSTRUMENT_STEP_3_POST_LOAD]", {
        selectedTableId: selectedTable.id,
        dbStatusPostLoad: postLoadTable?.status,
        dbActiveSessionIdPostLoad: postLoadTable?.active_session_id,
        tableSessionsForSelectedTable: tableSessions[selectedTable.id]
      });
    }

    setTableSessions((prev) => {
      const copy = { ...prev };
      delete copy[activeTableId];
      return copy;
    });

    toast.success(`💰 Session Paid & Closed! ${selectedTable ? selectedTable.label + ' needs cleaning.' : ''}`);
    setIsPaymentOpen(false);
    setActiveReceipt(receipt);
  }, [activeSessionData, activeTableId, discountPct, loadSessionsFromDb, selectedTable, tableEngine, user]);

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

  // Calculate Cumulative Totals for Active Session
  const submittedSubtotal = activeSessionData.orders.reduce((a, o) => a + o.subtotal, 0);
  const draftSubtotal = activeSessionData.draftCart.reduce((a, i) => a + i.price * i.qty, 0);
  const subtotal = submittedSubtotal + draftSubtotal;
  const discountAmt = subtotal * (discountPct / 100);
  const tax = (subtotal - discountAmt) * 0.08;
  const netTotal = subtotal - discountAmt + tax;

  return (
    <div className="v8-counter-root">
      <Header 
        unreadCount={unreadCount}
        onOpenNotifications={handleOpenNotifications}
        onOpenSettings={handleOpenSettings}
      />
      <TableRail 
        tables={syncedTables}
        tableSessions={tableSessions}
        nowMs={nowMs}
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
          nowMs={nowMs}
          draftCart={activeSessionData.draftCart}
          onOpenSession={handleOpenSession}
          onReleaseTable={handleReleaseTable}
          onRestoreTable={handleRestoreTable}
          onUpdateQty={handleUpdateQty}
          onAcceptOrder={handleAcceptOrder}
          onSendKot={handleSendKotOrder}
          onReprintKot={handleReprintKotOrder}
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

      <CounterNotificationDrawer
        isOpen={isNotifOpen}
        initialTab={drawerTab}
        notifications={notifications}
        settings={notifSettings}
        nowMs={nowMs}
        onClose={() => setIsNotifOpen(false)}
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearHistory={handleClearHistory}
        onDismiss={handleDismissNotif}
        onMarkAsRead={handleMarkAsRead}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* PRINTABLE KOT SLIP */}
      {activeKot && (
        <div className="v8-kot-printable-container">
          <div className="v8-kot-paper v8-kot-printable">
            <div className="text-center pb-2 border-b border-dashed border-gray-400">
              <div className="font-black text-base tracking-widest uppercase">ORDERRAIL CAFE</div>
              <div className="font-extrabold text-sm text-black mt-0.5">KOT #{activeKot.orderNumber}</div>
              <div className="text-xs font-bold text-gray-800 mt-1 flex justify-center items-center gap-1.5 flex-wrap">
                <span>{activeKot.tableLabel}</span>
                <span>·</span>
                <span>{activeKot.timestamp}</span>
              </div>
            </div>

            <div className="py-2 border-b border-dashed border-gray-400 text-xs">
              <div className="flex justify-between items-center text-[10px] font-extrabold text-gray-500 uppercase tracking-wider pb-1 border-b border-gray-200">
                <span>ITEM DESCRIPTION</span>
                <span>QTY</span>
              </div>
              {activeKot.items.map((item, idx) => (
                <div key={item.id || idx} className="py-1 border-b border-gray-100 last:border-0 text-black">
                  <div className="flex justify-between items-start font-bold text-sm">
                    <span className="pr-2">{item.name}</span>
                    <span className="font-extrabold font-mono text-base shrink-0">×{item.qty}</span>
                  </div>
                  {item.notes && (
                    <div className="text-xs italic text-gray-700 mt-0.5 pl-2 border-l-2 border-amber-500">
                      Note: {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-center text-[10px] font-extrabold text-gray-500 pt-2 tracking-widest uppercase">
              *** KITCHEN ORDER TICKET ***
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isPaymentOpen && (
          <PaymentDialogModal 
            tableLabel={selectedTable ? selectedTable.label : 'Express Takeaway'}
            netTotal={netTotal}
            subtotal={subtotal}
            tax={tax}
            discountPct={discountPct}
            discountAmt={discountAmt}
            session={activeSessionData}
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
