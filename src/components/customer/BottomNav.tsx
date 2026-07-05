import { NavLink, useParams } from "react-router-dom";
import { Coffee, ShoppingBag, BellRing } from "lucide-react";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const { tableId } = useParams();
  const { count } = useCart();

  const items = [
    { to: `/t/${tableId}`, label: "Menu", icon: Coffee, end: true },
    { to: `/t/${tableId}/cart`, label: "My Order", icon: ShoppingBag, badge: count },
    { to: `/t/${tableId}/call`, label: "Call Staff", icon: BellRing },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 glass border-t border-border pb-safe"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-2">
        {items.map(({ to, label, icon: Icon, end, badge }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center gap-1 rounded-2xl py-2 text-xs font-medium transition-colors",
                  isActive ? "text-accent" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <span className="relative">
                <Icon className="h-6 w-6" strokeWidth={2} />
                {badge && badge > 0 ? (
                  <span className="absolute -right-2 -top-2 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground shadow-soft">
                    {badge}
                  </span>
                ) : null}
              </span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
