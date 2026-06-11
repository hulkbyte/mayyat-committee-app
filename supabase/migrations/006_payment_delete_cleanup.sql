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

drop trigger if exists monthly_payment_delete_cleanup on public.monthly_payments;
create trigger monthly_payment_delete_cleanup
after delete on public.monthly_payments
for each row execute function public.cleanup_monthly_ledger_after_delete();

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

drop trigger if exists extra_collection_delete_cleanup on public.extra_collections;
create trigger extra_collection_delete_cleanup
after delete on public.extra_collections
for each row execute function public.cleanup_extra_ledger_after_delete();
