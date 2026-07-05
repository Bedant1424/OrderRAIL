import { useOutletContext } from "react-router-dom";
import type { Cafe, TableRow } from "@/lib/db";
import { CartView } from "@/components/customer/CartView";

export default function TableCartPage() {
  const { cafe, table } = useOutletContext<{ cafe: Cafe; table: TableRow }>();
  return <CartView cafe={cafe} table={table} />;
}
