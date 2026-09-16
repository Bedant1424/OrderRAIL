-- =============================================================================
-- Gate 0D Staging Schema & RPC Deployment
-- Specification: gate_0d_execution_ready_spec.md v2.1.0-EXECUTION-READY
-- Target: Isolated Staging Supabase Project (cheese-corner-staging-phase0)
-- =============================================================================

-- Ensure pgcrypto extension is active for server-side hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Stub: Cafes (Tenants)
CREATE TABLE IF NOT EXISTS public.cafes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Cheese Corner Staging',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Stub: Dining Tables
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cafe_id UUID NOT NULL REFERENCES public.cafes(id),
    table_number TEXT NOT NULL,
    active_session_id TEXT,
    status TEXT NOT NULL DEFAULT 'available',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Stub: Dining Sessions (Dine-In lifecycle)
CREATE TABLE IF NOT EXISTS public.dining_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cafe_id UUID NOT NULL REFERENCES public.cafes(id),
    table_id UUID NOT NULL REFERENCES public.tables(id),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ
);

-- 4. Production Enum: Order Status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE public.order_status AS ENUM (
            'pending', 'preparing', 'ready', 'served', 'cancelled'
        );
    END IF;
END$$;

-- 5. Stub: Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cafe_id UUID NOT NULL REFERENCES public.cafes(id),
    table_id UUID REFERENCES public.tables(id),
    session_id TEXT, -- NULL for Takeaway / Swiggy / Zomato
    order_number SERIAL,
    status public.order_status NOT NULL DEFAULT 'pending',
    order_source TEXT NOT NULL DEFAULT 'DINE_IN'
        CHECK (order_source IN ('DINE_IN', 'TAKEAWAY', 'SWIGGY', 'ZOMATO')),
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_orders_id_cafe UNIQUE (id, cafe_id)
);

-- 6. Stub: Bills
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cafe_id UUID NOT NULL REFERENCES public.cafes(id),
    bill_number TEXT NOT NULL,
    session_id TEXT, -- NULL for Takeaway / Swiggy / Zomato
    grand_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK (payment_status IN ('unpaid', 'paid', 'voided')),
    payment_mode TEXT, -- Set to 'SPLIT', 'CASH', 'UPI', 'CARD', etc. upon settlement
    order_source TEXT NOT NULL DEFAULT 'DINE_IN'
        CHECK (order_source IN ('DINE_IN', 'TAKEAWAY', 'SWIGGY', 'ZOMATO')),
    created_at TIMESTAMPTZ DEFAULT now(),
    settled_at TIMESTAMPTZ,
    CONSTRAINT uq_bills_id_cafe UNIQUE (id, cafe_id)
);

-- 7. Junction Table: bill_orders
CREATE TABLE IF NOT EXISTS public.bill_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL,
    order_id UUID NOT NULL,
    cafe_id UUID NOT NULL,
    association_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (association_status IN ('ACTIVE', 'VOIDED', 'SUPERSEDED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Composite tenant-scoped foreign keys
    CONSTRAINT fk_bill_orders_bill
        FOREIGN KEY (bill_id, cafe_id) REFERENCES public.bills(id, cafe_id) ON DELETE RESTRICT,
    CONSTRAINT fk_bill_orders_order
        FOREIGN KEY (order_id, cafe_id) REFERENCES public.orders(id, cafe_id) ON DELETE RESTRICT,

    -- Prevent identical pairing under the same status
    CONSTRAINT uq_bill_orders_triple
        UNIQUE (bill_id, order_id, association_status)
);

CREATE INDEX IF NOT EXISTS idx_bill_orders_bill ON public.bill_orders(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_orders_order ON public.bill_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_bill_orders_cafe ON public.bill_orders(cafe_id);

-- Partial unique index: strictly prevent an order from being ACTIVE on multiple bills
CREATE UNIQUE INDEX IF NOT EXISTS idx_remote_bill_orders_active_unique
ON public.bill_orders(order_id)
WHERE association_status = 'ACTIVE';

-- 8. Split-Tender Ledger Table: bill_payments
CREATE TABLE IF NOT EXISTS public.bill_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL,
    cafe_id UUID NOT NULL,
    payment_method TEXT NOT NULL
        CHECK (payment_method IN ('CASH', 'UPI', 'CARD', 'SWIGGY', 'ZOMATO', 'OTHER')),
    amount_tendered_paise BIGINT NOT NULL CHECK (amount_tendered_paise >= 0),
    amount_applied_paise BIGINT NOT NULL CHECK (amount_applied_paise > 0),
    change_due_paise BIGINT NOT NULL DEFAULT 0 CHECK (change_due_paise >= 0),
    transaction_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT fk_bill_payments_bill
        FOREIGN KEY (bill_id, cafe_id) REFERENCES public.bills(id, cafe_id) ON DELETE RESTRICT,
    CONSTRAINT chk_tender_math
        CHECK (amount_tendered_paise = amount_applied_paise + change_due_paise),
    CONSTRAINT chk_non_cash_zero_change
        CHECK (payment_method = 'CASH' OR change_due_paise = 0)
);

CREATE INDEX IF NOT EXISTS idx_bill_payments_bill ON public.bill_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_cafe ON public.bill_payments(cafe_id);

-- 9. Authoritative Idempotency Table: bill_settlement_idempotency
CREATE TABLE IF NOT EXISTS public.bill_settlement_idempotency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE,
    bill_id UUID NOT NULL,
    cafe_id UUID NOT NULL,
    request_hash TEXT NOT NULL,
    result_status TEXT NOT NULL
        CHECK (result_status IN ('SUCCESS', 'CONFLICT')),
    created_at TIMESTAMPTZ DEFAULT now(),
    response_payload JSONB NOT NULL,

    CONSTRAINT fk_settlement_idem_bill
        FOREIGN KEY (bill_id, cafe_id) REFERENCES public.bills(id, cafe_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_settlement_idem_bill ON public.bill_settlement_idempotency(bill_id);
CREATE INDEX IF NOT EXISTS idx_settlement_idem_key ON public.bill_settlement_idempotency(idempotency_key);

-- 10. Atomic Settlement Function: settle_bill_and_close_session_atomic
CREATE OR REPLACE FUNCTION public.settle_bill_and_close_session_atomic(
    p_bill_id UUID,
    p_cafe_id UUID,
    p_payments JSONB,
    p_settlement_idempotency_key TEXT,
    p_operator_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
    v_canonical_tenders TEXT;
    v_request_hash TEXT;
    v_existing_idem RECORD;
    v_bill RECORD;
    v_grand_total_paise BIGINT;
    v_order_ids UUID[];
    v_order_count INT;
    v_mismatched_channel_count INT;
    v_mismatched_session_count INT;
    v_elem JSONB;
    v_payment_method TEXT;
    v_tendered BIGINT;
    v_applied BIGINT;
    v_change BIGINT;
    v_tx_ref TEXT;
    v_total_applied_paise BIGINT := 0;
    v_final_payment_mode TEXT;
    v_tender_count INT := 0;
    v_response JSONB;
    v_jwt_role TEXT;
    v_jwt_cafe_id TEXT;
BEGIN
    -- =========================================================================
    -- STEP 0: Security & Authorization Pre-Checks
    -- =========================================================================
    v_jwt_role := current_setting('request.jwt.claim.role', true);
    IF v_jwt_role = 'anon' THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Anonymous callers cannot execute bill settlement';
    END IF;

    IF p_operator_id IS NULL THEN
        RAISE EXCEPTION 'OPERATOR_REQUIRED: Settlement requires an authenticated operator ID';
    END IF;

    v_jwt_cafe_id := current_setting('request.jwt.claim.cafe_id', true);
    IF v_jwt_cafe_id IS NOT NULL AND v_jwt_cafe_id != '' AND v_jwt_cafe_id::text != p_cafe_id::text THEN
        RAISE EXCEPTION 'CROSS_TENANT_FORBIDDEN: Caller is not authorized for cafe %', p_cafe_id;
    END IF;

    -- =========================================================================
    -- STEP 1: Canonicalize Request and Compute Server-Side Hash BEFORE Lookup
    -- =========================================================================
    IF p_payments IS NULL OR jsonb_array_length(p_payments) = 0 THEN
        RAISE EXCEPTION 'EMPTY_PAYMENTS_PAYLOAD: At least one payment tender must be provided';
    END IF;

    IF p_settlement_idempotency_key IS NULL OR trim(p_settlement_idempotency_key) = '' THEN
        RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY: Idempotency key cannot be empty';
    END IF;

    -- Deterministic sorting of tenders by (method, applied, tendered, reference)
    SELECT string_agg(
        (elem->>'method') || ':' ||
        (elem->>'amount_applied_paise') || ':' ||
        (elem->>'amount_tendered_paise') || ':' ||
        (elem->>'change_due_paise') || ':' ||
        COALESCE(elem->>'transaction_reference', ''),
        ';' ORDER BY 
            (elem->>'method') ASC,
            ((elem->>'amount_applied_paise')::BIGINT) ASC,
            ((elem->>'amount_tendered_paise')::BIGINT) ASC,
            COALESCE(elem->>'transaction_reference', '') ASC
    ) INTO v_canonical_tenders
    FROM jsonb_array_elements(p_payments) AS elem;

    v_request_hash := encode(
        digest(p_bill_id::text || '|' || p_cafe_id::text || '|' || v_canonical_tenders, 'sha256'),
        'hex'
    );

    -- =========================================================================
    -- STEP 2: Acquire 64-bit Transaction-Scoped Advisory Lock
    -- =========================================================================
    PERFORM pg_advisory_xact_lock(hashtextextended(p_settlement_idempotency_key, 0));

    -- =========================================================================
    -- STEP 3: Idempotency Key Lookup & Conflict Verification
    -- =========================================================================
    SELECT * INTO v_existing_idem
    FROM public.bill_settlement_idempotency
    WHERE idempotency_key = p_settlement_idempotency_key;

    IF FOUND THEN
        -- Exact match on bill and canonical hash -> return cached response
        IF v_existing_idem.bill_id = p_bill_id AND v_existing_idem.request_hash = v_request_hash THEN
            RETURN jsonb_build_object(
                'status', 'SUCCESS',
                'idempotent_replay', true,
                'response', v_existing_idem.response_payload
            );
        ELSE
            -- Conflict: same key reused for a different bill or altered financial terms
            RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSE_CONFLICT: Key % already used with differing payload or bill',
                p_settlement_idempotency_key;
        END IF;
    END IF;

    -- =========================================================================
    -- STEP 4: Lock Bill Row (Lock Order: Advisory -> Bill -> Orders -> Session -> Table)
    -- =========================================================================
    SELECT * INTO v_bill
    FROM public.bills
    WHERE id = p_bill_id AND cafe_id = p_cafe_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BILL_NOT_FOUND: Bill % does not exist for cafe %', p_bill_id, p_cafe_id;
    END IF;

    IF v_bill.payment_status = 'paid' THEN
        RAISE EXCEPTION 'BILL_ALREADY_SETTLED: Bill % is already settled under a different idempotency key', p_bill_id;
    END IF;

    IF v_bill.payment_status = 'voided' THEN
        RAISE EXCEPTION 'BILL_VOIDED: Cannot settle voided bill %', p_bill_id;
    END IF;

    v_grand_total_paise := ROUND(v_bill.grand_total * 100)::BIGINT;

    -- =========================================================================
    -- STEP 5: Lock & Validate Associated Orders from bill_orders (CORRECTED PATTERN)
    -- =========================================================================
    -- 5a: Row-lock linked orders in deterministic UUID order (no aggregates)
    PERFORM 1
    FROM public.bill_orders bo
    JOIN public.orders o ON o.id = bo.order_id AND o.cafe_id = bo.cafe_id
    WHERE bo.bill_id = p_bill_id
      AND bo.cafe_id = p_cafe_id
      AND bo.association_status = 'ACTIVE'
    ORDER BY o.id ASC
    FOR UPDATE OF o;

    -- 5b: Aggregate the locked order IDs into array
    SELECT array_agg(bo.order_id ORDER BY bo.order_id ASC) INTO v_order_ids
    FROM public.bill_orders bo
    WHERE bo.bill_id = p_bill_id
      AND bo.cafe_id = p_cafe_id
      AND bo.association_status = 'ACTIVE';

    v_order_count := COALESCE(array_length(v_order_ids, 1), 0);
    IF v_order_count = 0 THEN
        RAISE EXCEPTION 'NO_ACTIVE_ORDERS: Bill % has no active order associations', p_bill_id;
    END IF;

    -- =========================================================================
    -- STEP 6: Validate Channel Cardinality & Session Isolation
    -- =========================================================================
    IF v_bill.order_source = 'DINE_IN' THEN
        IF v_bill.session_id IS NULL THEN
            RAISE EXCEPTION 'CHANNEL_VIOLATION: Dine-In bill % must have a non-null session_id', p_bill_id;
        END IF;

        -- Verify all active orders match bill session and channel
        SELECT COUNT(*) INTO v_mismatched_session_count
        FROM public.orders o
        WHERE o.id = ANY(v_order_ids)
          AND (o.session_id IS DISTINCT FROM v_bill.session_id OR o.order_source != 'DINE_IN');

        IF v_mismatched_session_count > 0 THEN
            RAISE EXCEPTION 'CHANNEL_VIOLATION: Dine-In bill contains orders from differing sessions or channels';
        END IF;

    ELSIF v_bill.order_source IN ('TAKEAWAY', 'SWIGGY', 'ZOMATO') THEN
        IF v_bill.session_id IS NOT NULL THEN
            RAISE EXCEPTION 'CHANNEL_VIOLATION: % bill % must not have a session_id', v_bill.order_source, p_bill_id;
        END IF;

        IF v_order_count != 1 THEN
            RAISE EXCEPTION 'CHANNEL_VIOLATION: % bill % must link exactly 1 order, found %',
                v_bill.order_source, p_bill_id, v_order_count;
        END IF;

        -- Verify the single order matches the channel and has no session/table
        SELECT COUNT(*) INTO v_mismatched_channel_count
        FROM public.orders o
        WHERE o.id = v_order_ids[1]
          AND (o.order_source != v_bill.order_source OR o.session_id IS NOT NULL OR o.table_id IS NOT NULL);

        IF v_mismatched_channel_count > 0 THEN
            RAISE EXCEPTION 'CHANNEL_VIOLATION: Order channel or session attributes do not match bill %', p_bill_id;
        END IF;
    ELSE
        RAISE EXCEPTION 'UNKNOWN_ORDER_SOURCE: Unrecognized channel %', v_bill.order_source;
    END IF;

    -- =========================================================================
    -- STEP 7: Validate Split Tenders & Ledger Balance
    -- =========================================================================
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
        v_tender_count := v_tender_count + 1;
        v_payment_method := v_elem->>'method';
        v_tendered := (v_elem->>'amount_tendered_paise')::BIGINT;
        v_applied := (v_elem->>'amount_applied_paise')::BIGINT;
        v_change := (v_elem->>'change_due_paise')::BIGINT;
        v_tx_ref := v_elem->>'transaction_reference';

        IF v_applied <= 0 THEN
            RAISE EXCEPTION 'INVALID_TENDER: Applied amount must be greater than zero';
        END IF;

        IF v_tendered < v_applied THEN
            RAISE EXCEPTION 'INVALID_TENDER: Tendered amount (%) cannot be less than applied (%)',
                v_tendered, v_applied;
        END IF;

        IF v_tendered != (v_applied + v_change) THEN
            RAISE EXCEPTION 'INVALID_TENDER_MATH: Tendered (%) != applied (%) + change (%)',
                v_tendered, v_applied, v_change;
        END IF;

        IF v_payment_method != 'CASH' AND v_change != 0 THEN
            RAISE EXCEPTION 'NON_CASH_CHANGE_PROHIBITED: % tender cannot provide change due', v_payment_method;
        END IF;

        v_total_applied_paise := v_total_applied_paise + v_applied;

        -- Record into payment ledger
        INSERT INTO public.bill_payments (
            bill_id, cafe_id, payment_method,
            amount_tendered_paise, amount_applied_paise, change_due_paise,
            transaction_reference
        ) VALUES (
            p_bill_id, p_cafe_id, v_payment_method,
            v_tendered, v_applied, v_change,
            v_tx_ref
        );
    END LOOP;

    -- Validate total applied exactly balances grand total
    IF v_total_applied_paise != v_grand_total_paise THEN
        RAISE EXCEPTION 'AMOUNT_MISMATCH: Applied total (% paise) does not equal bill grand total (% paise)',
            v_total_applied_paise, v_grand_total_paise;
    END IF;

    -- Summarize high-level payment mode
    IF v_tender_count = 1 THEN
        v_final_payment_mode := (p_payments->0->>'method');
    ELSE
        v_final_payment_mode := 'SPLIT';
    END IF;

    -- =========================================================================
    -- STEP 8: Transition Bill Status to PAID
    -- =========================================================================
    UPDATE public.bills
    SET payment_status = 'paid',
        payment_mode = v_final_payment_mode,
        settled_at = now()
    WHERE id = p_bill_id AND cafe_id = p_cafe_id;

    -- =========================================================================
    -- STEP 9: Transition Orders Status to served
    -- =========================================================================
    UPDATE public.orders
    SET status = 'served'
    WHERE id = ANY(v_order_ids)
      AND cafe_id = p_cafe_id
      AND status != 'cancelled';

    -- =========================================================================
    -- STEP 10: Dine-In Table & Session Lifecycle Teardown
    -- =========================================================================
    IF v_bill.order_source = 'DINE_IN' AND v_bill.session_id IS NOT NULL THEN
        UPDATE public.dining_sessions
        SET status = 'closed',
            closed_at = now()
        WHERE id::text = v_bill.session_id
          AND cafe_id = p_cafe_id
          AND status = 'active';

        UPDATE public.tables
        SET active_session_id = NULL,
            status = 'available'
        WHERE active_session_id = v_bill.session_id
          AND cafe_id = p_cafe_id;
    END IF;

    -- =========================================================================
    -- STEP 11: Persist Authoritative Idempotency Record
    -- =========================================================================
    v_response := jsonb_build_object(
        'bill_id', p_bill_id,
        'cafe_id', p_cafe_id,
        'payment_mode', v_final_payment_mode,
        'amount_applied_paise', v_total_applied_paise,
        'order_ids', v_order_ids,
        'operator_id', p_operator_id,
        'settled_at', now()
    );

    INSERT INTO public.bill_settlement_idempotency (
        idempotency_key, bill_id, cafe_id,
        request_hash, result_status, response_payload
    ) VALUES (
        p_settlement_idempotency_key, p_bill_id, p_cafe_id,
        v_request_hash, 'SUCCESS', v_response
    );

    -- =========================================================================
    -- STEP 12: Return Standardized Success Payload
    -- =========================================================================
    RETURN jsonb_build_object(
        'status', 'SUCCESS',
        'idempotent_replay', false,
        'response', v_response
    );
END;
$$;

-- 11. Security Privileges Configuration
REVOKE ALL ON FUNCTION public.settle_bill_and_close_session_atomic(UUID, UUID, JSONB, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_bill_and_close_session_atomic(UUID, UUID, JSONB, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.settle_bill_and_close_session_atomic(UUID, UUID, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_bill_and_close_session_atomic(UUID, UUID, JSONB, TEXT, UUID) TO service_role;
