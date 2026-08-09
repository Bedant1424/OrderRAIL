import { NavLink, useParams } from "react-router-dom";
import { Utensils, ShoppingBag, ConciergeBell } from "lucide-react";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";
import { useCustomerNavigate } from "@/hooks/useCustomerBack";

export function BottomNav() {
  const { tableId } = useParams();
  const { count } = useCart();
  const customerNavigate = useCustomerNavigate();

  const items = [
    { to: `/t/${tableId}`, label: "Menu", icon: Utensils, end: true },
    { to: `/t/${tableId}/cart`, label: "My Order", icon: ShoppingBag, badge: count },
    { to: `/t/${tableId}/call`, label: "Call Staff", icon: ConciergeBell },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-cc-background/95 backdrop-blur-md border-t border-cc-border pb-safe shadow-lg"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-3 py-1.5">
        {items.map(({ to, label, icon: Icon, end, badge }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              onClick={(e) => {
                e.preventDefault();
                customerNavigate(to);
              }}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center gap-1 rounded-2xl py-1.5 text-xs font-semibold transition-all active:scale-95 min-h-[44px] justify-center",
                  isActive
                    ? "text-cc-primary bg-cc-primary/10 font-bold"
                    : "text-cc-text-muted hover:text-cc-text hover:bg-cc-surface/60"
                )
              }
            >
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={2.2} />
                {badge && badge > 0 ? (
                  <span className="absolute -right-2.5 -top-1.5 grid h-4.5 min-w-[1.2rem] place-items-center rounded-full bg-cc-primary px-1 text-[10px] font-black text-white shadow-xs">
                    {badge}
                  </span>
                ) : null}
              </span>
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
