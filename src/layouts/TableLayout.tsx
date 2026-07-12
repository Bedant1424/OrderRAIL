import { Outlet, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase, type Cafe, type TableRow } from "@/lib/db";
import { CartProvider } from "@/lib/cart";
import { BottomNav } from "@/components/customer/BottomNav";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import { useCustomerBackNavigation } from "@/hooks/useCustomerBack";

export default function TableLayout() {
  const { tableId } = useParams();
  useCustomerBackNavigation();
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["table", tableId],
    queryFn: async () => {
      // Clean up expired browsing sessions before loading table data
      await supabase.rpc("cleanup_expired_browsing_sessions");

      const { data: table, error: tErr } = await supabase
        .from("tables")
        .select("*")
        .eq("id", tableId!)
        .maybeSingle();
      if (tErr) throw tErr;
      if (!table) return null;

      let activeSessionId = table.active_session_id;

      if (!activeSessionId) {
        // Create a new dining session with 'browsing' status
        const { data: session, error: sErr } = await supabase
          .from("dining_sessions")
          .insert({ table_id: table.id, status: "browsing" })
          .select("id")
          .single();
        if (sErr) throw sErr;

        activeSessionId = session.id;

        // Update the table with the active session ID, keeping status free
        const { error: uErr } = await supabase
          .from("tables")
          .update({
            active_session_id: activeSessionId,
            status: "free",
          })
          .eq("id", table.id);
        if (uErr) throw uErr;

        table.active_session_id = activeSessionId;
        table.status = "free";
      }

      // Clear localStorage cart if the session ID has changed (e.g. table reset)
      const sessionKey = `orderrail.last_session_id.${tableId}`;
      const lastSession = localStorage.getItem(sessionKey);
      if (lastSession && lastSession !== activeSessionId) {
        localStorage.removeItem(`orderrail.cart.${tableId}`);
      }
      localStorage.setItem(sessionKey, activeSessionId);

      const { data: cafe, error: cErr } = await supabase
        .from("cafes")
        .select("*")
        .eq("id", table.cafe_id)
        .maybeSingle();
      if (cErr) throw cErr;
      return { cafe: cafe as Cafe, table: table as TableRow };
    },
    enabled: !!tableId,
  });

  useOrderNotifications({ tableId: tableId!, sessionId: data?.table.active_session_id ?? null });

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }

  if (error || !data) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-semibold">Table not found</h1>
          <p className="mt-2 text-muted-foreground">
            This QR code doesn't match an active table. Please ask a staff member.
          </p>
          <Link to="/" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  const { cafe, table } = data;

  return (
    <CartProvider key={table.active_session_id || "no-session"} tableId={tableId!}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
            <Link to={`/t/${tableId}`} className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-accent text-accent-foreground shadow-soft">
                <span className="font-display text-sm font-bold">OR</span>
              </span>
              <span>
                <span className="block text-xs uppercase tracking-widest text-muted-foreground">Table {table.label}</span>
                <span className="block font-display text-sm font-semibold leading-none">{cafe.name}</span>
              </span>
            </Link>
            {!online && (
              <span className="flex items-center gap-1.5 rounded-full bg-warning/20 px-2.5 py-1 text-xs font-medium text-foreground">
                <WifiOff className="h-3 w-3" /> Offline
              </span>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-md">
          <Outlet context={{ cafe, table }} />
        </main>

        <BottomNav />
      </div>
    </CartProvider>
  );
}

