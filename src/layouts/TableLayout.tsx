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
import { CHEESE_CORNER_CONFIG } from "@/branding/cheesecorner/config";

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
    return (
      <div className="grid min-h-screen place-items-center bg-cc-background text-cc-text-muted font-medium">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cc-primary/20 border-t-cc-primary" />
          <span className="text-xs font-medium">Loading Cheese Corner…</span>
        </div>
      </div>
    );
  }

  if (tableError || cafeError || !table || !cafe) {
    return (
      <div className="grid min-h-screen place-items-center bg-cc-background px-6 text-center text-cc-text">
        <div>
          <h1 className="font-display text-2xl font-black text-cc-text tracking-tight">Table not found</h1>
          <p className="mt-2 text-xs font-medium text-cc-text-muted">
            This QR code doesn't match an active table. Please ask a staff member.
          </p>
          <Link to="/" className="mt-6 inline-block rounded-full bg-cc-primary px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-cc-primary-hover transition">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  const mergedTable = { ...table, active_session_id: activeSessionId };
  const effectiveLogoUrl = logoSrc || CHEESE_CORNER_CONFIG.logoUrl;

  return (
    <CartProvider key={activeSessionId || "no-session"} tableId={tableId!}>
      <div className="min-h-screen bg-cc-background text-cc-text selection:bg-cc-accent/30">
        {/* Redesigned Cheese Corner Header */}
        <header className="sticky top-0 z-30 border-b border-cc-border bg-cc-background/95 backdrop-blur-md shadow-xs">
          <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
            <Link
              to={`/t/${tableId}`}
              onClick={(e) => {
                e.preventDefault();
                customerNavigate(`/t/${tableId}`);
              }}
              className="flex items-center gap-2.5 active:opacity-90 transition-opacity"
            >
              <div className="relative h-9 w-9 rounded-full overflow-hidden shrink-0 border border-cc-border bg-cc-surface shadow-xs flex items-center justify-center p-0.5">
                <img
                  src={effectiveLogoUrl}
                  alt={cafe.name}
                  className="h-full w-full object-contain rounded-full"
                />
              </div>
              <span className="font-display text-base font-bold leading-tight text-cc-text tracking-tight">
                {cafe.name}
              </span>
            </Link>

            <div className="flex items-center gap-2">
              {!online && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 border border-amber-500/30">
                  <WifiOff className="h-3 w-3" strokeWidth={2.2} /> Offline
                </span>
              )}
              {/* Branded Table Pill */}
              <div className="inline-flex items-center rounded-full bg-cc-surface px-3 py-1 text-xs font-bold text-cc-text border border-cc-border shadow-xs">
                Table {table.label}
              </div>
              {/* Restyled Info Button */}
              <button
                onClick={() => setIsAboutOpen(true)}
                className="grid h-8 w-8 place-items-center rounded-full bg-cc-surface text-cc-text border border-cc-border hover:bg-cc-surface-soft active:scale-95 transition-all shadow-xs"
                aria-label="About Café"
              >
                <Info className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-md">
          {!isSessionActive && (
            <div className="m-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-center shadow-xs">
              <div className="mx-auto mb-2.5 grid h-10 w-10 place-items-center rounded-full bg-amber-500/20 text-amber-800">
                <AlertCircle className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <h3 className="font-display text-base font-bold text-cc-text">Table Currently Inactive</h3>
              <p className="mt-1 text-xs font-medium text-cc-text-muted leading-relaxed">
                This table is currently inactive. Please ask the staff to activate your table.
              </p>
            </div>
          )}
          <Outlet context={{ cafe, table: mergedTable, guestSessionId, isSessionActive }} />
        </main>

        <BottomNav />

        {isAboutOpen && (
          <Drawer open={isAboutOpen} onOpenChange={setIsAboutOpen}>
            <DrawerContent className="max-w-md mx-auto p-6 flex flex-col focus:outline-none bg-cc-background border-t border-cc-border">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border border-cc-border shadow-sm bg-cc-surface p-1 flex items-center justify-center">
                  <img src={effectiveLogoUrl} alt={cafe.name} className="h-full w-full object-contain rounded-full" />
                </div>
                
                <div>
                  <h2 className="font-display text-xl font-extrabold text-cc-text leading-tight break-words">{cafe.name}</h2>
                  {cafe.tagline && (
                    <p className="mt-1 text-xs font-medium text-cc-text-muted italic leading-relaxed break-words">{cafe.tagline}</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex-1 overflow-y-auto space-y-4 pr-1 py-1">
                {cafe.address && (
                  <div className="flex gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-cc-text-muted shrink-0 mt-0.5" strokeWidth={2.2} />
                    <div>
                      <div className="font-bold text-cc-text text-[10px] uppercase tracking-wider">Address</div>
                      <div className="mt-0.5 text-xs font-medium text-cc-text-muted break-words">{cafe.address}</div>
                    </div>
                  </div>
                )}

                {cafe.phone && (
                  <div className="flex gap-3 text-sm">
                    <Phone className="h-4 w-4 text-cc-text-muted shrink-0 mt-0.5" strokeWidth={2.2} />
                    <div>
                      <div className="font-bold text-cc-text text-[10px] uppercase tracking-wider">Phone</div>
                      <a href={`tel:${cafe.phone}`} className="mt-0.5 block text-xs text-cc-primary hover:underline font-bold break-all">
                        {cafe.phone}
                      </a>
                    </div>
                  </div>
                )}

                {cafe.operating_hours && (
                  <div className="flex gap-3 text-sm">
                    <Clock className="h-4 w-4 text-cc-text-muted shrink-0 mt-0.5" strokeWidth={2.2} />
                    <div>
                      <div className="font-bold text-cc-text text-[10px] uppercase tracking-wider">Operating Hours</div>
                      <div className="mt-0.5 text-xs font-medium text-cc-text-muted whitespace-pre-line break-words">{cafe.operating_hours}</div>
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
                        className="flex items-center gap-1.5 rounded-full bg-cc-surface border border-cc-border hover:bg-cc-surface/80 px-3 py-1.5 text-xs font-semibold text-cc-text transition"
                      >
                        <Globe className="h-3.5 w-3.5" strokeWidth={2.2} /> Website
                      </a>
                    )}
                    {cafe.instagram && (
                      <a
                        href={cafe.instagram}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-full bg-cc-surface border border-cc-border hover:bg-cc-surface/80 px-3 py-1.5 text-xs font-semibold text-cc-text transition"
                      >
                        <Instagram className="h-3.5 w-3.5" strokeWidth={2.2} /> Instagram
                      </a>
                    )}
                    {cafe.whatsapp && (
                      <a
                        href={`https://wa.me/${cafe.whatsapp.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition"
                      >
                        <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.2} /> WhatsApp
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
                      className="w-full rounded-full bg-cc-primary text-white py-3 text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:bg-cc-primary-hover transition"
                    >
                      <Star className="h-4 w-4 fill-amber-300 text-amber-300" strokeWidth={2.2} />
                      Leave a Google Review
                    </a>
                  </div>
                )}
              </div>

              <DrawerFooter className="pt-6 px-0 pb-0">
                <button
                  onClick={() => setIsAboutOpen(false)}
                  className="w-full rounded-full bg-cc-surface border border-cc-border py-3 text-xs font-bold text-cc-text hover:bg-cc-surface/80 transition"
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
