import { useState, useEffect } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { 
  Coffee, 
  QrCode, 
  ChefHat, 
  ShoppingBag, 
  TrendingUp, 
  Bell, 
  Clock, 
  Check, 
  Volume2, 
  Receipt, 
  CreditCard, 
  Printer, 
  Search, 
  ArrowRight, 
  Plus, 
  Minus,
  Smartphone, 
  Monitor, 
  Utensils, 
  AlertCircle, 
  CircleDollarSign, 
  Timer,
  CheckCircle2,
  Sparkles,
  Info,
  Star,
  Sliders,
  RotateCcw,
  Play,
  Pause,
  MessageSquare,
  Settings,
  Grid,
  Trash2,
  CheckSquare
} from "lucide-react";

// --- 1. INTERACTIVE CUSTOMER ORDERING SHOWCASE ---
export function CustomerAppMockup() {
  const [customerTab, setCustomerTab] = useState<"menu" | "order" | "call">("menu");
  const [selectedCategory, setSelectedCategory] = useState("Coffee");
  const [cartItems, setCartItems] = useState([
    { id: "1", name: "Classic Espresso", price: 180, qty: 1 },
    { id: "2", name: "Vanilla Cappuccino", price: 240, qty: 1 }
  ]);
  const [serviceSent, setServiceSent] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const categories = ["Coffee", "Tea", "Breakfast", "Sandwiches", "Pastries"];

  const handleAddItem = (id: string, name: string, price: number) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === id);
      if (existing) {
        return prev.map(item => item.id === id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { id, name, price, qty: 1 }];
    });
  };

  const handleUpdateQty = (id: string, delta: number) => {
    setCartItems(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.qty + delta;
          return newQty > 0 ? { ...item, qty: newQty } : null;
        }
        return item;
      }).filter(Boolean) as typeof prev;
    });
  };

  const totalQty = cartItems.reduce((acc, item) => acc + item.qty, 0);
  const totalPrice = cartItems.reduce((acc, item) => acc + (item.price * item.qty), 0);

  const handleCallStaff = (requestType: string) => {
    setServiceSent(requestType);
    setTimeout(() => setServiceSent(null), 3000);
  };

  return (
    <div className="mx-auto w-full max-w-[360px] rounded-[2.5rem] bg-card p-3 shadow-float ring-1 ring-border/80 text-foreground overflow-hidden">
      {/* Phone Notch & Status bar */}
      <div className="relative mb-2 pt-1 flex items-center justify-between px-4 text-[10px] font-medium text-muted-foreground">
        <span>9:41</span>
        <div className="absolute left-1/2 top-1 h-3.5 w-24 -translate-x-1/2 rounded-full bg-foreground/10" />
        <div className="flex items-center gap-1">
          <span>5G</span>
          <span className="h-2 w-3 rounded-sm border border-muted-foreground/60 bg-muted-foreground" />
        </div>
      </div>

      {/* Customer App Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-brand-foreground font-display text-xs font-bold shadow-soft">
            OR
          </span>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">TABLE 4</div>
            <div className="font-display text-sm font-semibold leading-none">OrderRail Café</div>
          </div>
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" /> LIVE MENU
        </span>
      </div>

      {/* INTERACTIVE CUSTOMER VIEW PANELS */}
      <div className="min-h-[380px] max-h-[400px] overflow-y-auto no-scrollbar py-2">
        {customerTab === "menu" && (
          <div className="space-y-3 px-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                readOnly
                placeholder="Search coffee, pastries..."
                className="w-full rounded-full border border-border/80 bg-background/80 py-2 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
              />
            </div>

            {/* Categories Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs py-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`relative rounded-full px-3 py-1.5 font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? "text-brand-foreground font-semibold"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {selectedCategory === cat && (
                    <motion.div
                      layoutId="activeCat"
                      className="absolute inset-0 rounded-full bg-brand shadow-soft"
                      transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{cat}</span>
                </button>
              ))}
            </div>

            <div className="font-display text-sm font-semibold text-foreground pt-1">
              {selectedCategory}
            </div>

            {/* Menu Item Cards */}
            <motion.div 
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2.5"
            >
              {[
                { id: "1", name: "Classic Espresso", price: 180, desc: "Rich double shot of our house signature blend espresso.", tag: "POPULAR", tagBg: "bg-amber-100 text-amber-800" },
                { id: "2", name: "Vanilla Cappuccino", price: 240, desc: "Espresso with steamed milk, thick foam and natural vanilla.", tag: "BESTSELLER", tagBg: "bg-rose-100 text-rose-800" },
                { id: "3", name: "Avocado Toast", price: 340, desc: "Smashed avocado, poached eggs, chilli flakes on sourdough.", tag: "VEG", tagBg: "bg-emerald-100 text-emerald-800" }
              ].map(item => (
                <div key={item.id} className="rounded-2xl border border-border/60 bg-background p-3 shadow-soft flex items-center justify-between gap-3 hover:border-accent/40 transition">
                  <div className="flex-1 space-y-1">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${item.tagBg}`}>
                      {item.tag}
                    </span>
                    <div className="font-display text-xs font-semibold text-foreground">{item.name}</div>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{item.desc}</p>
                    <div className="text-xs font-semibold tabular-nums text-foreground">₹{item.price}.00</div>
                  </div>
                  <motion.button 
                    whileTap={shouldReduceMotion ? {} : { scale: 0.88 }}
                    onClick={() => handleAddItem(item.id, item.name, item.price)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground shadow-soft active:scale-95 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </motion.button>
                </div>
              ))}
            </motion.div>
          </div>
        )}

        {customerTab === "order" && (
          <div className="space-y-3 px-3">
            <div className="font-display text-sm font-semibold text-foreground flex items-center justify-between">
              <span>My Table Order</span>
              <span className="text-xs text-muted-foreground font-normal">Table 4</span>
            </div>

            {cartItems.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground space-y-2">
                <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p>Your cart is empty. Add items from the menu!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cartItems.map(item => (
                  <div key={item.id} className="rounded-2xl border border-border/60 bg-background p-3 shadow-soft flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-foreground">{item.name}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">₹{item.price} × {item.qty} = ₹{item.price * item.qty}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleUpdateQty(item.id, -1)} className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-foreground">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                      <button onClick={() => handleUpdateQty(item.id, 1)} className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-foreground">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Special Instruction Input */}
                <div className="pt-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Kitchen Note</label>
                  <input 
                    type="text" 
                    readOnly
                    placeholder="e.g. Extra oat milk, no sugar" 
                    className="mt-1 w-full rounded-xl border border-border/80 bg-background p-2 text-xs text-foreground outline-none" 
                  />
                </div>

                <div className="border-t border-border/60 pt-3 space-y-1 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>₹{totalPrice}.00</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST (5%)</span>
                    <span>₹{Math.round(totalPrice * 0.05)}.00</span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground text-sm pt-1">
                    <span>Total</span>
                    <span>₹{totalPrice + Math.round(totalPrice * 0.05)}.00</span>
                  </div>
                </div>

                <button className="w-full rounded-full btn-primary-action py-2.5 text-xs font-semibold shadow-soft">
                  Send Order to Kitchen
                </button>
              </div>
            )}
          </div>
        )}

        {customerTab === "call" && (
          <div className="space-y-3 px-3">
            <div className="font-display text-sm font-semibold text-foreground">
              Call Staff / Service Requests
            </div>
            <p className="text-xs text-muted-foreground">Tap a request to alert the floor waiter immediately.</p>

            {serviceSent && (
              <motion.div 
                initial={{ opacity: 0, y: -6 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="rounded-2xl bg-emerald-100 p-3 text-xs text-emerald-900 font-semibold flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                <span>Request sent for Table 4 ({serviceSent})! Waiter notified.</span>
              </motion.div>
            )}

            <div className="grid gap-2">
              <button 
                onClick={() => handleCallStaff("Call Waiter")}
                className="flex items-center justify-between rounded-2xl border border-border/60 bg-background p-3 text-xs font-semibold text-foreground shadow-soft hover:bg-secondary transition"
              >
                <span className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-xl bg-accent/15 text-accent"><Bell className="h-3.5 w-3.5" /></span>
                  Call Waiter
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              <button 
                onClick={() => handleCallStaff("Needs Water")}
                className="flex items-center justify-between rounded-2xl border border-border/60 bg-background p-3 text-xs font-semibold text-foreground shadow-soft hover:bg-secondary transition"
              >
                <span className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-xl bg-accent/15 text-accent"><Utensils className="h-3.5 w-3.5" /></span>
                  Request Water / Cutlery
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              <button 
                onClick={() => handleCallStaff("Request Bill")}
                className="flex items-center justify-between rounded-2xl border border-border/60 bg-background p-3 text-xs font-semibold text-foreground shadow-soft hover:bg-secondary transition"
              >
                <span className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-xl bg-accent/15 text-accent"><Receipt className="h-3.5 w-3.5" /></span>
                  Request Bill / Settlement
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CUSTOMER PHONE BOTTOM NAV TABS */}
      <div className="border-t border-border/60 pt-2 grid grid-cols-3 gap-1 text-[11px] font-medium text-center">
        <button
          onClick={() => setCustomerTab("menu")}
          className={`py-1.5 rounded-xl flex flex-col items-center gap-0.5 transition ${
            customerTab === "menu" ? "bg-brand text-brand-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Utensils className="h-3.5 w-3.5" /> Menu
        </button>

        <button
          onClick={() => setCustomerTab("order")}
          className={`relative py-1.5 rounded-xl flex flex-col items-center gap-0.5 transition ${
            customerTab === "order" ? "bg-brand text-brand-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingBag className="h-3.5 w-3.5" /> My Order
          {totalQty > 0 && (
            <span className="absolute top-1 right-3 grid h-4 w-4 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
              {totalQty}
            </span>
          )}
        </button>

        <button
          onClick={() => setCustomerTab("call")}
          className={`py-1.5 rounded-xl flex flex-col items-center gap-0.5 transition ${
            customerTab === "call" ? "bg-brand text-brand-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bell className="h-3.5 w-3.5" /> Call Staff
        </button>
      </div>
    </div>
  );
}


// --- 2. INTERACTIVE KITCHEN DISPLAY SYSTEM (INCOMING → PREPARING → READY → COMPLETED) ---
export function KitchenDisplayMockup() {
  const shouldReduceMotion = useReducedMotion();
  
  const [tickets, setTickets] = useState([
    { id: "T1", table: "Table 3", code: "#00734C", time: "5:23 PM", total: "₹450.00", status: "incoming", items: ["2× Classic Espresso", "1× Blueberry Scone"], note: "Oat milk for espresso" },
    { id: "T2", table: "Table 2", code: "#9C06F8", time: "5:19 PM", total: "₹360.00", status: "incoming", items: ["2× Vanilla Cappuccino"] },
    { id: "T3", table: "Table 1", code: "#79877B", time: "5:17 PM", total: "₹580.00", status: "preparing", prepTime: "4m", items: ["1× Avocado Toast", "1× Iced Caramel Macchiato"] },
    { id: "T4", table: "Table 5", code: "#1363CB", time: "5:12 PM", total: "₹250.00", status: "ready", items: ["1× Flat White"] },
  ]);

  const handleAdvanceTicket = (id: string, nextStatus: "preparing" | "ready" | "completed") => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus } : t));
  };

  const handleResetKDS = () => {
    setTickets([
      { id: "T1", table: "Table 3", code: "#00734C", time: "5:23 PM", total: "₹450.00", status: "incoming", items: ["2× Classic Espresso", "1× Blueberry Scone"], note: "Oat milk for espresso" },
      { id: "T2", table: "Table 2", code: "#9C06F8", time: "5:19 PM", total: "₹360.00", status: "incoming", items: ["2× Vanilla Cappuccino"] },
      { id: "T3", table: "Table 1", code: "#79877B", time: "5:17 PM", total: "₹580.00", status: "preparing", prepTime: "4m", items: ["1× Avocado Toast", "1× Iced Caramel Macchiato"] },
      { id: "T4", table: "Table 5", code: "#1363CB", time: "5:12 PM", total: "₹250.00", status: "ready", items: ["1× Flat White"] },
    ]);
  };

  const incomingTickets = tickets.filter(t => t.status === "incoming");
  const preparingTickets = tickets.filter(t => t.status === "preparing");
  const readyTickets = tickets.filter(t => t.status === "ready");

  return (
    <div className="w-full rounded-3xl bg-card p-4 md:p-6 shadow-soft ring-1 ring-border/60 space-y-5 text-foreground">
      {/* KDS Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-foreground shadow-soft">
            <ChefHat className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-semibold">Kitchen Display Console</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                INTERACTIVE PIPELINE
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Tap ticket buttons below to advance orders from Incoming → Preparing → Ready!</p>
          </div>
        </div>

        <button 
          onClick={handleResetKDS}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/80 transition"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset Demo
        </button>
      </div>

      {/* KDS Kanban Ticket Columns */}
      <div className="grid gap-3 md:grid-cols-3 min-w-0">
        {/* Column 1: Incoming */}
        <div className="space-y-2.5 rounded-2xl bg-secondary/40 p-3 min-w-0">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Incoming ({incomingTickets.length})
            </span>
          </div>

          <AnimatePresence>
            {incomingTickets.map(t => (
              <motion.div 
                key={t.id}
                layoutId={t.id}
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="rounded-2xl border border-border/80 bg-background p-3 shadow-soft space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold font-display text-foreground">{t.table} · {t.code}</span>
                  <span className="font-semibold text-foreground">{t.total}</span>
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3 text-amber-600" /> {t.time} · <span className="font-semibold text-rose-700">PENDING</span>
                </div>
                <div className="text-xs space-y-1 pt-1 border-t border-border/40">
                  {t.items.map(it => <div key={it} className="font-medium text-foreground">{it}</div>)}
                  {t.note && <div className="text-[11px] text-muted-foreground italic">Note: {t.note}</div>}
                </div>
                <button 
                  onClick={() => handleAdvanceTicket(t.id, "preparing")}
                  className="w-full rounded-xl bg-brand py-2 text-xs font-semibold text-brand-foreground shadow-soft hover:bg-brand/90 transition flex items-center justify-center gap-1"
                >
                  Start preparing →
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {incomingTickets.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">No pending incoming tickets</div>
          )}
        </div>

        {/* Column 2: In Preparation */}
        <div className="space-y-2.5 rounded-2xl bg-secondary/40 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> In Preparation ({preparingTickets.length})
            </span>
          </div>

          <AnimatePresence>
            {preparingTickets.map(t => (
              <motion.div 
                key={t.id}
                layoutId={t.id}
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="rounded-2xl border border-amber-300/60 bg-background p-3 shadow-soft space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold font-display text-foreground">{t.table} · {t.code}</span>
                  <span className="font-semibold text-foreground">{t.total}</span>
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Timer className="h-3 w-3 text-amber-600 animate-pulse" /> {t.time} · <span className="font-semibold text-amber-700">PREPARING (4m)</span>
                </div>
                <div className="text-xs space-y-1 pt-1 border-t border-border/40">
                  {t.items.map(it => <div key={it} className="font-medium text-foreground">{it}</div>)}
                </div>
                <button 
                  onClick={() => handleAdvanceTicket(t.id, "ready")}
                  className="w-full rounded-xl btn-primary-action py-2 text-xs font-semibold shadow-soft flex items-center justify-center gap-1"
                >
                  Mark ready →
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {preparingTickets.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">No items currently in preparation</div>
          )}
        </div>

        {/* Column 3: Ready / Delivered */}
        <div className="space-y-2.5 rounded-2xl bg-secondary/40 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ready for Table ({readyTickets.length})
            </span>
          </div>

          <AnimatePresence>
            {readyTickets.map(t => (
              <motion.div 
                key={t.id}
                layoutId={t.id}
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="rounded-2xl border border-emerald-200 bg-background p-3 shadow-soft space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold font-display text-foreground">{t.table} · {t.code}</span>
                  <span className="font-semibold text-foreground">{t.total}</span>
                </div>
                <div className="text-[10px] text-emerald-700 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="h-3 w-3" /> Ready at {t.time}
                </div>
                <div className="text-xs space-y-1 pt-1 border-t border-border/40 text-foreground">
                  {t.items.map(it => <div key={it}>{it}</div>)}
                </div>
                <button 
                  onClick={() => handleAdvanceTicket(t.id, "completed")}
                  className="w-full rounded-xl bg-emerald-700 text-white py-1.5 text-xs font-semibold shadow-soft flex items-center justify-center gap-1"
                >
                  Complete & Deliver ✓
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {readyTickets.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">No ready tickets awaiting pickup</div>
          )}
        </div>
      </div>
    </div>
  );
}


// --- 3. INTERACTIVE OWNER SUITE DEMO (ANALYTICS, ORDERS, MENU, TABLES, REVIEWS, SETTINGS) ---
export function OwnerAnalyticsMockup() {
  const [ownerTab, setOwnerTab] = useState<"analytics" | "orders" | "menu" | "tables" | "reviews" | "settings">("analytics");
  const [range, setRange] = useState<7 | 30 | 90>(7);
  const shouldReduceMotion = useReducedMotion();

  // Menu Toggles state
  const [menuItems, setMenuItems] = useState([
    { name: "Classic Espresso", price: "₹180", category: "Coffee", available: true },
    { name: "Vanilla Cappuccino", price: "₹240", category: "Coffee", available: true },
    { name: "Avocado Toast", price: "₹340", category: "Breakfast", available: true },
    { name: "Iced Caramel Macchiato", price: "₹290", category: "Coffee", available: false }
  ]);

  const toggleAvailability = (index: number) => {
    setMenuItems(prev => prev.map((item, i) => i === index ? { ...item, available: !item.available } : item));
  };

  const revenueData = [
    { day: "Mon", revenue: 4200 },
    { day: "Tue", revenue: 5100 },
    { day: "Wed", revenue: 4800 },
    { day: "Thu", revenue: 6400 },
    { day: "Fri", revenue: 7900 },
    { day: "Sat", revenue: 9800 },
    { day: "Sun", revenue: 8650 },
  ];

  const hourlyData = [
    { hour: "8 AM", orders: 12 },
    { hour: "10 AM", orders: 28 },
    { hour: "12 PM", orders: 22 },
    { hour: "2 PM", orders: 16 },
    { hour: "4 PM", orders: 34 },
    { hour: "6 PM", orders: 24 },
    { hour: "8 PM", orders: 10 },
  ];

  return (
    <div className="w-full rounded-3xl bg-card p-4 md:p-6 shadow-soft ring-1 ring-border/60 space-y-5 text-foreground">
      {/* Owner Console Main Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div>
          <h3 className="font-display text-xl font-semibold">Owner Console — Artisan Café</h3>
          <p className="text-xs text-muted-foreground">Complete management suite for analytics, orders, menu & tables</p>
        </div>

        {/* OWNER SUITE TABS */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-full bg-secondary p-1 text-xs font-medium">
          {[
            { id: "analytics", label: "Analytics", icon: TrendingUp },
            { id: "orders", label: "Orders", icon: ShoppingBag },
            { id: "menu", label: "Menu", icon: Utensils },
            { id: "tables", label: "Tables", icon: Grid },
            { id: "reviews", label: "Reviews", icon: Star },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setOwnerTab(tab.id as typeof ownerTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${
                ownerTab === tab.id ? "bg-background font-semibold text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: ANALYTICS */}
      {ownerTab === "analytics" && (
        <motion.div initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 min-w-0">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 min-w-0">
            {[
              { label: "TOTAL REVENUE", value: "₹46,850", sub: "+18.4% vs last week", icon: CircleDollarSign },
              { label: "PAID ORDERS", value: "214", sub: "Avg ticket ₹218", icon: ShoppingBag },
              { label: "TABLE OCCUPANCY", value: "84%", sub: "Peak rush 4:00 PM", icon: Utensils },
              { label: "AVG PREP TIME", value: "4.2 min", sub: "-1.1 min faster", icon: Clock }
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border/60 bg-background p-4 shadow-soft min-w-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{stat.label}</span>
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent"><stat.icon className="h-4 w-4" /></span>
                </div>
                <div className="mt-2 font-display text-2xl font-semibold tabular-nums">{stat.value}</div>
                <div className="mt-1 text-[11px] font-semibold text-emerald-700">{stat.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-12 min-w-0">
            <div className="lg:col-span-7 min-w-0 rounded-2xl border border-border/60 bg-background p-4 shadow-soft space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-sm font-semibold">Revenue Trend</h4>
                <span className="text-xs text-muted-foreground">Daily sales progression</span>
              </div>
              <div className="h-44 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" fill="url(#revGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-5 min-w-0 rounded-2xl border border-border/60 bg-background p-4 shadow-soft space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-sm font-semibold">Orders by Hour</h4>
                <span className="text-xs text-muted-foreground">Peak rush times</span>
              </div>
              <div className="h-44 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }} />
                    <Bar dataKey="orders" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* TAB 2: ORDERS STREAM */}
      {ownerTab === "orders" && (
        <motion.div initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="font-display text-sm font-semibold">Live Orders Stream</div>
          <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-background overflow-hidden text-xs">
            {[
              { id: "#00734C", table: "Table 3", items: "2× Classic Espresso", total: "₹450.00", status: "PENDING", bg: "bg-rose-100 text-rose-800" },
              { id: "#79877B", table: "Table 1", items: "1× Avocado Toast", total: "₹580.00", status: "PREPARING", bg: "bg-amber-100 text-amber-800" },
              { id: "#1363CB", table: "Table 5", items: "1× Flat White", total: "₹250.00", status: "COMPLETED", bg: "bg-emerald-100 text-emerald-800" },
            ].map(o => (
              <div key={o.id} className="flex items-center justify-between p-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-foreground">{o.table} · {o.id}</div>
                  <div className="text-muted-foreground">{o.items}</div>
                </div>
                <div className="text-right space-y-1">
                  <div className="font-semibold tabular-nums text-foreground">{o.total}</div>
                  <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold ${o.bg}`}>{o.status}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* TAB 3: MENU EDITOR WITH TOGGLES */}
      {ownerTab === "menu" && (
        <motion.div initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="flex items-center justify-between font-display text-sm font-semibold">
            <span>Menu & Item Availability</span>
            <button className="rounded-full btn-primary-action px-3 py-1 text-xs font-semibold">+ Add Dish</button>
          </div>

          <div className="space-y-2">
            {menuItems.map((item, idx) => (
              <div key={item.name} className="rounded-2xl border border-border/60 bg-background p-3 text-xs flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">{item.name}</div>
                  <div className="text-muted-foreground">{item.category} · {item.price}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold uppercase ${item.available ? "text-emerald-700" : "text-rose-700"}`}>
                    {item.available ? "Available" : "Sold Out"}
                  </span>
                  <button 
                    onClick={() => toggleAvailability(idx)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      item.available ? "bg-brand" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                      item.available ? "translate-x-4" : "translate-x-0"
                    }`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* TAB 4: TABLES LAYOUT GRID */}
      {ownerTab === "tables" && (
        <motion.div initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="font-display text-sm font-semibold">Dining Floor Layout (12 Tables)</div>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {[
              { label: "Table 1", seats: "2 seats", status: "Occupied", bg: "bg-amber-100 text-amber-900 border-amber-300" },
              { label: "Table 2", seats: "4 seats", status: "Available", bg: "bg-emerald-50 text-emerald-900 border-emerald-300" },
              { label: "Table 3", seats: "2 seats", status: "Occupied", bg: "bg-amber-100 text-amber-900 border-amber-300" },
              { label: "Table 4", seats: "4 seats", status: "Occupied", bg: "bg-amber-100 text-amber-900 border-amber-300" },
              { label: "Table 5", seats: "6 seats", status: "Available", bg: "bg-emerald-50 text-emerald-900 border-emerald-300" },
              { label: "Table 6", seats: "2 seats", status: "Reserved", bg: "bg-purple-100 text-purple-900 border-purple-300" },
            ].map(t => (
              <div key={t.label} className={`rounded-2xl border p-3 text-center space-y-1 ${t.bg}`}>
                <div className="font-display text-xs font-bold">{t.label}</div>
                <div className="text-[10px] text-muted-foreground">{t.seats}</div>
                <div className="text-[9px] font-bold uppercase tracking-wider">{t.status}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* TAB 5: REVIEWS */}
      {ownerTab === "reviews" && (
        <motion.div initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 text-xs">
          <div className="font-display text-sm font-semibold">Customer Reviews & Ratings</div>
          <div className="space-y-2">
            {[
              { name: "Rahul S.", rating: 5, text: "Loved scanning the QR at Table 3! Espresso arrived in 3 minutes." },
              { name: "Anita M.", rating: 5, text: "The Avocado toast and Vanilla Cappuccino were delicious." },
            ].map((r, i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-background p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{r.name}</span>
                  <div className="flex items-center gap-0.5 text-amber-500">
                    {Array.from({ length: r.rating }).map((_, idx) => (
                      <Star key={idx} className="h-3 w-3 fill-amber-400" />
                    ))}
                  </div>
                </div>
                <p className="text-muted-foreground">{r.text}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* TAB 6: SETTINGS */}
      {ownerTab === "settings" && (
        <motion.div initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 text-xs">
          <div className="font-display text-sm font-semibold">Café Settings & QR Config</div>
          <div className="rounded-2xl border border-border/60 bg-background p-4 space-y-3">
            <div>
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Café Name</label>
              <input type="text" readOnly value="OrderRail Artisan Café" className="mt-1 w-full rounded-xl border border-border/80 bg-card p-2 font-medium" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Operating Hours</label>
              <input type="text" readOnly value="Mon - Sun: 7:00 AM – 9:00 PM" className="mt-1 w-full rounded-xl border border-border/80 bg-card p-2 font-medium" />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}


// --- 4. INTERACTIVE COUNTER BILLING POS SHOWCASE ---
export function CounterBillingMockup() {
  const [items, setItems] = useState([
    { name: "Vanilla Cappuccino", price: 240, qty: 2 },
    { name: "Avocado Sourdough Toast", price: 340, qty: 1 }
  ]);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "cash">("upi");
  const [showReceipt, setShowReceipt] = useState(false);
  const [settled, setSettled] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const handleAddItem = (name: string, price: number) => {
    setItems(prev => [...prev, { name, price, qty: 1 }]);
  };

  const handleSettle = () => {
    setSettled(true);
    setTimeout(() => {
      setSettled(false);
      setShowReceipt(false);
    }, 2500);
  };

  const subtotal = items.reduce((acc, i) => acc + (i.price * i.qty), 0);
  const gst = Math.round(subtotal * 0.05);
  const total = subtotal + gst;

  return (
    <div className="w-full rounded-3xl bg-card p-4 md:p-6 shadow-soft ring-1 ring-border/60 space-y-5 text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-foreground shadow-soft">
            <Receipt className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold">Counter Billing POS</h3>
            <p className="text-xs text-muted-foreground">Add items, calculate bill & print thermal receipts in real time</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" /> Cashier Register Active
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-12 min-w-0">
        {/* Itemized Receipt Card */}
        <div className="md:col-span-7 min-w-0 rounded-2xl border border-border/80 bg-background p-4 shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CURRENT SESSION</div>
              <div className="font-display text-base font-semibold">Table 2 · Bill #INV-2026-089</div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleAddItem("Butter Croissant", 160)}
                className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary/80"
              >
                + Add Croissant
              </button>
            </div>
          </div>

          <div className="space-y-2 text-xs min-h-[100px]">
            {items.map((item, idx) => (
              <div key={idx} className="flex justify-between py-1 border-b border-border/30">
                <span>{item.qty}× {item.name}</span>
                <span className="font-semibold tabular-nums">₹{item.price * item.qty}.00</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border/60 pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>₹{subtotal}.00</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>GST (5%)</span>
              <span>₹{gst}.00</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-border/40">
              <span>Total Amount</span>
              <span className="tabular-nums">₹{total}.00</span>
            </div>
          </div>
        </div>

        {/* Payment & Receipt Actions */}
        <div className="md:col-span-5 min-w-0 rounded-2xl border border-border/80 bg-background p-4 shadow-soft space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SELECT PAYMENT METHOD</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(["upi", "card", "cash"] as const).map((method) => (
                <button 
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`flex flex-col items-center gap-1 rounded-xl p-2.5 transition font-semibold ${
                    paymentMethod === method ? "bg-brand text-brand-foreground shadow-soft" : "bg-secondary hover:bg-secondary/80 text-foreground"
                  }`}
                >
                  {method === "upi" && <QrCode className="h-4 w-4" />}
                  {method === "card" && <CreditCard className="h-4 w-4" />}
                  {method === "cash" && <CircleDollarSign className="h-4 w-4" />}
                  <span className="uppercase">{method}</span>
                </button>
              ))}
            </div>
          </div>

          {showReceipt && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-dashed border-border bg-card p-3 text-center text-xs space-y-1 font-mono"
            >
              <div className="font-bold">ORDERRAIL CAFÉ RECEIPT</div>
              <div>===================</div>
              {items.map((i, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{i.name}</span>
                  <span>₹{i.price}</span>
                </div>
              ))}
              <div className="font-bold pt-1">TOTAL: ₹{total}.00</div>
              <div className="text-[10px] text-muted-foreground pt-1">Paid via {paymentMethod.toUpperCase()}</div>
            </motion.div>
          )}

          <div className="space-y-2">
            <button 
              onClick={() => setShowReceipt(!showReceipt)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary py-2 text-xs font-semibold ring-1 ring-border/80 hover:bg-secondary/80 transition"
            >
              <Printer className="h-3.5 w-3.5 text-muted-foreground" /> {showReceipt ? "Hide Receipt" : "Generate Thermal Receipt"}
            </button>

            <motion.button 
              whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
              onClick={handleSettle}
              className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold shadow-soft transition ${
                settled ? "bg-emerald-700 text-white" : "btn-primary-action"
              }`}
            >
              {settled ? "✓ Settled & Table 2 Cleared!" : "Settle Order & Clear Table 2"}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}


// --- 5. INTERACTIVE QR RESTAURANT EXPERIENCE SCENE (AUTOPLAY + MANUAL STEP SWITCHER) ---
export function QrRestaurantSceneMockup() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev % 4) + 1);
    }, 3200);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const steps = [
    { num: 1, title: "1. Table Standee", desc: "Every dining table gets a sleek, durable QR standee with custom table numbers.", icon: Utensils, preview: "Standee on Table 4" },
    { num: 2, title: "2. Camera Scan", desc: "Guest points camera at table QR. Opens instant web link with no login required.", icon: QrCode, preview: "Scanning QR code..." },
    { num: 3, title: "3. Browse & Order", desc: "Interactive menu with high-res photos, veg/non-veg tags, and custom notes.", icon: Smartphone, preview: "Espresso added to cart!" },
    { num: 4, title: "4. Live Kitchen Ticket", desc: "Ticket rings instantly on kitchen display screen for prep and dispatch.", icon: ChefHat, preview: "Kitchen receives Ticket #00734C" },
  ];

  return (
    <div className="w-full rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 text-foreground space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">Interactive Journey</span>
          <h3 className="font-display text-2xl font-semibold">From Table Standee to Kitchen Order</h3>
        </div>

        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-foreground shadow-soft hover:bg-secondary/80 transition"
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5 text-amber-600" /> : <Play className="h-3.5 w-3.5 text-emerald-600" />}
          <span>{isPlaying ? "Pause Autoplay" : "Play Interactive Scene"}</span>
        </button>
      </div>

      {/* Step Selector Cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        {steps.map((step) => (
          <button
            key={step.num}
            onClick={() => { setCurrentStep(step.num); setIsPlaying(false); }}
            className={`rounded-2xl border p-4 text-left space-y-2 transition-all ${
              currentStep === step.num
                ? "border-accent bg-background shadow-float ring-2 ring-accent/30"
                : "border-border/60 bg-background/60 hover:bg-background"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`grid h-9 w-9 place-items-center rounded-xl font-bold ${
                currentStep === step.num ? "bg-brand text-brand-foreground" : "bg-accent/15 text-accent"
              }`}>
                <step.icon className="h-4.5 w-4.5" />
              </span>
              <span className="text-xs font-bold text-muted-foreground">0{step.num}</span>
            </div>
            <div className="font-display text-xs font-semibold">{step.title}</div>
            <p className="text-[11px] text-muted-foreground line-clamp-2">{step.desc}</p>
          </button>
        ))}
      </div>

      {/* Active Step Preview Window */}
      <div className="rounded-2xl border border-border/60 bg-background p-4 shadow-soft flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent/15 text-accent">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xs font-bold text-foreground">Step {currentStep} Active State: {steps[currentStep - 1].title}</div>
            <div className="text-xs text-muted-foreground">{steps[currentStep - 1].preview}</div>
          </div>
        </div>
        <span className="text-xs font-semibold text-accent flex items-center gap-1">
          Auto-simulating <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}
