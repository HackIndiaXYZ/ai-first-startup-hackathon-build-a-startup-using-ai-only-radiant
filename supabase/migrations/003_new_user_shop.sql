set check_function_bodies = off;

-- ==============================================================================
-- DukaanAI - Migration 003: Auto-create Shop on User Signup & Sample Data RPC
-- Matches Phase 4 requirements:
-- 1. Trigger on auth.users AFTER INSERT that creates a shop for each new user.
--    owner_id = new.id, default name = 'मेरी दुकान / My Dukaan'.
--    SECURITY DEFINER, set search_path = public, inserts only that one row,
--    handles duplicates safely, revoked from anon/authenticated.
-- 2. Backfill existing users in auth.users without a shop.
-- 3. SECURITY INVOKER RPC load_sample_data() for brand-new users to load a
--    small set of sample customers and products (RLS-safe, no service role key).
-- ==============================================================================

-- 1. Trigger function: handle_new_user()
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Handle duplicates safely: only insert that one row if user has no shop yet
    if not exists (
        select 1 from public.shops where owner_id = new.id
    ) then
        insert into public.shops (owner_id, name, language)
        values (new.id, 'मेरी दुकान / My Dukaan', 'hi');
    end if;

    return new;
end;
$$;

-- Security: Revoke execute from public, anon, and authenticated
-- (Callable only by Supabase internal trigger engine)
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- 2. Trigger on auth.users AFTER INSERT
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- 3. Backfill any existing users in auth.users who do not yet have a shop
insert into public.shops (owner_id, name, language)
select u.id, 'मेरी दुकान / My Dukaan', 'hi'
from auth.users u
where not exists (
    select 1 from public.shops s where s.owner_id = u.id
);

-- 4. RPC: load_sample_data()
-- Copies a small set of 4 customers and 6 products into the caller's shop.
-- Runs as SECURITY INVOKER so it strictly enforces RLS policies and auth.uid().
create or replace function public.load_sample_data()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_shop_id uuid;
    v_cust_count int;
    v_prod_count int;
    v_added_custs int := 0;
    v_added_prods int := 0;
begin
    -- Check that user is authenticated
    if auth.uid() is null then
        return jsonb_build_object(
            'success', false,
            'error', 'Authentication required'
        );
    end if;

    -- Retrieve shop owned by calling user (RLS-enforced)
    select id into v_shop_id
    from public.shops
    where owner_id = auth.uid()
    limit 1;

    -- Safe fallback: create shop if not present
    if v_shop_id is null then
        insert into public.shops (owner_id, name, language)
        values (auth.uid(), 'मेरी दुकान / My Dukaan', 'hi')
        returning id into v_shop_id;
    end if;

    -- Count existing items to prevent duplicate inflation
    select count(*) into v_cust_count from public.customers where shop_id = v_shop_id;
    select count(*) into v_prod_count from public.products where shop_id = v_shop_id;

    -- Insert small set of 4 realistic Indian customers if empty
    if v_cust_count = 0 then
        insert into public.customers (shop_id, name, phone, notes)
        values
            (v_shop_id, 'रमेश कुमार (Ramesh Kumar)', '9876543210', 'नियमित किराना ग्राहक'),
            (v_shop_id, 'सुनील शर्मा (Sunil Sharma)', '9811223344', 'शर्मा जी, गली नं 2'),
            (v_shop_id, 'अमित पटेल (Amit Patel)', '9822334455', 'दुकान के पास वाले'),
            (v_shop_id, 'रेखा दीदी (Rekha Didi)', '9833445566', 'महीने का उधार खाता');
        v_added_custs := 4;
    end if;

    -- Insert small set of 6 everyday kirana products (with 1 low-stock item for alert demo)
    if v_prod_count = 0 then
        insert into public.products (shop_id, name, unit, price, stock_qty, reorder_level)
        values
            (v_shop_id, 'Aashirvaad Atta (आशीर्वाद आटा)', 'kg', 45.00, 15, 5),
            (v_shop_id, 'Fortune Mustard Oil (सरसों तेल)', 'l', 165.00, 8, 4),
            (v_shop_id, 'Tata Salt (टाटा नमक)', 'pkt', 28.00, 20, 5),
            (v_shop_id, 'Amul Butter (अमूल मक्खन)', 'pkt', 58.00, 2, 5),
            (v_shop_id, 'Sugar (चीनी)', 'kg', 44.00, 25, 10),
            (v_shop_id, 'Taj Mahal Tea (चाय पत्ती)', 'pkt', 140.00, 7, 3);
        v_added_prods := 6;
    end if;

    return jsonb_build_object(
        'success', true,
        'customers_added', v_added_custs,
        'products_added', v_added_prods,
        'message', 'Sample data loaded successfully'
    );
end;
$$;

-- Allow authenticated users to execute the sample data RPC
grant execute on function public.load_sample_data() to authenticated;

-- 5. Reload PostgREST schema cache
notify pgrst, 'reload schema';
