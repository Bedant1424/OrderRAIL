import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import TableLayout from "./layouts/TableLayout";
import TableMenuPage from "./pages/table/TableMenuPage";
import TableCartPage from "./pages/table/TableCartPage";
import TableCallPage from "./pages/table/TableCallPage";
import TableOrderPage from "./pages/table/TableOrderPage";
import StaffLayout from "./layouts/StaffLayout";
import StaffLoginPage from "./pages/staff/StaffLoginPage";
import StaffDashboardPage from "./pages/staff/StaffDashboardPage";
import OwnerLayout from "./layouts/OwnerLayout";
import OwnerAnalyticsPage from "./pages/owner/OwnerAnalyticsPage";
import OwnerOrdersPage from "./pages/owner/OwnerOrdersPage";
import OwnerMenuPage from "./pages/owner/OwnerMenuPage";
import OwnerTablesPage from "./pages/owner/OwnerTablesPage";
import OwnerStaffPage from "./pages/owner/OwnerStaffPage";
import OwnerReviewsPage from "./pages/owner/OwnerReviewsPage";
import OwnerSettingsPage from "./pages/owner/OwnerSettingsPage";
import { AuthProvider } from "./lib/auth";
import { CafeProvider } from "./lib/cafe";
import { initOfflineSync } from "./lib/orderQueue";
import ScrollToTop from "./components/ScrollToTop";


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
