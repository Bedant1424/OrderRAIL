import { useOutletContext } from "react-router-dom";
import type { Cafe, TableRow } from "@/lib/db";
import { OrderStatusView } from "@/components/customer/OrderStatusView";

export default function TableOrderPage() {
  const { cafe } = useOutletContext<{ cafe: Cafe; table: TableRow }>();
  return <OrderStatusView cafe={cafe} />;
}
