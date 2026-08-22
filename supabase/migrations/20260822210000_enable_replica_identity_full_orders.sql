-- ============================================================================
-- Migration: 20260822210000_enable_replica_identity_full_orders.sql
-- Description: Enable REPLICA IDENTITY FULL on public.orders for Realtime filtering
-- Milestone: 5A.3 - Fix Confirmed P0 Realtime Order Exposure
--
-- Enables reliable Supabase Realtime postgres_changes column filtering on
-- dining_session_id for UPDATE events, preventing cross-tenant order broadcasting.
-- ============================================================================

ALTER TABLE public.orders REPLICA IDENTITY FULL;
