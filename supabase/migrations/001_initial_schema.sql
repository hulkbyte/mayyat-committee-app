create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  phone text,
  role text not null check (role in ('admin', 'editor')),
  status text not null default 'active' check (status in ('active', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  committee_name text not null default 'Mayyat Committee',
  default_monthly_fee numeric(12,2) not null default 200,
  pending_monthly_fee numeric(12,2),
  pending_monthly_fee_effective_month date,
  currency text not null default 'PKR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.settings (committee_name, default_monthly_fee, currency)
values ('Mayyat Committee', 200, 'PKR')
on conflict do nothing;

create table public.member_accounts (
  id uuid primary key default gen_random_uuid(),
  account_no text not null unique,
  member_name text not null,
  father_name text,
  parent_account_id uuid references public.member_accounts(id) on delete set null,
  phone text,
  address text,
  area text,
  join_date date not null default current_date,
  monthly_fee numeric(12,2) not null default 200,
  marital_status text not null default 'Single' check (marital_status in ('Single', 'Married')),
  wife_name text,
  status text not null default 'Active' check (status in ('Active', 'Inactive', 'Suspended')),
  opening_balance numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null,
  constraint wife_required_when_married check (
    marital_status = 'Single' or nullif(trim(coalesce(wife_name, '')), '') is not null
  )
);

create table public.death_cases (
  id uuid primary key default gen_random_uuid(),
  case_no text not null unique,
  account_id uuid not null references public.member_accounts(id) on delete restrict,
  deceased_type text not null check (deceased_type in ('Self', 'Wife')),
  deceased_name text not null,
  death_date date not null,
  burial_date date,
  case_status text not null default 'Open' check (case_status in ('Open', 'Expense Complete', 'Shortfall Generated', 'Closed')),
  fund_before_case numeric(12,2) not null default 0,
  total_expense numeric(12,2) not null default 0,
  shortfall numeric(12,2) not null default 0,
  active_members_count integer not null default 0,
  per_member_extra numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references public.users(id) on delete set null
);

create table public.monthly_payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.member_accounts(id) on delete restrict,
  payment_month date not null,
  amount_due numeric(12,2) not null,
  amount_paid numeric(12,2) not null default 0,
  balance numeric(12,2) generated always as (amount_due - amount_paid) stored,
  payment_status text not null default 'Pending' check (payment_status in ('Pending', 'Partial', 'Paid')),
  payment_date date,
  payment_method text not null default 'Cash' check (payment_method in ('Cash', 'Bank', 'Easypaisa', 'JazzCash', 'Other')),
  transaction_ref text,
  receipt_photo text,
  received_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, payment_month)
);

create table public.case_expenses (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.death_cases(id) on delete cascade,
  expense_date date not null default current_date,
  category text not null check (category in (
    'Kafan',
    'Qabar',
    'Transport',
    'Food - Breakfast',
    'Food - Lunch',
    'Food - Evening Tea/Snacks',
    'Food - Dinner',
    'Tent / Chairs',
    'Masjid / Imam',
    'Announcement',
    'Miscellaneous'
  )),
  description text,
  amount numeric(12,2) not null check (amount >= 0),
  paid_by text,
  receipt_photo text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.extra_collections (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.death_cases(id) on delete cascade,
  account_id uuid not null references public.member_accounts(id) on delete restrict,
  extra_due numeric(12,2) not null,
  extra_paid numeric(12,2) not null default 0,
  balance numeric(12,2) generated always as (extra_due - extra_paid) stored,
  extra_status text not null default 'Pending' check (extra_status in ('Pending', 'Partial', 'Paid')),
  payment_date date,
  payment_method text not null default 'Cash' check (payment_method in ('Cash', 'Bank', 'Easypaisa', 'JazzCash', 'Other')),
  transaction_ref text,
  receipt_photo text,
  received_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, account_id)
);

create table public.fund_ledger (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null default current_date,
  transaction_type text not null check (transaction_type in ('In', 'Out')),
  source_type text not null check (source_type in ('Opening Balance', 'Monthly Payment', 'Extra Collection', 'Death Expense')),
  source_id uuid,
  account_id uuid references public.member_accounts(id) on delete set null,
  case_id uuid references public.death_cases(id) on delete set null,
  description text not null,
  in_amount numeric(12,2) not null default 0 check (in_amount >= 0),
  out_amount numeric(12,2) not null default 0 check (out_amount >= 0),
  payment_method text check (payment_method in ('Cash', 'Bank', 'Easypaisa', 'JazzCash', 'Other')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_members_account_no on public.member_accounts(account_no);
create index idx_members_parent on public.member_accounts(parent_account_id);
create index idx_monthly_month on public.monthly_payments(payment_month);
create index idx_ledger_source on public.fund_ledger(source_type, source_id);
create index idx_extra_case on public.extra_collections(case_id);

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid() and status = 'active'
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin'
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'editor')
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_users_updated before update on public.users for each row execute function public.touch_updated_at();
create trigger touch_settings_updated before update on public.settings for each row execute function public.touch_updated_at();
create trigger touch_members_updated before update on public.member_accounts for each row execute function public.touch_updated_at();
create trigger touch_monthly_updated before update on public.monthly_payments for each row execute function public.touch_updated_at();
create trigger touch_expenses_updated before update on public.case_expenses for each row execute function public.touch_updated_at();
create trigger touch_extra_updated before update on public.extra_collections for each row execute function public.touch_updated_at();

create or replace function public.set_payment_status()
returns trigger
language plpgsql
as $$
begin
  if new.amount_paid <= 0 then
    new.payment_status = 'Pending';
  elsif new.amount_due - new.amount_paid > 0 then
    new.payment_status = 'Partial';
  else
    new.payment_status = 'Paid';
  end if;
  return new;
end;
$$;

create trigger monthly_payment_status before insert or update on public.monthly_payments
for each row execute function public.set_payment_status();

create or replace function public.set_extra_status()
returns trigger
language plpgsql
as $$
begin
  if new.extra_paid <= 0 then
    new.extra_status = 'Pending';
  elsif new.extra_due - new.extra_paid > 0 then
    new.extra_status = 'Partial';
  else
    new.extra_status = 'Paid';
  end if;
  return new;
end;
$$;

create trigger extra_collection_status before insert or update on public.extra_collections
for each row execute function public.set_extra_status();

create or replace function public.recalculate_case(case_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expense_total numeric(12,2);
  before_fund numeric(12,2);
  members_count integer;
  shortage numeric(12,2);
begin
  select coalesce(sum(amount), 0) into expense_total from public.case_expenses where case_id = case_uuid;
  select fund_before_case, active_members_count into before_fund, members_count from public.death_cases where id = case_uuid;
  shortage := greatest(0, expense_total - coalesce(before_fund, 0));

  update public.death_cases
  set total_expense = expense_total,
      shortfall = shortage,
      per_member_extra = case when coalesce(members_count, 0) > 0 then round(shortage / members_count, 2) else 0 end,
      case_status = case
        when case_status = 'Closed' then 'Closed'
        when shortage > 0 then 'Shortfall Generated'
        when expense_total > 0 then 'Expense Complete'
        else 'Open'
      end
  where id = case_uuid;
end;
$$;

create or replace function public.sync_monthly_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_label text;
begin
  select member_name into member_label from public.member_accounts where id = new.account_id;

  delete from public.fund_ledger
  where source_type = 'Monthly Payment' and source_id = new.id;

  if new.amount_paid > 0 then
    insert into public.fund_ledger (
      transaction_date, transaction_type, source_type, source_id, account_id, description,
      in_amount, out_amount, payment_method, created_by
    ) values (
      coalesce(new.payment_date, current_date), 'In', 'Monthly Payment', new.id, new.account_id,
      'Monthly payment for ' || to_char(new.payment_month, 'Month YYYY') || ' from ' || coalesce(member_label, 'member'),
      new.amount_paid, 0, new.payment_method, new.received_by
    );
  end if;
  return new;
end;
$$;

create trigger sync_monthly_ledger_after after insert or update on public.monthly_payments
for each row execute function public.sync_monthly_ledger();

create or replace function public.cleanup_monthly_ledger_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.fund_ledger
  where source_type = 'Monthly Payment' and source_id = old.id;
  return old;
end;
$$;

create trigger monthly_payment_delete_cleanup after delete on public.monthly_payments
for each row execute function public.cleanup_monthly_ledger_after_delete();

create or replace function public.sync_extra_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_label text;
  case_label text;
begin
  select member_name into member_label from public.member_accounts where id = new.account_id;
  select case_no into case_label from public.death_cases where id = new.case_id;

  delete from public.fund_ledger
  where source_type = 'Extra Collection' and source_id = new.id;

  if new.extra_paid > 0 then
    insert into public.fund_ledger (
      transaction_date, transaction_type, source_type, source_id, account_id, case_id, description,
      in_amount, out_amount, payment_method, created_by
    ) values (
      coalesce(new.payment_date, current_date), 'In', 'Extra Collection', new.id, new.account_id, new.case_id,
      'Extra collection for case ' || coalesce(case_label, '') || ' from ' || coalesce(member_label, 'member'),
      new.extra_paid, 0, new.payment_method, new.received_by
    );
  end if;
  return new;
end;
$$;

create trigger sync_extra_ledger_after after insert or update on public.extra_collections
for each row execute function public.sync_extra_ledger();

create or replace function public.cleanup_extra_ledger_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.fund_ledger
  where source_type = 'Extra Collection' and source_id = old.id;
  return old;
end;
$$;

create trigger extra_collection_delete_cleanup after delete on public.extra_collections
for each row execute function public.cleanup_extra_ledger_after_delete();

create or replace function public.sync_expense_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.fund_ledger
  where source_type = 'Death Expense' and source_id = new.id;

  insert into public.fund_ledger (
    transaction_date, transaction_type, source_type, source_id, case_id, description,
    in_amount, out_amount
  ) values (
    new.expense_date, 'Out', 'Death Expense', new.id, new.case_id,
    'Death case expense - ' || new.category,
    0, new.amount
  );

  perform public.recalculate_case(new.case_id);
  return new;
end;
$$;

create trigger sync_expense_ledger_after after insert or update on public.case_expenses
for each row execute function public.sync_expense_ledger();

create or replace function public.recalculate_case_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.fund_ledger
  where source_type = 'Death Expense' and source_id = old.id;
  perform public.recalculate_case(old.case_id);
  return old;
end;
$$;

create trigger expense_delete_cleanup after delete on public.case_expenses
for each row execute function public.recalculate_case_after_delete();

create or replace function public.get_fund_balance()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(in_amount), 0) - coalesce(sum(out_amount), 0) from public.fund_ledger
$$;

create or replace function public.create_death_case(
  p_case_no text,
  p_account_id uuid,
  p_deceased_type text,
  p_death_date date,
  p_burial_date date,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  member_record public.member_accounts%rowtype;
  new_case_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Not allowed';
  end if;

  select * into member_record from public.member_accounts where id = p_account_id;
  if member_record.id is null then
    raise exception 'Member account not found';
  end if;

  if p_deceased_type = 'Wife' and (member_record.marital_status <> 'Married' or nullif(trim(coalesce(member_record.wife_name, '')), '') is null) then
    raise exception 'Wife case is allowed only for married members with wife name';
  end if;

  insert into public.death_cases (
    case_no, account_id, deceased_type, deceased_name, death_date, burial_date,
    fund_before_case, active_members_count, notes, created_by
  ) values (
    p_case_no, p_account_id, p_deceased_type,
    case when p_deceased_type = 'Self' then member_record.member_name else member_record.wife_name end,
    p_death_date, p_burial_date, public.get_fund_balance(),
    (select count(*) from public.member_accounts where status = 'Active'),
    p_notes, auth.uid()
  )
  returning id into new_case_id;

  return new_case_id;
end;
$$;

create or replace function public.generate_extra_collections(p_case_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  case_record public.death_cases%rowtype;
  inserted_count integer;
begin
  if not public.is_staff() then
    raise exception 'Not allowed';
  end if;

  perform public.recalculate_case(p_case_id);
  select * into case_record from public.death_cases where id = p_case_id;

  if case_record.shortfall <= 0 or case_record.per_member_extra <= 0 then
    return 0;
  end if;

  insert into public.extra_collections (case_id, account_id, extra_due, extra_paid)
  select p_case_id, id, case_record.per_member_extra, 0
  from public.member_accounts
  where status = 'Active'
  on conflict (case_id, account_id) do update
  set extra_due = excluded.extra_due,
      updated_at = now();

  get diagnostics inserted_count = row_count;

  update public.death_cases
  set case_status = 'Shortfall Generated'
  where id = p_case_id and case_status <> 'Closed';

  return inserted_count;
end;
$$;

create or replace function public.apply_monthly_fee_change(
  p_settings_id uuid,
  p_default_monthly_fee numeric,
  p_apply_mode text,
  p_effective_month date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admin can change monthly fee settings';
  end if;

  if p_apply_mode not in ('now', 'next_month') then
    raise exception 'Invalid fee apply mode';
  end if;

  if p_apply_mode = 'now' then
    update public.settings
    set default_monthly_fee = p_default_monthly_fee,
        pending_monthly_fee = null,
        pending_monthly_fee_effective_month = null
    where id = p_settings_id;

    update public.member_accounts
    set monthly_fee = p_default_monthly_fee
    where status = 'Active';
  else
    update public.settings
    set pending_monthly_fee = p_default_monthly_fee,
        pending_monthly_fee_effective_month = coalesce(p_effective_month, date_trunc('month', current_date + interval '1 month')::date)
    where id = p_settings_id;
  end if;
end;
$$;

create or replace function public.reset_committee_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admin can reset committee data';
  end if;

  delete from public.fund_ledger where true;
  delete from public.extra_collections where true;
  delete from public.case_expenses where true;
  delete from public.monthly_payments where true;
  delete from public.death_cases where true;
end;
$$;

create or replace view public.dashboard_summary as
select
  (select count(*) from public.member_accounts where status = 'Active') as active_members,
  (select count(*) from public.member_accounts where status = 'Inactive') as inactive_members,
  (select count(*) from public.member_accounts where status = 'Suspended') as suspended_members,
  public.get_fund_balance() as fund_balance,
  (select coalesce(sum(amount_paid), 0) from public.monthly_payments where date_trunc('month', payment_month) = date_trunc('month', current_date)) as this_month_collection,
  (select coalesce(sum(balance), 0) from public.monthly_payments where payment_status <> 'Paid') as pending_monthly,
  (select count(*) from public.death_cases where case_status <> 'Closed') as open_cases,
  (select coalesce(sum(total_expense), 0) from public.death_cases where case_status <> 'Closed') as active_case_expenses,
  (select coalesce(sum(shortfall), 0) from public.death_cases where case_status <> 'Closed') as current_shortfall,
  (select coalesce(max(per_member_extra), 0) from public.death_cases where case_status <> 'Closed') as per_member_extra,
  (select coalesce(sum(balance), 0) from public.extra_collections where extra_status <> 'Paid') as pending_extra;

create or replace function public.public_member_lookup(p_account_no text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member_record jsonb;
  summary_record jsonb;
begin
  select to_jsonb(x) into member_record
  from (
    select
      m.id,
      m.account_no,
      m.member_name,
      m.father_name,
      m.area,
      m.join_date,
      m.monthly_fee,
      m.marital_status,
      case when m.marital_status = 'Married' then m.wife_name else null end as wife_name,
      m.status,
      coalesce(mp.payment_status, 'Pending') as current_month_payment_status,
      coalesce(mp.balance, m.monthly_fee) as pending_monthly_amount,
      coalesce((select sum(balance) from public.extra_collections ec where ec.account_id = m.id and ec.extra_status <> 'Paid'), 0) as extra_collection_due
    from public.member_accounts m
    left join public.monthly_payments mp
      on mp.account_id = m.id
     and date_trunc('month', mp.payment_month) = date_trunc('month', current_date)
    where m.account_no = p_account_no
    limit 1
  ) x;

  select to_jsonb(x) into summary_record
  from (
    select
      public.get_fund_balance() as current_fund_balance,
      (select count(*) from public.member_accounts where status = 'Active') as active_members_count,
      dc.case_no,
      dc.deceased_name,
      dc.total_expense,
      dc.shortfall,
      dc.per_member_extra,
      dc.case_status
    from (select 1) base
    left join lateral (
      select
        case_no,
        deceased_name,
        total_expense,
        shortfall,
        per_member_extra,
        case_status
      from public.death_cases
      where case_status <> 'Closed'
      order by created_at desc
      limit 1
    ) dc on true
  ) x;

  return jsonb_build_object('member', member_record, 'summary', summary_record);
end;
$$;

alter table public.users enable row level security;
alter table public.settings enable row level security;
alter table public.member_accounts enable row level security;
alter table public.monthly_payments enable row level security;
alter table public.death_cases enable row level security;
alter table public.case_expenses enable row level security;
alter table public.extra_collections enable row level security;
alter table public.fund_ledger enable row level security;

create policy "staff can read users" on public.users for select using (public.is_staff());
create policy "admin can manage users" on public.users for all using (public.is_admin()) with check (public.is_admin());

create policy "staff can read settings" on public.settings for select using (public.is_staff());
create policy "admin can update settings" on public.settings for update using (public.is_admin()) with check (public.is_admin());

create policy "staff can read members" on public.member_accounts for select using (public.is_staff());
create policy "staff can write members" on public.member_accounts for insert with check (public.is_staff());
create policy "staff can update members" on public.member_accounts for update using (public.is_staff()) with check (public.is_staff());
create policy "admin can delete members" on public.member_accounts for delete using (public.is_admin());

create policy "staff can read payments" on public.monthly_payments for select using (public.is_staff());
create policy "staff can insert payments" on public.monthly_payments for insert with check (public.is_staff());
create policy "staff can update payments" on public.monthly_payments for update using (public.is_staff()) with check (public.is_staff());
create policy "admin can delete payments" on public.monthly_payments for delete using (public.is_admin());

create policy "staff can read cases" on public.death_cases for select using (public.is_staff());
create policy "staff can insert cases" on public.death_cases for insert with check (public.is_staff());
create policy "staff can update cases" on public.death_cases for update using (public.is_staff()) with check (public.is_staff());
create policy "admin can delete cases" on public.death_cases for delete using (public.is_admin());

create policy "staff can read expenses" on public.case_expenses for select using (public.is_staff());
create policy "staff can insert expenses" on public.case_expenses for insert with check (public.is_staff());
create policy "staff can update expenses" on public.case_expenses for update using (public.is_staff()) with check (public.is_staff());
create policy "admin can delete expenses" on public.case_expenses for delete using (public.is_admin());

create policy "staff can read extras" on public.extra_collections for select using (public.is_staff());
create policy "staff can insert extras" on public.extra_collections for insert with check (public.is_staff());
create policy "staff can update extras" on public.extra_collections for update using (public.is_staff()) with check (public.is_staff());
create policy "admin can delete extras" on public.extra_collections for delete using (public.is_admin());

create policy "staff can read ledger" on public.fund_ledger for select using (public.is_staff());
create policy "admin can insert opening ledger" on public.fund_ledger for insert with check (public.is_admin() and source_type = 'Opening Balance');
create policy "admin can update opening ledger" on public.fund_ledger for update using (public.is_admin() and source_type = 'Opening Balance') with check (public.is_admin() and source_type = 'Opening Balance' and transaction_type = 'In' and out_amount = 0);
create policy "admin can delete ledger" on public.fund_ledger for delete using (public.is_admin());

grant usage on schema public to anon, authenticated;
grant execute on function public.public_member_lookup(text) to anon, authenticated;
grant execute on function public.create_death_case(text, uuid, text, date, date, text) to authenticated;
grant execute on function public.generate_extra_collections(uuid) to authenticated;
grant execute on function public.apply_monthly_fee_change(uuid, numeric, text, date) to authenticated;
grant execute on function public.reset_committee_data() to authenticated;
grant execute on function public.get_fund_balance() to authenticated;
grant select on public.dashboard_summary to authenticated;
