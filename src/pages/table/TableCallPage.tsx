import { useOutletContext } from "react-router-dom";
import type { Cafe, TableRow } from "@/lib/db";
import { CallStaff } from "@/components/customer/CallStaff";

export default function TableCallPage() {
  const { cafe, table } = useOutletContext<{ cafe: Cafe; table: TableRow }>();
  return <CallStaff cafe={cafe} table={table} />;
}
