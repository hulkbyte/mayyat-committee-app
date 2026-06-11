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

grant execute on function public.reset_committee_data() to authenticated;
