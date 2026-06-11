create policy "admin can update opening ledger"
on public.fund_ledger
for update
using (public.is_admin() and source_type = 'Opening Balance')
with check (
  public.is_admin()
  and source_type = 'Opening Balance'
  and transaction_type = 'In'
  and out_amount = 0
);
