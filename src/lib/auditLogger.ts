import { supabase } from "@/integrations/supabase/client";

export type AuditEventType =
  | "INVITATION_CREATED"
  | "INVITATION_REVOKED"
  | "INVITATION_ACCEPTED"
  | "ROLE_CHANGED"
  | "STAFF_SUSPENDED"
  | "STAFF_REACTIVATED"
  | "STAFF_REMOVED";

export async function logAuditEvent({
  cafeId,
  actorId,
  eventType,
  targetEmail,
  metadata,
}: {
  cafeId: string | null;
  actorId?: string | null;
  eventType: AuditEventType;
  targetEmail?: string | null;
  metadata?: Record<string, any>;
}) {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      cafe_id: cafeId,
      actor_id: actorId ?? null,
      event_type: eventType,
      target_email: targetEmail ?? null,
      metadata: metadata ?? null,
    });
    if (error) {
      console.warn("logAuditEvent failed:", error.message);
    }
  } catch (err) {
    console.warn("logAuditEvent error:", err);
  }
}
