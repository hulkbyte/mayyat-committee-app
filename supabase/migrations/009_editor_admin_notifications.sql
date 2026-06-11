create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  actor_name text,
  actor_role text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity_type text not null,
  entity_id uuid,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_notifications_read_created
  on public.admin_notifications(is_read, created_at desc);

alter table public.admin_notifications enable row level security;

drop policy if exists "admin can read notifications" on public.admin_notifications;
drop policy if exists "admin can update notifications" on public.admin_notifications;
drop policy if exists "admin can delete notifications" on public.admin_notifications;

create policy "admin can read notifications"
  on public.admin_notifications for select
  using (public.is_admin());

create policy "admin can update notifications"
  on public.admin_notifications for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin can delete notifications"
  on public.admin_notifications for delete
  using (public.is_admin());

create or replace function public.notify_admin_on_editor_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.users%rowtype;
  row_data jsonb;
  entity_label text;
  entity_type_label text;
  entity_id_value uuid;
  action_label text;
begin
  select * into actor from public.users where id = auth.uid() and status = 'active';

  if actor.id is null or actor.role <> 'editor' then
    return coalesce(new, old);
  end if;

  row_data := to_jsonb(coalesce(new, old));
  entity_id_value := nullif(row_data->>'id', '')::uuid;

  entity_type_label := case tg_table_name
    when 'member_accounts' then 'member'
    when 'monthly_payments' then 'monthly payment'
    when 'death_cases' then 'death case'
    when 'case_expenses' then 'case expense'
    when 'extra_collections' then 'extra collection'
    else replace(tg_table_name, '_', ' ')
  end;

  entity_label := case tg_table_name
    when 'member_accounts' then trim(coalesce(row_data->>'account_no', '') || ' - ' || coalesce(row_data->>'member_name', ''))
    when 'monthly_payments' then 'Payment month ' || coalesce(row_data->>'payment_month', '-')
    when 'death_cases' then trim(coalesce(row_data->>'case_no', '') || ' - ' || coalesce(row_data->>'deceased_name', ''))
    when 'case_expenses' then trim(coalesce(row_data->>'category', 'Expense') || ' Rs ' || coalesce(row_data->>'amount', '0'))
    when 'extra_collections' then 'Extra due Rs ' || coalesce(row_data->>'extra_due', '0') || ', paid Rs ' || coalesce(row_data->>'extra_paid', '0')
    else coalesce(row_data->>'id', '-')
  end;

  action_label := case tg_op
    when 'INSERT' then 'added'
    when 'UPDATE' then 'updated'
    when 'DELETE' then 'deleted'
    else lower(tg_op)
  end;

  insert into public.admin_notifications (
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    title,
    body
  )
  values (
    actor.id,
    actor.name,
    actor.role,
    tg_op,
    entity_type_label,
    entity_id_value,
    actor.name || ' ' || action_label || ' ' || entity_type_label,
    nullif(entity_label, '')
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists notify_editor_member_change on public.member_accounts;
drop trigger if exists notify_editor_payment_change on public.monthly_payments;
drop trigger if exists notify_editor_case_change on public.death_cases;
drop trigger if exists notify_editor_expense_change on public.case_expenses;
drop trigger if exists notify_editor_extra_change on public.extra_collections;

create trigger notify_editor_member_change
after insert or update or delete on public.member_accounts
for each row execute function public.notify_admin_on_editor_change();

create trigger notify_editor_payment_change
after insert or update or delete on public.monthly_payments
for each row execute function public.notify_admin_on_editor_change();

create trigger notify_editor_case_change
after insert or update or delete on public.death_cases
for each row execute function public.notify_admin_on_editor_change();

create trigger notify_editor_expense_change
after insert or update or delete on public.case_expenses
for each row execute function public.notify_admin_on_editor_change();

create trigger notify_editor_extra_change
after insert or update or delete on public.extra_collections
for each row execute function public.notify_admin_on_editor_change();

grant select, update, delete on public.admin_notifications to authenticated;
