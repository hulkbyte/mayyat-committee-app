alter table public.member_accounts
  add column if not exists public_pin text;

do $$
declare
  member_row record;
  candidate text;
begin
  for member_row in
    select id
    from public.member_accounts
    where public_pin is null or public_pin !~ '^[0-9]{4}$'
  loop
    loop
      candidate := lpad(floor(random() * 10000)::int::text, 4, '0');
      exit when not exists (
        select 1
        from public.member_accounts
        where public_pin = candidate
      );
    end loop;

    update public.member_accounts
    set public_pin = candidate
    where id = member_row.id;
  end loop;
end;
$$;

alter table public.member_accounts
  alter column public_pin set not null;

alter table public.member_accounts
  drop constraint if exists member_accounts_public_pin_format;

alter table public.member_accounts
  add constraint member_accounts_public_pin_format
  check (public_pin ~ '^[0-9]{4}$');

create unique index if not exists idx_members_public_pin
  on public.member_accounts(public_pin);

drop function if exists public.public_member_lookup(text);

create or replace function public.public_member_lookup(p_public_pin text)
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
    where m.public_pin = trim(p_public_pin)
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

grant execute on function public.public_member_lookup(text) to anon, authenticated;
