import { useState } from "react";
import { TableEngineProvider, useTableEngine } from "@/lib/counter/tableEngine/tableStore";
import { CounterHeaderV3 } from "@/components/counter/v3/CounterHeaderV3";
import { TableEntity } from "@/lib/counter/tableEngine/tableTypes";
import { Users, Clock, Receipt, Utensils, Send, CheckCircle, ArrowRight, Layers, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BillingDrawerV3 } from "@/components/counter/v3/BillingDrawerV3";

function RestaurantFirstLayout() {
  const { tables, selectedTableId, selectTable, selectedTable, openTable, releaseTable } = useTableEngine();
  const [activeZone, setActiveZone] = useState<string>("Main Dining");
  const [isBillingOpen, setIsBillingOpen] = useState<boolean>(false);

  const activeLabel = selectedTable ? selectedTable.label : "Table 4";

  const handleOpenTable = (t: TableEntity) => {
    const res = openTable(t.id);
    if (res.success) {
      toast.success(`${t.label} opened! New Dining Session created.`);
    } else {
      toast.error(res.error ?? "Failed to open table.");
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans overflow-hidden text-foreground antialiased selection:bg-brand/20">
      <CounterHeaderV3 />

      {/* Main 50/50 Split Deck Layout for Restaurant Table-First Focus */}
      <main className="pt-14 pb-10 px-4 h-screen box-border">
        <div className="h-[calc(100vh-3.5rem-2rem)] mt-3 grid grid-cols-12 gap-4 overflow-hidden">
          
          {/* PANE 1: 50% LEFT - FLOOR DECK DOMINANCE */}
          <div className="col-span-12 lg:col-span-6 h-full flex flex-col justify-between bg-card/70 backdrop-blur-md rounded-3xl p-4 shadow-soft">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-border/20 pb-2">
                <div>
                  <h2 className="font-display text-sm font-extrabold flex items-center gap-2 text-foreground">
                    <LayoutGrid className="h-4 w-4 text-brand" />
                    <span>PROTOTYPE A: RESTAURANT FLOOR DECK</span>
                  </h2>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    Table-First Workflow • 50/50 Floor Plan Focus
                  </div>
                </div>

                {/* Floor Zone Pills */}
                <div className="flex items-center gap-1">
                  {["Main Dining", "Patio", "Bar"].map((zone) => (
                    <button
                      key={zone}
                      onClick={() => setActiveZone(zone)}
                      className={cn(
                        "px-2.5 py-1 rounded-xl text-xs font-semibold transition flex items-center gap-1",
                        activeZone === zone
                          ? "bg-foreground text-background shadow-soft"
                          : "bg-muted/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Layers className="h-3 w-3" /> {zone}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table Card Grid */}
              <div className="grid grid-cols-3 gap-2.5 max-h-[calc(100vh-14rem)] overflow-y-auto section-scroll pr-1">
                {tables.map((t) => {
                  const isSelected = selectedTableId === t.id;
                  const isOccupied = t.status === "OCCUPIED";
                  const isBillReq = t.status === "BILL_REQUESTED";
                  const isAvailable = t.status === "AVAILABLE";

                  return (
                    <div
                      key={t.id}
                      onClick={() => selectTable(t.id)}
                      className={cn(
                        "rounded-2xl p-3.5 flex flex-col justify-between transition cursor-pointer select-none min-h-[95px] shadow-sm hover:scale-[1.02]",
                        isAvailable && "bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20",
                        isOccupied && "bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20",
                        isBillReq && "bg-orange-500/20 border border-orange-500/50 animate-pulse",
                        isSelected && "ring-2 ring-brand ring-offset-2 ring-offset-background border-brand bg-brand/15"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display font-extrabold text-base text-foreground">
                          {t.label}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-background/60">
                          {t.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-1 border-t border-border/20 font-mono">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {t.seats} Seats
                        </span>
                        {(isOccupied || isBillReq) && (
                          <span className="flex items-center gap-1 font-bold text-foreground">
                            <Clock className="h-3 w-3" /> 34m
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-[11px] font-mono text-muted-foreground text-center pt-2 border-t border-border/20">
              PROTOTYPE A: Click table to open session or manage active dining order.
            </div>
          </div>

          {/* PANE 2: 50% RIGHT - TABLE SESSION WORKSPACE */}
          <div className="col-span-12 lg:col-span-6 h-full flex flex-col justify-between bg-card/70 backdrop-blur-md rounded-3xl p-4 shadow-soft">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border/20 mb-3">
                <div>
                  <h2 className="font-display text-base font-extrabold text-foreground flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-brand" />
                    <span>SESSION WORKSPACE: {activeLabel}</span>
                  </h2>
                  <div className="text-xs text-muted-foreground font-mono">
                    Status: {selectedTable?.status ?? "OCCUPIED"} • 4 Guests
                  </div>
                </div>

                {selectedTable?.status === "AVAILABLE" && (
                  <button
                    onClick={() => selectedTable && handleOpenTable(selectedTable)}
                    className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 font-bold text-xs shadow-soft transition active:scale-95"
                  >
                    + Open Table Session
                  </button>
                )}
              </div>

              {/* Sample Table Order Line Items */}
              <div className="space-y-2 mb-4">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Active Dining Items
                </div>
                <div className="space-y-1.5 font-mono text-xs max-h-[220px] overflow-y-auto section-scroll pr-1">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40">
                    <span>1x Double Espresso</span>
                    <strong className="text-foreground">$4.50</strong>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40">
                    <span>2x Artisan Club Sandwich</span>
                    <strong className="text-foreground">$24.00</strong>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40">
                    <span>1x Iced Vanilla Latte (Extra ice)</span>
                    <strong className="text-foreground">$5.50</strong>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40">
                    <span>1x Sparkling Water</span>
                    <strong className="text-foreground">$3.50</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary & Action CTAs */}
            <div className="space-y-3 pt-3 border-t border-border/20 bg-muted/30 p-4 rounded-3xl">
              <div className="flex items-center justify-between font-display font-extrabold text-lg text-foreground">
                <span>TOTAL DUE:</span>
                <span className="text-2xl text-brand">$37.50</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => toast.success("KOT Ticket #104 Spooled to Kitchen")}
                  className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-xs font-bold shadow-soft transition flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" /> SEND KOT TO KITCHEN
                </button>

                <button
                  onClick={() => setIsBillingOpen(true)}
                  className="rounded-2xl bg-brand hover:bg-brand/90 text-brand-foreground py-3 text-xs font-bold shadow-soft transition flex items-center justify-center gap-2"
                >
                  <Receipt className="h-4 w-4" /> SETTLE & FREE TABLE <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <BillingDrawerV3 isOpen={isBillingOpen} onClose={() => setIsBillingOpen(false)} />

      <footer className="fixed bottom-0 left-0 right-0 h-8 bg-card border-t border-border/80 px-4 flex items-center justify-between text-xs font-mono text-muted-foreground">
        <span>PROTOTYPE A: RESTAURANT TABLE-FIRST WORKFLOW</span>
        <span className="text-emerald-500 font-bold">ROUTE: /counter/v5-a</span>
      </footer>
    </div>
  );
}

export default function CounterV5APage() {
  return (
    <TableEngineProvider>
      <RestaurantFirstLayout />
    </TableEngineProvider>
  );
}
