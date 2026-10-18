set check_function_bodies = off;

-- ==============================================================================
-- DukaanAI - Phase 3 Migration
-- 1. Idempotency on transactions (shop_id, idempotency_key)
-- 2. DB-backed rate limiting (rate_limit_hits table + RPC)
-- 3. process_ledger_entry procedure (SECURITY INVOKER, is_shop_owner check)
-- ==============================================================================

-- 1. Add idempotency_key to transactions and unique constraint per shop
alter table public.transactions
    add column if not exists idempotency_key uuid;

create unique index if not exists idx_transactions_shop_idempotency
    on public.transactions (shop_id, idempotency_key)
    where idempotency_key is not null;

-- 2. Table: rate_limit_hits for DB-backed rate limiting
create table if not exists public.rate_limit_hits (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    ip text not null,
    action text not null default 'parse',
    created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_user on public.rate_limit_hits(user_id, created_at desc);
create index if not exists idx_rate_limit_ip on public.rate_limit_hits(ip, created_at desc);
create index if not exists idx_rate_limit_action_date on public.rate_limit_hits(action, created_at desc);

-- RLS: enabled with NO client access policies (accessible only via security definer RPC or server admin)
alter table public.rate_limit_hits enable row level security;

-- 3. Procedure: record_and_check_rate_limit
-- Runs as security definer to record hit and check rate limits
create or replace function public.record_and_check_rate_limit(
    p_user_id uuid,
    p_ip text,
    p_daily_cap int default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_hit_id uuid;
    v_user_count int;
    v_ip_count int;
    v_daily_count int;
    v_start_of_day timestamptz;
begin
    -- Security verification: caller must match p_user_id
    if auth.uid() is distinct from p_user_id then
        raise exception 'Unauthorized rate limit check';
    end if;

    -- Known residual risk: a signed-in user can call this RPC directly,
    -- so the daily cap can be inflated up to the per-user limit (20 calls/min).
    -- We deliberately avoid adding the service role key to any API route
    -- to preserve strict client-server credential isolation.

    -- Record hit initially with 'parse' BEFORE calling Gemini
    insert into public.rate_limit_hits (user_id, ip, action)
    values (p_user_id, p_ip, 'parse')
    returning id into v_hit_id;

    -- 1. Check per-user rate limit (20 / min - demo account is shared by all judges)
    select count(*) into v_user_count
    from public.rate_limit_hits
    where user_id = p_user_id
      and created_at >= now() - interval '1 minute';

    if v_user_count > 20 then
        -- Record as 'parse_blocked' so blocked attempts do NOT count toward global daily cap
        update public.rate_limit_hits
        set action = 'parse_blocked'
        where id = v_hit_id;

        return jsonb_build_object(
            'allowed', false,
            'code', 'RATE_LIMIT_USER',
            'error', 'Too many requests for this account (limit: 20/min). Please wait a moment.'
        );
    end if;

    -- 2. Check per-IP rate limit (15 / min)
    select count(*) into v_ip_count
    from public.rate_limit_hits
    where ip = p_ip
      and created_at >= now() - interval '1 minute';

    if v_ip_count > 15 then
        -- Record as 'parse_blocked' so blocked attempts do NOT count toward global daily cap
        update public.rate_limit_hits
        set action = 'parse_blocked'
        where id = v_hit_id;

        return jsonb_build_object(
            'allowed', false,
            'code', 'RATE_LIMIT_IP',
            'error', 'Too many requests from this IP address (limit: 15/min). Please wait a moment.'
        );
    end if;

    -- 3. Check global daily cap for current UTC day (counts ONLY allowed 'parse' rows)
    v_start_of_day := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
    select count(*) into v_daily_count
    from public.rate_limit_hits
    where action = 'parse'
      and created_at >= v_start_of_day;

    if v_daily_count > p_daily_cap then
        -- Record as 'parse_blocked' so blocked attempts do NOT count toward global daily cap
        update public.rate_limit_hits
        set action = 'parse_blocked'
        where id = v_hit_id;

        return jsonb_build_object(
            'allowed', false,
            'code', 'DAILY_LIMIT_EXCEEDED',
            'error', 'demo limit reached, try again tomorrow',
            'count', v_daily_count,
            'cap', p_daily_cap
        );
    end if;

    return jsonb_build_object(
        'allowed', true,
        'count', v_daily_count,
        'cap', p_daily_cap
    );
end;
$$;

revoke all on function public.record_and_check_rate_limit(uuid, text, int) from public, anon;
grant execute on function public.record_and_check_rate_limit(uuid, text, int) to authenticated, service_role;

-- 4. Procedure: process_ledger_entry
-- SECURITY INVOKER (never DEFINER)
-- Strict ownership check: is_shop_owner(p_shop_id)
-- Strict idempotency: returns existing transaction on duplicate
create or replace function public.process_ledger_entry(
    p_shop_id uuid,
    p_action jsonb,
    p_idempotency_key uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_existing_tx record;
    v_action_type text;
    v_customer_id uuid;
    v_customer_name text;
    v_customer_phone text;
    v_total numeric(10,2);
    v_paid numeric(10,2);
    v_amount numeric(10,2);
    v_current_udhar numeric(10,2) := 0;
    v_raw_input text;
    v_tx_id uuid;
    v_new_balance numeric(10,2) := 0;
    v_item jsonb;
    v_prod_id uuid;
    v_prod_name text;
    v_prod_stock numeric(10,2);
    v_item_qty numeric(10,2);
    v_item_price numeric(10,2);
    v_qty_change numeric(10,2);
    v_unmatched_items jsonb := '[]'::jsonb;
begin
    -- Security verification: caller MUST own the shop
    if not public.is_shop_owner(p_shop_id) then
        raise exception 'Access denied: caller is not the owner of shop %', p_shop_id;
    end if;

    -- Idempotency check: if transaction with this idempotency key exists, return original result
    if p_idempotency_key is not null then
        select id, customer_id, total_amount, paid_amount, created_at
        into v_existing_tx
        from public.transactions
        where shop_id = p_shop_id
          and idempotency_key = p_idempotency_key
        limit 1;

        if v_existing_tx.id is not null then
            if v_existing_tx.customer_id is not null then
                select coalesce(balance, 0) into v_new_balance
                from public.customer_balances
                where customer_id = v_existing_tx.customer_id;
            end if;

            return jsonb_build_object(
                'success', true,
                'idempotent', true,
                'transaction_id', v_existing_tx.id,
                'customer_id', v_existing_tx.customer_id,
                'customer_balance', v_new_balance,
                'message', 'Transaction already processed'
            );
        end if;
    end if;

    v_action_type := p_action->>'action';
    v_raw_input := p_action->>'raw_input';

    -- -------------------------------------------------------------------------
    -- 1. ADD SALE
    -- -------------------------------------------------------------------------
    if v_action_type = 'add_sale' then
        v_total := coalesce((p_action->>'total')::numeric, 0);
        v_paid := coalesce((p_action->>'paid')::numeric, 0);

        -- Validation: paid <= total
        if v_paid > v_total then
            raise exception 'Paid amount (₹%) cannot exceed total sale amount (₹%)', v_paid, v_total;
        end if;

        if v_total < 0 or v_paid < 0 then
            raise exception 'Sale amounts cannot be negative';
        end if;

        -- Resolve customer if provided
        v_customer_name := trim(coalesce(p_action->>'customer', ''));
        if p_action->>'customer_id' is not null and p_action->>'customer_id' <> '' then
            v_customer_id := (p_action->>'customer_id')::uuid;
        elsif v_customer_name <> '' then
            select id into v_customer_id
            from public.customers
            where shop_id = p_shop_id
              and lower(name) = lower(v_customer_name)
            limit 1;

            if v_customer_id is null and (p_action->>'create_customer')::boolean is true then
                insert into public.customers (shop_id, name, phone, notes)
                values (p_shop_id, v_customer_name, p_action->>'customer_phone', 'Added via voice/sale')
                returning id into v_customer_id;
            end if;
        end if;

        -- Insert transaction record with idempotency key
        insert into public.transactions (
            shop_id,
            customer_id,
            type,
            total_amount,
            paid_amount,
            raw_input,
            idempotency_key
        ) values (
            p_shop_id,
            v_customer_id,
            'sale',
            v_total,
            v_paid,
            v_raw_input,
            p_idempotency_key
        ) returning id into v_tx_id;

        -- Process items if any:
        -- Match to products where possible.
        -- NEVER auto-create products! Unmatched items create NO stock change.
        if p_action ? 'items' and jsonb_array_length(p_action->'items') > 0 then
            for v_item in select * from jsonb_array_elements(p_action->'items')
            loop
                v_prod_name := trim(coalesce(v_item->>'product', ''));
                v_item_qty := coalesce((v_item->>'qty')::numeric, 1);
                v_item_price := coalesce((v_item->>'unit_price')::numeric, 0);
                v_prod_id := null;

                if v_item ? 'product_id' and v_item->>'product_id' <> '' then
                    select id, stock_qty into v_prod_id, v_prod_stock
                    from public.products
                    where id = (v_item->>'product_id')::uuid
                      and shop_id = p_shop_id;
                elsif v_prod_name <> '' then
                    select id, stock_qty into v_prod_id, v_prod_stock
                    from public.products
                    where shop_id = p_shop_id
                      and lower(name) = lower(v_prod_name)
                    limit 1;
                end if;

                if v_prod_id is not null then
                    -- Matched product: validate stock
                    if (v_prod_stock - v_item_qty) < 0 then
                        raise exception 'Insufficient stock for product "%". Available: %, requested: %',
                            v_prod_name, v_prod_stock, v_item_qty;
                    end if;

                    update public.products
                    set stock_qty = stock_qty - v_item_qty
                    where id = v_prod_id;

                    insert into public.transaction_items (
                        transaction_id,
                        product_id,
                        qty,
                        unit_price
                    ) values (
                        v_tx_id,
                        v_prod_id,
                        v_item_qty,
                        v_item_price
                    );
                else
                    -- Unmatched item: flagged without stock change
                    v_unmatched_items := v_unmatched_items || jsonb_build_object(
                        'product', v_prod_name,
                        'qty', v_item_qty
                    );
                end if;
            end loop;
        end if;

    -- -------------------------------------------------------------------------
    -- 2. RECORD PAYMENT
    -- -------------------------------------------------------------------------
    elsif v_action_type = 'record_payment' then
        v_amount := coalesce((p_action->>'amount')::numeric, 0);
        if v_amount <= 0 then
            raise exception 'Payment amount must be greater than zero. Received: ₹%', v_amount;
        end if;

        v_customer_name := trim(coalesce(p_action->>'customer', ''));
        if p_action->>'customer_id' is not null and p_action->>'customer_id' <> '' then
            v_customer_id := (p_action->>'customer_id')::uuid;
        elsif v_customer_name <> '' then
            select id into v_customer_id
            from public.customers
            where shop_id = p_shop_id
              and lower(name) = lower(v_customer_name)
            limit 1;
        end if;

        if v_customer_id is null then
            raise exception 'Customer "%" not found in shop records.', v_customer_name;
        end if;

        -- Fetch current customer udhar balance
        select coalesce(balance, 0) into v_current_udhar
        from public.customer_balances
        where customer_id = v_customer_id;

        -- REJECT payment if greater than current udhar
        if v_amount > v_current_udhar then
            raise exception 'Payment amount (₹%) cannot exceed customer''s current udhar balance of ₹%',
                v_amount, v_current_udhar;
        end if;

        insert into public.transactions (
            shop_id,
            customer_id,
            type,
            total_amount,
            paid_amount,
            raw_input,
            idempotency_key
        ) values (
            p_shop_id,
            v_customer_id,
            'payment',
            0,
            v_amount,
            v_raw_input,
            p_idempotency_key
        ) returning id into v_tx_id;

    -- -------------------------------------------------------------------------
    -- 3. ADJUST STOCK
    -- -------------------------------------------------------------------------
    elsif v_action_type = 'adjust_stock' then
        v_prod_name := trim(coalesce(p_action->>'product', ''));
        v_qty_change := coalesce((p_action->>'qty_change')::numeric, 0);

        if p_action->>'product_id' is not null and p_action->>'product_id' <> '' then
            select id, stock_qty into v_prod_id, v_prod_stock
            from public.products
            where id = (p_action->>'product_id')::uuid
              and shop_id = p_shop_id;
        else
            select id, stock_qty into v_prod_id, v_prod_stock
            from public.products
            where shop_id = p_shop_id
              and lower(name) = lower(v_prod_name)
            limit 1;
        end if;

        -- NEVER auto-create products!
        if v_prod_id is null then
            raise exception 'Product "%" does not exist in inventory.', v_prod_name;
        end if;

        if (v_prod_stock + v_qty_change) < 0 then
            raise exception 'Stock cannot be negative. Product "%" currently has %, cannot reduce by %',
                v_prod_name, v_prod_stock, abs(v_qty_change);
        end if;

        update public.products
        set stock_qty = stock_qty + v_qty_change
        where id = v_prod_id
        returning stock_qty into v_prod_stock;

    -- -------------------------------------------------------------------------
    -- 4. ADD CUSTOMER
    -- -------------------------------------------------------------------------
    elsif v_action_type = 'add_customer' then
        v_customer_name := trim(coalesce(p_action->>'name', ''));
        v_customer_phone := p_action->>'phone';

        if v_customer_name = '' then
            raise exception 'Customer name cannot be empty';
        end if;

        select id into v_customer_id
        from public.customers
        where shop_id = p_shop_id
          and lower(name) = lower(v_customer_name)
        limit 1;

        if v_customer_id is null then
            insert into public.customers (shop_id, name, phone, notes)
            values (p_shop_id, v_customer_name, v_customer_phone, p_action->>'notes')
            returning id into v_customer_id;
        else
            update public.customers
            set phone = coalesce(v_customer_phone, phone),
                notes = coalesce(p_action->>'notes', notes)
            where id = v_customer_id;
        end if;

    else
        raise exception 'Unknown action type: %', v_action_type;
    end if;

    -- Fetch updated balance
    if v_customer_id is not null then
        select coalesce(balance, 0) into v_new_balance
        from public.customer_balances
        where customer_id = v_customer_id;
    end if;

    return jsonb_build_object(
        'success', true,
        'action', v_action_type,
        'transaction_id', v_tx_id,
        'customer_id', v_customer_id,
        'customer_balance', v_new_balance,
        'stock_qty', v_prod_stock,
        'unmatched_items', v_unmatched_items
    );
end;
$$;

revoke all on function public.process_ledger_entry(uuid, jsonb, uuid) from public, anon;
grant execute on function public.process_ledger_entry(uuid, jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';
