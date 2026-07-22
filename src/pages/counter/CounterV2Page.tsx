import { useState } from "react";
import { CounterHeader } from "@/components/counter/CounterHeader";
import { TableGrid } from "@/components/counter/TableGrid";
import { OrderWorkspace } from "@/components/counter/OrderWorkspace";
import { BillingSidebar } from "@/components/counter/BillingSidebar";
import { QuickActionsBar } from "@/components/counter/QuickActionsBar";
import { StatusBar } from "@/components/counter/StatusBar";
import { type TableCardData } from "@/components/counter/TableCard";
import { LayoutGrid, Utensils, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CounterV2Page() {
  const [selectedTableId, setSelectedTableId] = useState<string | null>("t-4");
  const [mobileTab, setMobileTab] = useState<"tables" | "workspace" | "billing">("workspace");

  const handleSelectTable = (table: TableCardData) => {
    setSelectedTableId(table.id);
  };

  return (
    <div className="min-h-screen bg-background font-sans overflow-hidden text-foreground antialiased selection:bg-brand/20">
      {/* 1. Persistent Fixed Header */}
      <CounterHeader />

      {/* Mobile Tab Switcher (Visible on small screens) */}
      <div className="lg:hidden fixed top-14 left-0 right-0 z-20 bg-card border-b border-border p-2 grid grid-cols-3 gap-1 text-xs font-semibold">
        <button
          onClick={() => setMobileTab("tables")}
          className={cn(
            "py-2 rounded-xl flex items-center justify-center gap-1.5 transition",
            mobileTab === "tables" ? "bg-brand text-brand-foreground shadow-soft" : "text-muted-foreground"
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" /> Tables
        </button>

        <button
          onClick={() => setMobileTab("workspace")}
          className={cn(
            "py-2 rounded-xl flex items-center justify-center gap-1.5 transition",
            mobileTab === "workspace" ? "bg-brand text-brand-foreground shadow-soft" : "text-muted-foreground"
          )}
        >
          <Utensils className="h-3.5 w-3.5" /> Workspace
        </button>

        <button
          onClick={() => setMobileTab("billing")}
          className={cn(
            "py-2 rounded-xl flex items-center justify-center gap-1.5 transition",
            mobileTab === "billing" ? "bg-brand text-brand-foreground shadow-soft" : "text-muted-foreground"
          )}
        >
          <Receipt className="h-3.5 w-3.5" /> Billing
        </button>
      </div>

      {/* 2. Main Widescreen 3-Column Layout Container */}
      <main className="pt-14 lg:pt-14 pb-17 px-3 h-screen box-border">
        <div className="h-[calc(100vh-3.5rem-2.25rem-2rem)] lg:h-[calc(100vh-3.5rem-2.25rem-2rem)] mt-3 lg:mt-3 grid grid-cols-12 gap-3 overflow-hidden">
          {/* Left Column: Table Grid (30% / col-span-3) */}
          <div
            className={cn(
              "col-span-12 lg:col-span-3 h-full overflow-hidden transition-all duration-200",
              mobileTab !== "tables" && "hidden lg:block"
            )}
          >
            <TableGrid
              selectedTableId={selectedTableId}
              onSelectTable={handleSelectTable}
            />
          </div>

          {/* Center Column: Order Workspace (45% / col-span-5) */}
          <div
            className={cn(
              "col-span-12 lg:col-span-5 h-full overflow-hidden transition-all duration-200",
              mobileTab !== "workspace" && "hidden lg:block"
            )}
          >
            <OrderWorkspace />
          </div>

          {/* Right Column: Billing Sidebar (25% / col-span-4) */}
          <div
            className={cn(
              "col-span-12 lg:col-span-4 h-full overflow-hidden transition-all duration-200",
              mobileTab !== "billing" && "hidden lg:block"
            )}
          >
            <BillingSidebar />
          </div>
        </div>
      </main>

      {/* 3. Persistent Quick Actions Bar */}
      <QuickActionsBar />

      {/* 4. Persistent Status Bar */}
      <StatusBar />
    </div>
  );
}
