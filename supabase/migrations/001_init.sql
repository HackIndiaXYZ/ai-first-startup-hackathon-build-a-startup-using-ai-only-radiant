set check_function_bodies = off;
-- ==============================================================================
-- DukaanAI - Phase 2 Initial Schema Migration
-- Matches docs/BRIEF.md database specification & RLS requirements
-- ==============================================================================

-- 1. Helper function for RLS shop ownership check
create or replace function public.is_shop_owner(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shops
    where id = p_shop_id
      and owner_id = auth.uid()
  );
$$;

-- 2. Shops Table
create table if not exists public.shops (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    gstin text,
    language text not null default 'hi',
    created_at timestamptz not null default now()
);

-- 3. Customers Table
create table if not exists public.customers (
    id uuid primary key default gen_random_uuid(),
    shop_id uuid references public.shops(id) on delete cascade not null,
    name text not null,
    phone text,
    notes text,
    created_at timestamptz not null default now()
);

-- 4. Products Table
create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    shop_id uuid references public.shops(id) on delete cascade not null,
    name text not null,
    unit text not null default 'kg',
    price numeric(10,2) not null check (price >= 0),
    stock_qty numeric(10,2) not null default 0,
    reorder_level numeric(10,2) not null default 5,
    created_at timestamptz not null default now()
);

-- 5. Transactions Table
create table if not exists public.transactions (
    id uuid primary key default gen_random_uuid(),
    shop_id uuid references public.shops(id) on delete cascade not null,
    customer_id uuid references public.customers(id) on delete set null,
    type text not null check (type in ('sale', 'payment')),
    total_amount numeric(10,2) not null default 0 check (total_amount >= 0),
    paid_amount numeric(10,2) not null default 0 check (paid_amount >= 0),
    raw_input text,
    created_at timestamptz not null default now()
);

-- 6. Transaction Items Table
create table if not exists public.transaction_items (
    id uuid primary key default gen_random_uuid(),
    transaction_id uuid references public.transactions(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete set null,
    qty numeric(10,2) not null check (qty > 0),
    unit_price numeric(10,2) not null check (unit_price >= 0)
);

-- 7. Agent Logs Table
create table if not exists public.agent_logs (
    id uuid primary key default gen_random_uuid(),
    shop_id uuid references public.shops(id) on delete cascade not null,
    agent text not null,
    input text not null,
    output_json jsonb not null default '{}'::jsonb,
    confidence numeric(4,3) check (confidence >= 0 and confidence <= 1),
    created_at timestamptz not null default now()
);

-- ==============================================================================
-- INDEXES
-- ==============================================================================
create index if not exists idx_shops_owner on public.shops(owner_id);
create index if not exists idx_customers_shop on public.customers(shop_id);
create index if not exists idx_customers_name on public.customers(shop_id, name);
create index if not exists idx_products_shop on public.products(shop_id);
create index if not exists idx_products_name on public.products(shop_id, name);
create index if not exists idx_transactions_shop_created on public.transactions(shop_id, created_at desc);
create index if not exists idx_transactions_customer on public.transactions(customer_id);
create index if not exists idx_transaction_items_tx on public.transaction_items(transaction_id);
create index if not exists idx_agent_logs_shop_created on public.agent_logs(shop_id, created_at desc);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================
alter table public.shops enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.agent_logs enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Users can view their own shops" on public.shops;
drop policy if exists "Users can create their own shops" on public.shops;
drop policy if exists "Users can update their own shops" on public.shops;
drop policy if exists "Users can delete their own shops" on public.shops;

drop policy if exists "Shop owner manage customers" on public.customers;
drop policy if exists "Shop owner manage products" on public.products;
drop policy if exists "Shop owner manage transactions" on public.transactions;
drop policy if exists "Shop owner manage transaction items" on public.transaction_items;
drop policy if exists "Shop owner manage agent logs" on public.agent_logs;

-- Policies for shops
create policy "Users can view their own shops"
    on public.shops for select
    using (owner_id = auth.uid());

create policy "Users can create their own shops"
    on public.shops for insert
    with check (owner_id = auth.uid());

create policy "Users can update their own shops"
    on public.shops for update
    using (owner_id = auth.uid());

create policy "Users can delete their own shops"
    on public.shops for delete
    using (owner_id = auth.uid());

-- Policies for customers
create policy "Shop owner manage customers"
    on public.customers for all
    using (public.is_shop_owner(shop_id))
    with check (public.is_shop_owner(shop_id));

-- Policies for products
create policy "Shop owner manage products"
    on public.products for all
    using (public.is_shop_owner(shop_id))
    with check (public.is_shop_owner(shop_id));

-- Policies for transactions
create policy "Shop owner manage transactions"
    on public.transactions for all
    using (public.is_shop_owner(shop_id))
    with check (public.is_shop_owner(shop_id));

-- Policies for transaction_items
create policy "Shop owner manage transaction items"
    on public.transaction_items for all
    using (
        exists (
            select 1
            from public.transactions t
            where t.id = transaction_id
              and public.is_shop_owner(t.shop_id)
        )
    )
    with check (
        exists (
            select 1
            from public.transactions t
            where t.id = transaction_id
              and public.is_shop_owner(t.shop_id)
        )
    );

-- Policies for agent_logs
create policy "Shop owner manage agent logs"
    on public.agent_logs for all
    using (public.is_shop_owner(shop_id))
    with check (public.is_shop_owner(shop_id));

-- ==============================================================================
-- VIEWS
-- customer_balances: net udhar balance per customer (security invoker respects RLS)
-- ==============================================================================
create or replace view public.customer_balances
with (security_invoker = true) as
select
    c.id as customer_id,
    c.shop_id,
    c.name,
    c.phone,
    coalesce(
        sum(case when t.type = 'sale' then t.total_amount else 0 end) -
        sum(coalesce(t.paid_amount, 0)),
        0
    ) as balance,
    max(t.created_at) as last_transaction_at
from public.customers c
left join public.transactions t on c.id = t.customer_id
group by c.id, c.shop_id, c.name, c.phone;
