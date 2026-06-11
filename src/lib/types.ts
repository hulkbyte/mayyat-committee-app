export type UserRole = "admin" | "editor";

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: "active" | "blocked";
};

export type MemberAccount = {
  id: string;
  account_no: string;
  public_pin: string;
  member_name: string;
  father_name: string | null;
  parent_account_id: string | null;
  phone: string | null;
  address: string | null;
  area: string | null;
  join_date: string;
  monthly_fee: number;
  marital_status: "Single" | "Married";
  wife_name: string | null;
  status: "Active" | "Inactive" | "Suspended";
  opening_balance: number;
  notes: string | null;
};

export type MemberOption = Pick<MemberAccount, "id" | "account_no" | "member_name" | "wife_name" | "marital_status" | "monthly_fee">;

export type DashboardSummary = {
  active_members: number;
  inactive_members: number;
  suspended_members: number;
  fund_balance: number;
  this_month_collection: number;
  pending_monthly: number;
  open_cases: number;
  active_case_expenses: number;
  current_shortfall: number;
  per_member_extra: number;
  pending_extra: number;
};

export type AdminNotification = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: UserRole | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  entity_type: string;
  entity_id: string | null;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};
