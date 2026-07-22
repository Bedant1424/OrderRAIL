import { useState } from "react";
import { CounterHeaderV3 } from "@/components/counter/v3/CounterHeaderV3";
import { Search, ShoppingBag, Plus, Minus, Trash2, Zap, DollarSign, CreditCard, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CatalogItem {
  id: string;
  name: string;
  price: number;
  category: string;
  isVeg: boolean;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

const MENU_ITEMS: CatalogItem[] = [
  { id: "m-1", name: "Double Espresso", price: 4.5, category: "Coffee", isVeg: true },
  { id: "m-2", name: "Iced Vanilla Latte", price: 5.5, category: "Coffee", isVeg: true },
  { id: "m-3", name: "Artisan Club Sandwich", price: 12.0, category: "Food", isVeg: false },
  { id: "m-4", name: "Truffle Fries", price: 8.0, category: "Food", isVeg: true },
  { id: "m-5", name: "Sparkling Water", price: 3.5, category: "Beverages", isVeg: true },
  { id: "m-6", name: "Tiramisu Cake Slice", price: 7.5, category: "Desserts", isVeg: true },
  { id: "m-7", name: "Americano", price: 4.0, category: "Coffee", isVeg: true },
  { id: "m-8", name: "Margherita Pizza", price: 15.0, category: "Food", isVeg: true },
];

export default function CounterV5BPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([
    { id: "1", name: "Double Espresso", price: 4.5, qty: 1 },
    { id: "2", name: "Iced Vanilla Latte", price: 5.5, qty: 1 },
  ]);

  const handleAddItem = (item: CatalogItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.name === item.name);
      if (existing) {
        return prev.map((c) => (c.name === item.name ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { id: Date.now().toString(), name: item.name, price: item.price, qty: 1 }];
    });
    toast.success(`Added ${item.name}`);
  };

  const totalAmount = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  const handleQuickSettle = (method: string) => {
    if (cart.length === 0) {
      toast.error("Cart is empty!");
      return;
    }
    toast.success(`⚡ Quick Order Paid via ${method} ($${totalAmount.toFixed(2)})! Dispensing Receipt.`);
    setCart([]);
  };

  const filteredItems = MENU_ITEMS.filter((item) => {
    const matchesCat = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background font-sans overflow-hidden text-foreground antialiased selection:bg-brand/20">
      <CounterHeaderV3 />

      {/* Main Layout: 70% Left Menu Grid / 30% Right Express Register */}
      <main className="pt-14 pb-10 px-4 h-screen box-border">
        <div className="h-[calc(100vh-3.5rem-2rem)] mt-3 grid grid-cols-12 gap-4 overflow-hidden">
          
          {/* PANE 1: 70% LEFT - EXPRESS MENU CATALOG DOMINANCE */}
          <div className="col-span-12 lg:col-span-8 h-full flex flex-col justify-between bg-card/70 backdrop-blur-md rounded-3xl p-4 shadow-soft">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-border/20 pb-2">
                <div>
                  <h2 className="font-display text-sm font-extrabold flex items-center gap-2 text-foreground">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span>PROTOTYPE B: EXPRESS CAFE / QSR REGISTER</span>
                  </h2>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    Menu-First Workflow • 70% Express Catalog Dominance
                  </div>
                </div>

                {/* Optional Table Assignment Pill */}
                <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-1 rounded-full text-xs font-semibold">
                  <span>Takeaway / Table:</span>
                  <select className="bg-transparent border-none outline-none font-bold text-brand cursor-pointer">
                    <option>Express Takeaway</option>
                    <option>Table 1</option>
                    <option>Table 2</option>
                    <option>Table 4</option>
                  </select>
                </div>
              </div>

              {/* Menu Search & Category Filter Pills */}
              <div className="space-y-2 mb-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Fast Item Search or Code Entry..."
                    className="w-full rounded-2xl border-none bg-muted/40 py-2.5 pl-10 pr-4 text-xs outline-none focus:ring-2 focus:ring-brand/60 font-medium"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
                  {["All", "Coffee", "Food", "Beverages", "Desserts"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl font-semibold transition whitespace-nowrap",
                        selectedCategory === cat
                          ? "bg-foreground text-background shadow-soft"
                          : "bg-muted/30 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu Grid Cards */}
              <div className="grid grid-cols-4 gap-2.5 max-h-[calc(100vh-16rem)] overflow-y-auto section-scroll pr-1">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleAddItem(item)}
                    className="group rounded-2xl bg-muted/20 hover:bg-card p-3 hover:shadow-float transition cursor-pointer flex flex-col justify-between border border-border/10 hover:border-brand/30 min-h-[90px]"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-semibold text-xs text-foreground line-clamp-2">
                        {item.name}
                      </span>
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0 mt-1",
                          item.isVeg ? "bg-emerald-500" : "bg-red-500"
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs mt-2 pt-1.5 border-t border-border/15 font-mono">
                      <span className="font-bold text-foreground">${item.price.toFixed(2)}</span>
                      <span className="rounded-lg bg-brand/10 text-brand px-2 py-0.5 text-[10px] font-bold">
                        + Add
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[11px] font-mono text-muted-foreground text-center pt-2 border-t border-border/20">
              PROTOTYPE B: Tap item tiles for instant express order building.
            </div>
          </div>

          {/* PANE 2: 30% RIGHT - INSTANT EXPRESS REGISTER DECK */}
          <div className="col-span-12 lg:col-span-4 h-full flex flex-col justify-between bg-card/70 backdrop-blur-md rounded-3xl p-4 shadow-soft">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border/20 mb-3">
                <h2 className="font-display text-sm font-extrabold text-foreground flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4 text-brand" />
                  <span>EXPRESS REGISTER CART</span>
                </h2>
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </button>
              </div>

              {/* Cart Items List */}
              <div className="space-y-2 max-h-[200px] overflow-y-auto section-scroll pr-1 font-mono text-xs">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40">
                    <div>
                      <div className="font-bold text-foreground">{item.name}</div>
                      <div className="text-[10px] text-muted-foreground">${item.price.toFixed(2)} each</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand">x{item.qty}</span>
                      <span className="font-extrabold text-foreground">${(item.price * item.qty).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Tender & Instant Settlement Buttons */}
            <div className="space-y-3 pt-3 border-t border-border/20 bg-muted/30 p-4 rounded-3xl">
              <div className="flex items-center justify-between font-display font-extrabold text-sm text-foreground">
                <span>TOTAL DUE:</span>
                <span className="text-2xl text-brand">${totalAmount.toFixed(2)}</span>
              </div>

              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Quick Cash Tender Buttons
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => handleQuickSettle("Exact Cash")}
                  className="rounded-xl bg-card hover:bg-muted py-2 text-xs font-bold border border-border/40 text-foreground transition"
                >
                  Exact Cash
                </button>
                <button
                  onClick={() => handleQuickSettle("Cash $20")}
                  className="rounded-xl bg-card hover:bg-muted py-2 text-xs font-bold border border-border/40 text-foreground transition"
                >
                  $20.00
                </button>
                <button
                  onClick={() => handleQuickSettle("Cash $50")}
                  className="rounded-xl bg-card hover:bg-muted py-2 text-xs font-bold border border-border/40 text-foreground transition"
                >
                  $50.00
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => handleQuickSettle("Card Tap")}
                  className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-xs font-bold shadow-soft transition flex items-center justify-center gap-1.5"
                >
                  <CreditCard className="h-4 w-4" /> CARD TAP
                </button>

                <button
                  onClick={() => handleQuickSettle("Instant Cash")}
                  className="rounded-2xl bg-brand hover:bg-brand/90 text-brand-foreground py-3 text-xs font-bold shadow-soft transition flex items-center justify-center gap-1.5"
                >
                  <DollarSign className="h-4 w-4" /> PAY CASH
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-8 bg-card border-t border-border/80 px-4 flex items-center justify-between text-xs font-mono text-muted-foreground">
        <span>PROTOTYPE B: CAFE / QSR MENU-FIRST WORKFLOW</span>
        <span className="text-amber-500 font-bold">ROUTE: /counter/v5-b</span>
      </footer>
    </div>
  );
}
