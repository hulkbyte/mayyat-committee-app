# Mayyat Committee Management App

Mobile-first PWA for Mayyat Committee / Deceased Support Committee management.

## Built With

- Next.js App Router
- Supabase Auth + Postgres
- Role-based admin/editor workspace
- Public member lookup without password
- PKR currency formatting
- Installable PWA manifest and service worker

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

   `SUPABASE_SERVICE_ROLE_KEY` is required for Admin -> Users -> Add staff user. Keep it private and never put it in a `NEXT_PUBLIC_` variable.

3. In Supabase SQL editor, run:

   ```sql
   -- Paste and run supabase/migrations/001_initial_schema.sql
   ```

   If you already created the database before the fee-policy update, also run:

   ```sql
   -- Paste and run supabase/migrations/002_fee_policy.sql
   ```

   If you already created the database before the admin reset update, also run:

   ```sql
   -- Paste and run supabase/migrations/003_admin_reset.sql
   ```

   If you already created the database before the public lookup summary update, also run:

   ```sql
   -- Paste and run supabase/migrations/004_public_lookup_summary.sql
   ```

   If you already created the database before the opening balance edit update, also run:

   ```sql
   -- Paste and run supabase/migrations/005_opening_balance_edit.sql
   ```

   If you already created the database before the payment correction update, also run:

   ```sql
   -- Paste and run supabase/migrations/006_payment_delete_cleanup.sql
   ```

   If you already created the database before the reset-keep-members update, also run:

   ```sql
   -- Paste and run supabase/migrations/007_reset_keep_members.sql
   ```

   If Supabase shows `DELETE requires a WHERE clause` during reset, run:

   ```sql
   -- Paste and run supabase/migrations/008_reset_where_true.sql
   ```

4. Create your first admin:

   - Supabase dashboard -> Authentication -> Users -> Add user
   - Copy the created auth user id
   - Run this SQL with that id and email:

   ```sql
   insert into public.users (id, name, email, phone, role, status)
   values (
     'AUTH_USER_ID_HERE',
     'Admin',
     'admin@example.com',
     null,
     'admin',
     'active'
   );
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open:

   - Staff app: `http://localhost:3000/login`
   - Public lookup: `http://localhost:3000/public`

## Committee Rules Implemented

- Only paying members are stored in `member_accounts`.
- Wife is stored as `wife_name` when member is married.
- Wife is never a separate member account.
- Married son is a separate paying member account.
- Married son links to father through `parent_account_id`.
- Active members only are counted for monthly collection and shortfall division.
- Fund balance is always calculated from `fund_ledger`.
- Monthly payment, extra collection, and death expense edits replace their ledger row to avoid double counting.

## Main Routes

- `/login` - Admin/editor login
- `/public` - Public AccountNo lookup
- `/app/dashboard`
- `/app/members`
- `/app/payments`
- `/app/cases`
- `/app/expenses`
- `/app/extra`
- `/app/ledger`
- `/app/reports`
- `/app/settings`
- `/app/users`

## Important Files

- `supabase/migrations/001_initial_schema.sql` - Tables, constraints, triggers, RLS policies, RPCs
- `src/app` - Next.js routes
- `src/components` - Shared UI shell and components
- `src/lib` - Supabase client, constants, formatting, shared types
