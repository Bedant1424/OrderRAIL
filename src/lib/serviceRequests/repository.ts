import { supabase } from "@/lib/db";
import type { ServiceRequestWithTable, CreateServiceRequestPayload, ServiceRequestStatus } from "./types";

/**
 * Service Request Domain Repository
 * Centralized data access boundary for service requests across Customer, Staff, and Owner interfaces.
 */

export async function fetchActiveServiceRequests(cafeId: string): Promise<ServiceRequestWithTable[]> {
  const { data, error } = await supabase
    .from("service_requests")
    .select("*, tables(label)")
    .eq("cafe_id", cafeId)
    .in("status", ["open", "acknowledged"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ServiceRequestWithTable[];
}

export async function createServiceRequestInDb(payload: CreateServiceRequestPayload): Promise<void> {
  const { error } = await supabase.from("service_requests").insert({
    cafe_id: payload.cafe_id,
    table_id: payload.table_id,
    browser_session_id: payload.browser_session_id ?? null,
    dining_session_id: payload.dining_session_id ?? null,
    type: payload.type,
    note: payload.note ?? null,
  });

  if (error) throw error;
}

export async function updateServiceRequestStatusInDb(
  requestId: string,
  status: ServiceRequestStatus
): Promise<void> {
  const { error } = await supabase
    .from("service_requests")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) throw error;
}

export async function acknowledgeServiceRequestInDb(requestId: string): Promise<void> {
  return updateServiceRequestStatusInDb(requestId, "acknowledged");
}

export async function resolveServiceRequestInDb(requestId: string): Promise<void> {
  return updateServiceRequestStatusInDb(requestId, "resolved");
}

export async function dismissServiceRequestInDb(requestId: string): Promise<void> {
  return updateServiceRequestStatusInDb(requestId, "dismissed");
}
