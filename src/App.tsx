import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth";
import { CafeProvider } from "./lib/cafe";
import { initOfflineSync } from "./lib/orderQueue";
import ScrollToTop from "./components/ScrollToTop";
import RouteLoadingFallback from "./components/RouteLoadingFallback";
import { ProtectedCounterRoute } from "./components/auth/ProtectedCounterRoute";

// Lazy-loaded routes & layouts
const Index = lazy(() => import("./pages/Index.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Customer App (Public QR Routes)
const TableLayout = lazy(() => import("./layouts/TableLayout"));
const TableMenuPage = lazy(() => import("./pages/table/TableMenuPage"));
const TableCartPage = lazy(() => import("./pages/table/TableCartPage"));
const TableCallPage = lazy(() => import("./pages/table/TableCallPage"));
const TableOrderPage = lazy(() => import("./pages/table/TableOrderPage"));

// Production OrderRail Counter Page (Protected Workstation)
const CounterPage = lazy(() => import("./pages/counter/CounterPage"));
const BillHistoryPage = lazy(() => import("./pages/counter/BillHistoryPage"));

// Living Design System Showcase
const DesignSystemShowcasePage = lazy(() => import("./pages/design-system/DesignSystemShowcasePage"));

// Staff Dashboard (Protected Portal)
const StaffLayout = lazy(() => import("./layouts/StaffLayout"));
const StaffLoginPage = lazy(() => import("./pages/staff/StaffLoginPage"));
const StaffDashboardPage = lazy(() => import("./pages/staff/StaffDashboardPage"));

// Owner Dashboard (Protected Management)
const OwnerLayout = lazy(() => import("./layouts/OwnerLayout"));
const OwnerAnalyticsPage = lazy(() => import("./pages/owner/OwnerAnalyticsPage"));
const OwnerOrdersPage = lazy(() => import("./pages/owner/OwnerOrdersPage"));
const OwnerMenuPage = lazy(() => import("./pages/owner/OwnerMenuPage"));
const OwnerTablesPage = lazy(() => import("./pages/owner/OwnerTablesPage"));
const OwnerStaffPage = lazy(() => import("./pages/owner/OwnerStaffPage"));
const OwnerReviewsPage = lazy(() => import("./pages/owner/OwnerReviewsPage"));
const OwnerSettingsPage = lazy(() => import("./pages/owner/OwnerSettingsPage"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const App = () => {
  useEffect(() => {
    initOfflineSync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <CafeProvider>
              <ScrollToTop />
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                  {/* Public Landing & Living Design System */}
                  <Route path="/" element={<Index />} />
                  <Route path="/design-system" element={<DesignSystemShowcasePage />} />

                  {/* Public Customer Dining QR App Routes */}
                  <Route path="/t/:tableId" element={<TableLayout />}>
                    <Route index element={<TableMenuPage />} />
                    <Route path="cart" element={<TableCartPage />} />
                    <Route path="call" element={<TableCallPage />} />
                    <Route path="order/:orderId" element={<TableOrderPage />} />
                  </Route>

                  {/* Staff Authentication */}
                  <Route path="/staff/login" element={<StaffLoginPage />} />

                  {/* Protected Workstation Counter Route */}
                  <Route 
                    path="/counter" 
                    element={
                      <ProtectedCounterRoute>
                        <CounterPage />
                      </ProtectedCounterRoute>
                    } 
                  />
                  <Route 
                    path="/counter/bills" 
                    element={
                      <ProtectedCounterRoute>
                        <BillHistoryPage />
                      </ProtectedCounterRoute>
                    } 
                  />

                  {/* Obsolete experimental redirects */}
                  <Route path="/counter/v2" element={<Navigate to="/counter" replace />} />
                  <Route path="/counter/v3" element={<Navigate to="/counter" replace />} />
                  <Route path="/counter/v5-a" element={<Navigate to="/counter" replace />} />
                  <Route path="/counter/v5-b" element={<Navigate to="/counter" replace />} />
                  <Route path="/counter/v6" element={<Navigate to="/counter" replace />} />
                  <Route path="/counter/v7" element={<Navigate to="/counter" replace />} />
                  <Route path="/counter/v8" element={<Navigate to="/counter" replace />} />
                  <Route path="/staff/v2" element={<Navigate to="/counter" replace />} />
                  <Route path="/staff/v3" element={<Navigate to="/counter" replace />} />
                  <Route path="/staff/v5-a" element={<Navigate to="/counter" replace />} />
                  <Route path="/staff/v5-b" element={<Navigate to="/counter" replace />} />
                  <Route path="/staff/v6" element={<Navigate to="/counter" replace />} />
                  <Route path="/staff/v7" element={<Navigate to="/counter" replace />} />
                  <Route path="/staff/v8" element={<Navigate to="/counter" replace />} />

                  {/* Protected Staff Dashboard */}
                  <Route path="/staff" element={<StaffLayout />}>
                    <Route index element={<StaffDashboardPage />} />
                  </Route>

                  {/* Protected Owner Dashboard */}
                  <Route path="/owner" element={<OwnerLayout />}>
                    <Route index element={<OwnerAnalyticsPage />} />
                    <Route path="orders" element={<OwnerOrdersPage />} />
                    <Route path="menu" element={<OwnerMenuPage />} />
                    <Route path="tables" element={<OwnerTablesPage />} />
                    <Route path="staff" element={<OwnerStaffPage />} />
                    <Route path="reviews" element={<OwnerReviewsPage />} />
                    <Route path="bills" element={<BillHistoryPage />} />
                    <Route path="settings" element={<OwnerSettingsPage />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <Sonner position="top-center" duration={3500} expand={false} visibleToasts={3} closeButton={true} />
              <Toaster />
              <SpeedInsights />
            </CafeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
