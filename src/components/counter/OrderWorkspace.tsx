import { useState } from "react";
import { useTableEngine } from "@/lib/counter/tableEngine/tableStore";
import { Search, ShoppingBag, Plus, Minus, Trash2, Send, Utensils, Sparkles, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CatalogItem {
  id: string;
  name: string;
  price: number;
  category: string;
  isVeg: boolean;
}

interface CartLineItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  notes?: string;
}

const SAMPLE_CATALOG: CatalogItem[] = [
  { id: "m-1", name: "Double Espresso", price: 4.5, category: "Coffee", isVeg: true },
  { id: "m-2", name: "Americano", price: 4.0, category: "Coffee", isVeg: true },
  { id: "m-3", name: "Iced Vanilla Latte", price: 5.5, category: "Coffee", isVeg: true },
  { id: "m-4", name: "Artisan Club Sandwich", price: 12.0, category: "Food", isVeg: false },
  { id: "m-5", name: "Truffle Fries", price: 8.0, category: "Food", isVeg: true },
  { id: "m-6", name: "Sparkling Water", price: 3.5, category: "Beverages", isVeg: true },
  { id: "m-7", name: "Tiramisu Cake Slice", price: 7.5, category: "Desserts", isVeg: true },
  { id: "m-8", name: "Margherita Pizza", price: 15.0, category: "Food", isVeg: true },
];

const INITIAL_CART: CartLineItem[] = [
  { id: "c-1", name: "Double Espresso", price: 4.5, qty: 1 },
  { id: "c-2", name: "Artisan Club Sandwich", price: 12.0, qty: 2, notes: "Extra bacon, no onions" },
  { id: "c-3", name: "Iced Vanilla Latte", price: 5.5, qty: 1, notes: "Extra ice" },
  { id: "c-4", name: "Sparkling Water", price: 3.5, qty: 1 },
];

export function OrderWorkspace() {
  const { selectedTable, openTable, releaseTable, restoreAvailable } = useTableEngine();
  const [mode, setMode] = useState<"dine-in" | "takeaway">("dine-in");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cart, setCart] = useState<CartLineItem[]>(INITIAL_CART);

  const activeLabel = selectedTable ? selectedTable.label : "No Table Selected";

  const handleOpenTableClick = () => {
    if (!selectedTable) return;
    const res = openTable(selectedTable.id);
    if (res.success) {
      toast.success(`${selectedTable.label} opened! New Dining Session created.`);
    } else {
      toast.error(res.error ?? "Failed to open table.");
    }
  };

  const handleReleaseTableClick = () => {
    if (!selectedTable) return;
    const res = releaseTable(selectedTable.id);
    if (res.success) {
      toast.success(`${selectedTable.label} marked AVAILABLE!`);
    } else {
      toast.error(res.error ?? "Failed to release table.");
    }
  };

  const handleRestoreAvailableClick = () => {
    if (!selectedTable) return;
    const res = restoreAvailable(selectedTable.id);
    if (res.success) {
      toast.success(`${selectedTable.label} restored to operational status.`);
    } else {
      toast.error(res.error ?? "Failed to restore table.");
    }
  };

  const filteredCatalog = SAMPLE_CATALOG.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ["All", "Coffee", "Food", "Beverages", "Desserts"];

  return (
    <div className="flex flex-col h-full bg-card rounded-3xl p-4 shadow-soft ring-1 ring-border/60 justify-between select-none">
      {/* Top Controls: Mode Switcher & Menu Search */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-secondary/80 text-xs font-semibold">
            <button
              onClick={() => setMode("dine-in")}
              className={cn(
                "px-3 py-1.5 rounded-xl transition flex items-center gap-1.5",
                mode === "dine-in"
                  ? "bg-brand text-brand-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Utensils className="h-3.5 w-3.5" />
              <span>MODE: Dine-In ({activeLabel})</span>
            </button>
            <button
              onClick={() => setMode("takeaway")}
              className={cn(
                "px-3 py-1.5 rounded-xl transition flex items-center gap-1.5",
                mode === "takeaway"
                  ? "bg-brand text-brand-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Takeaway (F1)</span>
            </button>
          </div>

          <span className="text-xs font-mono text-muted-foreground font-medium hidden sm:inline">
            ORDER WORKSPACE (Alt+M)
          </span>
        </div>

        {/* Special Table Action Alert Banner if Table requires state action */}
        {selectedTable?.status === "AVAILABLE" && (
          <div className="flex items-center justify-between rounded-2xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs">
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              {selectedTable.label} is currently FREE.
            </span>
            <button
              onClick={handleOpenTableClick}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 font-bold shadow-soft transition active:scale-95"
            >
              + Open Session
            </button>
          </div>
        )}

        {selectedTable?.status === "CLEANING" && (
          <div className="flex items-center justify-between rounded-2xl bg-blue-500/10 border border-blue-500/30 px-3 py-2 text-xs">
            <span className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> {selectedTable.label} needs cleaning.
            </span>
            <button
              onClick={handleReleaseTableClick}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 font-bold shadow-soft transition active:scale-95"
            >
              Mark Available
            </button>
          </div>
        )}

        {selectedTable?.status === "OUT_OF_SERVICE" && (
          <div className="flex items-center justify-between rounded-2xl bg-muted border border-border px-3 py-2 text-xs">
            <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> {selectedTable.label} is OUT OF SERVICE.
            </span>
            <button
              onClick={handleRestoreAvailableClick}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1 font-bold transition active:scale-95"
            >
              Restore Service
            </button>
          </div>
        )}

        {/* Menu Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Menu by name or code... (F2)"
            className="w-full rounded-2xl border border-border bg-background py-2.5 pl-10 pr-4 text-xs outline-none focus:ring-2 focus:ring-brand/60 font-medium"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3 py-1 rounded-xl transition font-medium whitespace-nowrap border shrink-0",
                selectedCategory === cat
                  ? "bg-foreground text-background border-foreground font-semibold shadow-soft"
                  : "bg-secondary/40 text-muted-foreground border-border/60 hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Center Grid: Catalog Items Placeholder */}
      <div className="my-3 flex-1 overflow-y-auto section-scroll pr-1">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Menu Catalog ({filteredCatalog.length} Items)
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filteredCatalog.map((item) => (
            <div
              key={item.id}
              className="group rounded-2xl border border-border/60 bg-muted/20 p-2.5 hover:bg-card hover:border-brand/40 transition cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <span className="font-semibold text-xs text-foreground line-clamp-1">
                  {item.name}
                </span>
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0 mt-1",
                    item.isVeg ? "bg-emerald-500" : "bg-red-500"
                  )}
                  title={item.isVeg ? "Vegetarian" : "Non-Veg"}
                />
              </div>

              <div className="flex items-center justify-between text-xs mt-2 pt-1.5 border-t border-border/30">
                <span className="font-mono font-bold text-foreground">
                  ${item.price.toFixed(2)}
                </span>
                <button className="rounded-lg bg-brand/10 hover:bg-brand text-brand hover:text-brand-foreground px-2 py-0.5 text-[11px] font-semibold transition">
                  + Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Half: Active Order Cart in Session */}
      <div className="pt-3 border-t border-border/60 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-semibold text-foreground">
          <span className="flex items-center gap-1.5">
            <ShoppingBag className="h-4 w-4 text-brand" />
            <span>ACTIVE CART ({cart.reduce((acc, i) => acc + i.qty, 0)} Items)</span>
          </span>
          <span className="font-mono font-bold text-brand">
            Total: ${cart.reduce((acc, i) => acc + i.price * i.qty, 0).toFixed(2)}
          </span>
        </div>

        {/* Cart Line Items */}
        <div className="max-h-[140px] overflow-y-auto section-scroll pr-1 space-y-1.5">
          {cart.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl bg-muted/40 p-2 text-xs"
            >
              <div className="min-w-0 pr-2">
                <div className="font-semibold text-foreground truncate">{item.name}</div>
                {item.notes && (
                  <div className="text-[10px] text-muted-foreground italic truncate">
                    "{item.notes}"
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 bg-background rounded-lg border border-border px-1.5 py-0.5">
                  <button className="text-muted-foreground hover:text-foreground">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="font-mono font-bold text-xs px-1">{item.qty}</span>
                  <button className="text-muted-foreground hover:text-foreground">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                <span className="font-mono font-bold text-foreground w-12 text-right">
                  ${(item.price * item.qty).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Cart Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button className="rounded-2xl border border-border bg-secondary/80 hover:bg-destructive/10 hover:border-destructive/30 text-muted-foreground hover:text-destructive py-2.5 text-xs font-semibold transition flex items-center justify-center gap-1.5">
            <Trash2 className="h-3.5 w-3.5" /> CLEAR CART (Esc)
          </button>

          <button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-xs font-semibold shadow-soft transition flex items-center justify-center gap-1.5 active:scale-95">
            <Send className="h-3.5 w-3.5" /> SUBMIT KOT (F5)
          </button>
        </div>
      </div>
    </div>
  );
}
