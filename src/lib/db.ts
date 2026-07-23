import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Cafe = Database["public"]["Tables"]["cafes"]["Row"];
export type TableRow = Database["public"]["Tables"]["tables"]["Row"];
export type MenuCategory = Database["public"]["Tables"]["menu_categories"]["Row"];
export type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type ServiceRequest = Database["public"]["Tables"]["service_requests"]["Row"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type OrderItemStatus = Database["public"]["Enums"]["order_item_status"];
export type PrepStation = Database["public"]["Enums"]["prep_station"];
export type ServiceRequestType = Database["public"]["Enums"]["service_request_type"];
export type VegType = Database["public"]["Enums"]["veg_type"];

export { supabase };

/** Central Currency Formatter for INR (Indian Rupees) */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/** Format money from cents using INR as default currency */
export const formatMoney = (cents: number, currency = "INR"): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
};

/** Standard display label for an order: "Order #27". Never expose raw UUIDs. */
export const formatOrderLabel = (orderNumber: number): string =>
  `Order #${orderNumber}`;
