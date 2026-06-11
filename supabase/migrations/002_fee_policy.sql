alter table public.settings
add column if not exists pending_monthly_fee numeric(12,2),
add column if not exists pending_monthly_fee_effective_month date;

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

grant execute on function public.apply_monthly_fee_change(uuid, numeric, text, date) to authenticated;
