import type { ServiceRequest, ServiceRequestType } from "@/lib/db";

export type ServiceRequestStatus = "open" | "acknowledged" | "resolved" | "dismissed";

export type ServiceRequestWithTable = ServiceRequest & {
  tables: { label: string } | null;
};

export interface CreateServiceRequestPayload {
  cafe_id: string;
  table_id: string;
  browser_session_id?: string | null;
  dining_session_id?: string | null;
  type: ServiceRequestType;
  note?: string | null;
}
