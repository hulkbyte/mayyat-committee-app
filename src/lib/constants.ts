export const PAYMENT_METHODS = ["Cash", "Bank", "Easypaisa", "JazzCash", "Other"] as const;

export const EXPENSE_CATEGORIES = [
  "Kafan",
  "Qabar",
  "Transport",
  "Food - Breakfast",
  "Food - Lunch",
  "Food - Evening Tea/Snacks",
  "Food - Dinner",
  "Tent / Chairs",
  "Masjid / Imam",
  "Announcement",
  "Miscellaneous",
] as const;

export const MEMBER_STATUSES = ["Active", "Inactive", "Suspended"] as const;
export const PAYMENT_STATUSES = ["Paid", "Partial", "Pending"] as const;
export const CASE_STATUSES = ["Open", "Expense Complete", "Shortfall Generated", "Closed"] as const;
