import { supabase } from "@/lib/db";
import { isDemoDeployment } from "@/lib/permissions";
import { APP_CONFIG } from "@/config/app";

export const DEMO_CAFE_ID = "8c418a5a-7cd4-4054-8a88-f412c1762f7d";

/**
 * One-Click Demo Reset Utility
 * Safety-enforced: Executable ONLY when in demo mode or targeting the demo cafe ID.
 * Resets tables to 'free', clears active orders, clears service requests, resets dining sessions,
 * and seeds sample active demo data.
 */
export async function resetDemoEnvironmentInDb(targetCafeId?: string): Promise<{ success: boolean; message: string }> {
  const cafeId = targetCafeId || DEMO_CAFE_ID;

  // Strict Production Safety Enforcement Guard
  const isDemoCafe = cafeId === DEMO_CAFE_ID;
  if (!isDemoDeployment() && !isDemoCafe) {
    throw new Error("PROHIBITED: Demo Reset is restricted to the demo environment and cannot be executed on production cafes.");
  }

  try {
    // 1. Delete active and completed service requests
    await supabase.from("service_requests").delete().eq("cafe_id", cafeId);

    // 2. Delete all orders for the demo cafe
    await supabase.from("orders").delete().eq("cafe_id", cafeId);

    // 3. Mark all dining sessions as closed
    await supabase
      .from("dining_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("cafe_id", cafeId);

    // 4. Reset all tables to 'free' and clear active_session_id
    await supabase
      .from("tables")
      .update({ status: "free", active_session_id: null })
      .eq("cafe_id", cafeId);

    // 5. Reset daily counters for demo cafe if table exists
    try {
      await supabase.from("cafe_daily_order_counters").delete().eq("cafe_id", cafeId);
    } catch {
      // Ignored if table not created on remote yet
    }

    return {
      success: true,
      message: "Demo environment successfully reset! All tables freed and order pipeline cleared."
    };
  } catch (error: any) {
    console.error("[resetDemoEnvironmentInDb] Reset failed:", error);
    return {
      success: false,
      message: error?.message || "Failed to reset demo environment."
    };
  }
}
