import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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

// Lazy-loaded routes & layouts
const Index = lazy(() => import("./pages/Index.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Customer App
const TableLayout = lazy(() => import("./layouts/TableLayout"));
const TableMenuPage = lazy(() => import("./pages/table/TableMenuPage"));
const TableCartPage = lazy(() => import("./pages/table/TableCartPage"));
const TableCallPage = lazy(() => import("./pages/table/TableCallPage"));
const TableOrderPage = lazy(() => import("./pages/table/TableOrderPage"));

// Staff Dashboard
const StaffLayout = lazy(() => import("./layouts/StaffLayout"));
const StaffLoginPage = lazy(() => import("./pages/staff/StaffLoginPage"));
const StaffDashboardPage = lazy(() => import("./pages/staff/StaffDashboardPage"));

// Owner Dashboard
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

  console.log("App start");
  try {
    console.log("Before QueryClientProvider");
    return (
      <QueryClientProvider client={queryClient}>
        {(() => {
          console.log("Inside QueryClientProvider, Before TooltipProvider");
          return (
            <TooltipProvider>
              {(() => {
                console.log("Inside TooltipProvider, Before BrowserRouter");
                return (
                  <BrowserRouter>
                    {(() => {
                      console.log("Inside BrowserRouter, Before AuthProvider");
                      return (
                        <AuthProvider>
                          {(() => {
                            console.log("Inside AuthProvider, Before CafeProvider");
                            return (
                              <CafeProvider>
                                {(() => {
                                  console.log("Inside CafeProvider, Before Routes");
                                  return (
                                    <>
                                      <ScrollToTop />
                                      <Suspense fallback={<RouteLoadingFallback />}>
                                        <Routes>
                                          <Route path="/" element={<Index />} />
                                          <Route path="/t/:tableId" element={<TableLayout />}>
                                            <Route index element={<TableMenuPage />} />
                                            <Route path="cart" element={<TableCartPage />} />
                                            <Route path="call" element={<TableCallPage />} />
                                            <Route path="order/:orderId" element={<TableOrderPage />} />
                                          </Route>
                                          <Route path="/staff/login" element={<StaffLoginPage />} />
                                          <Route path="/staff" element={<StaffLayout />}>
                                            <Route index element={<StaffDashboardPage />} />
                                          </Route>
                                          <Route path="/owner" element={<OwnerLayout />}>
                                            <Route index element={<OwnerAnalyticsPage />} />
                                            <Route path="orders" element={<OwnerOrdersPage />} />
                                            <Route path="menu" element={<OwnerMenuPage />} />
                                            <Route path="tables" element={<OwnerTablesPage />} />
                                            <Route path="staff" element={<OwnerStaffPage />} />
                                            <Route path="reviews" element={<OwnerReviewsPage />} />
                                            <Route path="settings" element={<OwnerSettingsPage />} />
                                          </Route>
                                          <Route path="*" element={<NotFound />} />
                                        </Routes>
                                      </Suspense>
                                      <Sonner position="top-center" duration={3500} expand={false} visibleToasts={3} closeButton={true} />
                                      <Toaster />
                                      <SpeedInsights />
                                    </>
                                  );
                                })()}
                              </CafeProvider>
                            );
                          })()}
                        </AuthProvider>
                      );
                    })()}
                  </BrowserRouter>
                );
              })()}
            </TooltipProvider>
          );
        })()}
      </QueryClientProvider>
    );
  } catch (err) {
    console.error("App render failed:", err);
    throw err;
  }
};

export default App;
