import { useState, useEffect } from "react";
import { Outlet, useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WifiOff, Info, Globe, Instagram, Phone, MapPin, Clock, Star, MessageSquare, AlertCircle } from "lucide-react";
import { supabase, type Cafe, type TableRow } from "@/lib/db";
import { getOrCreateDiningSession, getActiveDiningSession } from "@/lib/tables/tableRepository";
import { getOrCreateGuestSession as establishGuestSession, clearGuestSession } from "@/lib/guestSession";
import { CartProvider } from "@/lib/cart";
import { BottomNav } from "@/components/customer/BottomNav";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import { useCustomerBackNavigation, useCustomerOverlay, useCustomerNavigate } from "@/hooks/useCustomerBack";
import { useImageUrl } from "@/lib/useImageUrl";
import { clearOrderHistory } from "@/lib/orderHistory";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import { useCafe } from "@/lib/cafe";

export default function TableLayout() {
  const { tableId } = useParams();
  const queryClient = useQueryClient();
  const { cafe: globalCafe } = useCafe();
  useCustomerBackNavigation();
  const customerNavigate = useCustomerNavigate();
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  useCustomerOverlay(isAboutOpen, setIsAboutOpen, "about-cafe");

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

  // 1. Fast Table Resolution Query (Only fetches table row; completes in ~150ms)
  const { data: table, isLoading: loadingTable, error: tableError } = useQuery({
    queryKey: ["table", tableId],
    queryFn: async () => {
      const isUuid = (val?: string | null): boolean =>
        !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      let tableRow: TableRow | null = null;
      let tErr: any = null;

      if (isUuid(tableId)) {
        const res = await supabase
          .from("tables")
          .select("*")
          .eq("id", tableId!)
          .maybeSingle();
        tableRow = res.data as TableRow | null;
        tErr = res.error;
      }

      if (!tableRow && !tErr) {
        const cleanLabel = tableId!.replace(/^t-/i, "").trim();
        const { data: tableByLabel, error: lErr } = await supabase
          .from("tables")
          .select("*")
          .or(`label.eq.${tableId},label.eq.${cleanLabel},label.ilike.Table ${cleanLabel}`)
          .limit(1)
          .maybeSingle();
        tableRow = tableByLabel as TableRow | null;
        tErr = lErr;
      }

      if (tErr) throw tErr;
      return tableRow;
    },
    enabled: !!tableId,
  });

  // 2. Deduplicated Cafe Query (Reuses globalCafe from CafeProvider if cafe_id matches)
  const { data: cafe, isLoading: loadingCafe, error: cafeError } = useQuery({
    queryKey: ["table-cafe", table?.cafe_id],
    queryFn: async () => {
      if (globalCafe && globalCafe.id === table?.cafe_id) {
        return globalCafe;
      }
      const { data: cafeData, error: cErr } = await supabase
        .from("cafes")
        .select("*")
        .eq("id", table!.cafe_id)
        .maybeSingle();
      if (cErr) throw cErr;
      return cafeData as Cafe;
    },
    enabled: !!table?.cafe_id,
    initialData: globalCafe && globalCafe.id === table?.cafe_id ? globalCafe : undefined,
  });

  // 3. Concurrent Dining & Guest Session Resolution Query
  const { data: sessionData } = useQuery({
    queryKey: ["table-session", table?.id, table?.status, table?.active_session_id],
    queryFn: async () => {
      if (!table) return { activeSessionId: null, isSessionActive: false, guestSessionId: null };

      // 1. Resolve or check active dining session
      const activeSess = await getActiveDiningSession(table as TableRow);
      let activeSessionId: string | null = null;
      let isSessionActive = false;
      let guestSessionId: string | null = null;

      if (activeSess) {
        activeSessionId = activeSess.id;
        isSessionActive = true;
      } else if (table.status !== "free") {
        // Fallback for session creation if table is occupied/browsing
        activeSessionId = await getOrCreateDiningSession(table as TableRow);
        isSessionActive = !!activeSessionId;
      }

      if (isSessionActive && activeSessionId) {
        // Clear localStorage cart & order history if the session ID has changed (e.g. table reset)
        const sessionKey = `orderrail.last_session_id.${tableId}`;
        const lastSession = localStorage.getItem(sessionKey);
        if (lastSession && lastSession !== activeSessionId) {
          localStorage.removeItem(`orderrail.cart.${tableId}`);
          clearOrderHistory(tableId!, lastSession);
          clearGuestSession(tableId!);
        }
        localStorage.setItem(sessionKey, activeSessionId);

        // 2. Establish/restore Guest Session for active Dining Session
        guestSessionId = await establishGuestSession(table.id, activeSessionId);
      } else {
        clearGuestSession(tableId!);
      }

      return {
        activeSessionId,
        isSessionActive,
        guestSessionId,
      };
    },
    enabled: !!table,
  });

  // 4. Pre-warm menu categories & items queries as soon as cafe_id is resolved
  useEffect(() => {
    const targetCafeId = cafe?.id || table?.cafe_id;
    if (!targetCafeId) return;

    void queryClient.prefetchQuery({
      queryKey: ["menu_categories", targetCafeId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("menu_categories")
          .select("*")
          .eq("cafe_id", targetCafeId)
          .order("sort_order");
        if (error) throw error;
        return data;
      },
    });

    void queryClient.prefetchQuery({
      queryKey: ["menu_items", targetCafeId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("menu_items")
          .select("*")
          .eq("cafe_id", targetCafeId)
          .eq("is_available", true)
          .order("sort_order");
        if (error) throw error;
        return data;
      },
    });
  }, [cafe?.id, table?.cafe_id, queryClient]);

  // Listen for realtime table resets and session status changes
  useEffect(() => {
    const targetCafeId = cafe?.id || table?.cafe_id;
    if (!targetCafeId || !tableId) return;

    const channel = supabase
      .channel(`cafe-workstation-${targetCafeId}`)
      .on("broadcast", { event: "*" }, (payload) => {
        const evt = payload.event;
        const payloadTableId = payload.payload?.tableId;

        if (evt === "TABLE_RESET" || evt === "SESSION_CLOSED" || evt === "SESSION_OPENED") {
          if (!payloadTableId || payloadTableId === table?.id || payloadTableId === tableId) {
            if (evt === "TABLE_RESET" || evt === "SESSION_CLOSED") {
              clearGuestSession(tableId);
              localStorage.removeItem(`orderrail.cart.${tableId}`);
            }
            queryClient.invalidateQueries({ queryKey: ["table", tableId] });
            if (table?.id) {
              queryClient.invalidateQueries({ queryKey: ["table-session", table.id] });
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cafe?.id, table?.cafe_id, tableId, queryClient, table?.id]);

  const activeSessionId = sessionData?.activeSessionId ?? table?.active_session_id ?? null;
  const isSessionActive = sessionData?.isSessionActive ?? (table ? table.status !== "free" || !!table.active_session_id : false);
  const guestSessionId = sessionData?.guestSessionId ?? null;

  useOrderNotifications({ tableId: tableId!, sessionId: activeSessionId });

  const logoSrc = useImageUrl(cafe?.logo_url);

  if (loadingTable || (loadingCafe && !cafe)) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }

  if (tableError || cafeError || !table || !cafe) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-semibold">Table not found</h1>
          <p className="mt-2 text-muted-foreground">
            This QR code doesn't match an active table. Please ask a staff member.
          </p>
          <Link to="/" className="mt-6 inline-block rounded-full btn-primary-action px-6 py-3 text-sm font-semibold">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  const mergedTable = { ...table, active_session_id: activeSessionId };

  return (
    <CartProvider key={activeSessionId || "no-session"} tableId={tableId!}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
            <Link
              to={`/t/${tableId}`}
              onClick={(e) => {
                e.preventDefault();
                customerNavigate(`/t/${tableId}`);
              }}
              className="flex items-center gap-2"
            >
              {logoSrc ? (
                <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-border shadow-soft bg-card shrink-0">
                  <img src={logoSrc} alt={cafe.name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-brand-foreground shadow-soft shrink-0">
                  <span className="font-display text-sm font-bold">OR</span>
                </span>
              )}
              <span>
                <span className="block text-xs uppercase tracking-widest text-muted-foreground">Table {table.label}</span>
                <span className="block font-display text-sm font-semibold leading-none">{cafe.name}</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              {!online && (
                <span className="flex items-center gap-1.5 rounded-full bg-warning/20 px-2.5 py-1 text-xs font-medium text-foreground">
                  <WifiOff className="h-3 w-3" /> Offline
                </span>
              )}
              <button
                onClick={() => setIsAboutOpen(true)}
                className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-secondary-foreground hover:bg-muted active:scale-95 transition-all shadow-sm"
                aria-label="About Café"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-md">
          {!isSessionActive && (
            <div className="m-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-center shadow-sm">
              <div className="mx-auto mb-2.5 grid h-10 w-10 place-items-center rounded-full bg-amber-500/20 text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-bold text-foreground">Table Currently Inactive</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                This table is currently inactive. Please ask the staff to activate your table.
              </p>
            </div>
          )}
          <Outlet context={{ cafe, table: mergedTable, guestSessionId, isSessionActive }} />
        </main>

        <BottomNav />

        {isAboutOpen && (
          <Drawer open={isAboutOpen} onOpenChange={setIsAboutOpen}>
            <DrawerContent className="max-w-md mx-auto p-6 flex flex-col focus:outline-none">
              <div className="flex flex-col items-center text-center space-y-3">
                {logoSrc ? (
                  <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-border shadow-soft bg-card">
                    <img src={logoSrc} alt={cafe.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-warm flex items-center justify-center text-3xl shadow-soft">
                    ☕
                  </div>
                )}
                
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground leading-tight break-words">{cafe.name}</h2>
                  {cafe.tagline && (
                    <p className="mt-1 text-xs text-muted-foreground italic leading-relaxed break-words">{cafe.tagline}</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex-1 overflow-y-auto space-y-4 pr-1 py-1">
                {cafe.address && (
                  <div className="flex gap-3 text-sm">
                    <MapPin className="h-4.5 w-4.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-foreground text-xs uppercase tracking-wider">Address</div>
                      <div className="mt-0.5 text-muted-foreground break-words">{cafe.address}</div>
                    </div>
                  </div>
                )}

                {cafe.phone && (
                  <div className="flex gap-3 text-sm">
                    <Phone className="h-4.5 w-4.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-foreground text-xs uppercase tracking-wider">Phone</div>
                      <a href={`tel:${cafe.phone}`} className="mt-0.5 block text-primary hover:underline font-medium break-all">
                        {cafe.phone}
                      </a>
                    </div>
                  </div>
                )}

                {cafe.operating_hours && (
                  <div className="flex gap-3 text-sm">
                    <Clock className="h-4.5 w-4.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-foreground text-xs uppercase tracking-wider">Operating Hours</div>
                      <div className="mt-0.5 text-muted-foreground whitespace-pre-line break-words">{cafe.operating_hours}</div>
                    </div>
                  </div>
                )}

                {/* Socials / Links row */}
                {(cafe.website || cafe.instagram || cafe.whatsapp) && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {cafe.website && (
                      <a
                        href={cafe.website}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-full bg-secondary/60 hover:bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition"
                      >
                        <Globe className="h-3.5 w-3.5" /> Website
                      </a>
                    )}
                    {cafe.instagram && (
                      <a
                        href={cafe.instagram}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-full bg-secondary/60 hover:bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition"
                      >
                        <Instagram className="h-3.5 w-3.5" /> Instagram
                      </a>
                    )}
                    {cafe.whatsapp && (
                      <a
                        href={`https://wa.me/${cafe.whatsapp.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition"
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    )}
                  </div>
                )}
                
                {/* Google Reviews Button */}
                {cafe.google_maps_review_url && (
                  <div className="pt-4">
                    <a
                      href={cafe.google_maps_review_url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full rounded-full btn-primary-action py-3 text-xs font-semibold flex items-center justify-center gap-2"
                    >
                      <Star className="h-4 w-4 fill-warning text-warning" />
                      Leave a Google Review
                    </a>
                  </div>
                )}
              </div>

              <DrawerFooter className="pt-6 px-0 pb-0">
                <button
                  onClick={() => setIsAboutOpen(false)}
                  className="w-full rounded-full bg-secondary py-3 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition"
                >
                  Close
                </button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        )}
      </div>
    </CartProvider>
  );
}
