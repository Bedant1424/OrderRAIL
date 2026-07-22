import { useState } from "react";
import { TableEngineProvider } from "@/lib/counter/tableEngine/tableStore";
import { CounterHeaderV3 } from "@/components/counter/v3/CounterHeaderV3";
import { TableGridV3 } from "@/components/counter/v3/TableGridV3";
import { OrderWorkspaceV3 } from "@/components/counter/v3/OrderWorkspaceV3";
import { LayoutGrid, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

function CounterV3Layout() {
  const [mobileTab, setMobileTab] = useState<"tables" | "workspace">("workspace");

  return (
    <div className="min-h-screen bg-background font-sans overflow-hidden text-foreground antialiased selection:bg-brand/20">
      {/* 1. Persistent Fixed Header */}
      <CounterHeaderV3 />

      {/* Mobile Tab Switcher (Visible on small screen viewports) */}
      <div className="lg:hidden fixed top-14 left-0 right-0 z-20 bg-card border-b border-border p-2 grid grid-cols-2 gap-1 text-xs font-semibold">
        <button
          onClick={() => setMobileTab("tables")}
          className={cn(
            "py-2 rounded-xl flex items-center justify-center gap-1.5 transition",
            mobileTab === "tables" ? "bg-brand text-brand-foreground shadow-soft" : "text-muted-foreground"
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" /> Tables Deck
        </button>

        <button
          onClick={() => setMobileTab("workspace")}
          className={cn(
            "py-2 rounded-xl flex items-center justify-center gap-1.5 transition",
            mobileTab === "workspace" ? "bg-brand text-brand-foreground shadow-soft" : "text-muted-foreground"
          )}
        >
          <Utensils className="h-3.5 w-3.5" /> Active Workspace
        </button>
      </div>

      {/* 2. Main 2-Pane Dynamic Deck Layout (35% Left / 65% Right) */}
      <main className="pt-14 lg:pt-14 pb-10 px-3 h-screen box-border">
        <div className="h-[calc(100vh-3.5rem-2rem)] mt-3 grid grid-cols-12 gap-3 overflow-hidden">
          {/* Pane 1: Tables Deck (35% / col-span-4) */}
          <div
            className={cn(
              "col-span-12 lg:col-span-4 h-full overflow-hidden transition-all duration-200",
              mobileTab !== "tables" && "hidden lg:block"
            )}
          >
            <TableGridV3 />
          </div>

          {/* Pane 2: Active Operational Workspace (65% / col-span-8) */}
          <div
            className={cn(
              "col-span-12 lg:col-span-8 h-full overflow-hidden transition-all duration-200",
              mobileTab !== "workspace" && "hidden lg:block"
            )}
          >
            <OrderWorkspaceV3 />
          </div>
        </div>
      </main>

      {/* 3. Streamlined Persistent Status Bar (32px) */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 h-8 bg-card border-t border-border/80 px-4 flex items-center justify-between text-[11px] font-mono text-muted-foreground select-none">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          <span><strong className="text-foreground">F1:</strong> Takeaway</span>
          <span><strong className="text-foreground">F2:</strong> Search</span>
          <span><strong className="text-foreground">F3:</strong> Calls</span>
          <span><strong className="text-foreground">F5:</strong> Submit KOT</span>
          <span><strong className="text-foreground">F8:</strong> Print Bill</span>
          <span><strong className="text-foreground">F10:</strong> Pay Cash</span>
          <span><strong className="text-foreground">F11:</strong> Pay Card</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-semibold text-foreground">SYNC: 100% OK</span>
        </div>
      </footer>
    </div>
  );
}

export default function CounterV3Page() {
  return (
    <TableEngineProvider>
      <CounterV3Layout />
    </TableEngineProvider>
  );
}
