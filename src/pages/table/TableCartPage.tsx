import { useOutletContext } from "react-router-dom";
import type { Cafe, TableRow } from "@/lib/db";
import { CartView } from "@/components/customer/CartView";

export default function TableCartPage() {
  const ctx = useOutletContext<{ cafe?: Cafe; table?: TableRow }>() || {};
  if (!ctx.cafe || !ctx.table) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-cc-text-muted font-medium">
        Loading cart…
      </div>
    );
  }
  return <CartView cafe={ctx.cafe} table={ctx.table} />;
}
