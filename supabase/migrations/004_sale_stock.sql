-- =============================================================================
-- DukaanAI Migration 004: Enhanced Sale Stock Tracking & Atomic Verification
-- Description: Updates process_ledger_entry to decrement stock with one conditional
-- UPDATE per item, reject foreign product IDs, validate qty server-side, and return
-- structured stock_updates while preserving exact function signature & return shape.
-- Security: SECURITY INVOKER, search_path = public, grants only to authenticated.
-- =============================================================================

set check_function_bodies = off;

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
    v_real_prod_name text;
    v_prod_stock numeric(10,2);
    v_new_stock numeric(10,2);
    v_prod_reorder numeric(10,2);
    v_item_qty numeric(10,2);
    v_item_price numeric(10,2);
    v_qty_change numeric(10,2);
    v_row_count int;
    v_unmatched_items jsonb := '[]'::jsonb;
    v_stock_updates jsonb := '[]'::jsonb;
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

            -- Auto-create customer if requested and not found
            if v_customer_id is null and (p_action->>'create_customer')::boolean is true then
                insert into public.customers (
                    shop_id,
                    name,
                    phone,
                    notes
                ) values (
                    p_shop_id,
                    v_customer_name,
                    p_action->>'phone',
                    p_action->>'notes'
                ) returning id into v_customer_id;
            end if;
        end if;

        -- Insert transaction
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
                v_item_qty := (v_item->>'qty')::numeric;
                v_item_price := coalesce((v_item->>'unit_price')::numeric, 0);
                v_prod_id := null;

                -- If unit mismatch, record no stock change for this item
                if (v_item->>'unit_mismatch')::boolean is true then
                    v_unmatched_items := v_unmatched_items || jsonb_build_object(
                        'product', v_prod_name,
                        'qty', v_item_qty,
                        'reason', 'unit_mismatch'
                    );
                    continue;
                end if;

                -- Validate qty server-side (finite, > 0, sane maximum)
                if v_item_qty is null or v_item_qty <= 0 or v_item_qty > 100000 then
                    raise exception 'Invalid quantity % for item "%". Quantity must be positive, finite, and at most 100000.',
                        coalesce(v_item->>'qty', '0'), v_prod_name;
                end if;

                -- Reject any product id that does not belong to p_shop_id
                if v_item ? 'product_id' and v_item->>'product_id' <> '' then
                    v_prod_id := (v_item->>'product_id')::uuid;
                    select id, name, coalesce(reorder_level, 5)
                    into v_prod_id, v_real_prod_name, v_prod_reorder
                    from public.products
                    where id = v_prod_id
                      and shop_id = p_shop_id;

                    if v_prod_id is null then
                        raise exception 'Product ID % does not belong to shop %',
                            (v_item->>'product_id'), p_shop_id;
                    end if;
                elsif v_prod_name <> '' then
                    select id, name, coalesce(reorder_level, 5)
                    into v_prod_id, v_real_prod_name, v_prod_reorder
                    from public.products
                    where shop_id = p_shop_id
                      and lower(name) = lower(v_prod_name)
                    limit 1;
                end if;

                if v_prod_id is not null then
                    -- Decrement with ONE conditional UPDATE per item
                    update public.products
                    set stock_qty = stock_qty - v_item_qty
                    where id = v_prod_id
                      and shop_id = p_shop_id
                      and stock_qty >= v_item_qty
                    returning stock_qty into v_new_stock;

                    get diagnostics v_row_count = row_count;
                    if v_row_count = 0 then
                        raise exception 'Insufficient stock for product "%". Requested: %, but available stock is insufficient.',
                            coalesce(v_real_prod_name, v_prod_name), v_item_qty;
                    end if;

                    v_prod_stock := v_new_stock + v_item_qty;

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

                    -- Record structured stock telemetry
                    v_stock_updates := v_stock_updates || jsonb_build_object(
                        'product_id', v_prod_id,
                        'name', coalesce(v_real_prod_name, v_prod_name),
                        'old_stock', v_prod_stock,
                        'new_stock', v_new_stock,
                        'reorder_level', v_prod_reorder,
                        'is_low_stock', v_new_stock <= v_prod_reorder
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
            v_amount,
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

        if v_qty_change = 0 then
            raise exception 'Quantity change cannot be zero.';
        end if;

        if p_action->>'product_id' is not null and p_action->>'product_id' <> '' then
            v_prod_id := (p_action->>'product_id')::uuid;
            select id, stock_qty, name
            into v_prod_id, v_prod_stock, v_real_prod_name
            from public.products
            where id = v_prod_id
              and shop_id = p_shop_id;

            if v_prod_id is null then
                raise exception 'Product ID % does not belong to shop %',
                    (p_action->>'product_id'), p_shop_id;
            end if;
        elsif v_prod_name <> '' then
            select id, stock_qty, name
            into v_prod_id, v_prod_stock, v_real_prod_name
            from public.products
            where shop_id = p_shop_id
              and lower(name) = lower(v_prod_name)
            limit 1;
        end if;

        if v_prod_id is null then
            raise exception 'Product "%" not found in shop inventory.', v_prod_name;
        end if;

        if (v_prod_stock + v_qty_change) < 0 then
            raise exception 'Stock cannot be negative. Current: %, change: %',
                v_prod_stock, v_qty_change;
        end if;

        update public.products
        set stock_qty = stock_qty + v_qty_change
        where id = v_prod_id
          and shop_id = p_shop_id;

        v_prod_stock := v_prod_stock + v_qty_change;

    -- -------------------------------------------------------------------------
    -- 4. ADD CUSTOMER
    -- -------------------------------------------------------------------------
    elsif v_action_type = 'add_customer' then
        v_customer_name := trim(coalesce(p_action->>'name', ''));
        v_customer_phone := nullif(trim(coalesce(p_action->>'phone', '')), '');

        if v_customer_name = '' then
            raise exception 'Customer name cannot be empty.';
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
        'unmatched_items', v_unmatched_items,
        'stock_updates', v_stock_updates
    );
end;
$$;

revoke all on function public.process_ledger_entry(uuid, jsonb, uuid) from public, anon;
grant execute on function public.process_ledger_entry(uuid, jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';
