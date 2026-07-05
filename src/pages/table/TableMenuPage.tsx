import { useOutletContext } from "react-router-dom";
import type { Cafe, TableRow } from "@/lib/db";
import { MenuBrowser } from "@/components/customer/MenuBrowser";
import { FloatingCart } from "@/components/customer/FloatingCart";

export default function TableMenuPage() {
  const { cafe } = useOutletContext<{ cafe: Cafe; table: TableRow }>();
  return (
    <>
      <MenuBrowser cafeId={cafe.id} currency={cafe.currency} />
      <FloatingCart currency={cafe.currency} />
    </>
  );
}
