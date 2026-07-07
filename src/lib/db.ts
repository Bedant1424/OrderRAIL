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
export type ServiceRequestType = Database["public"]["Enums"]["service_request_type"];
export type VegType = Database["public"]["Enums"]["veg_type"];

export { supabase };

export const formatMoney = (cents: number, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
