type StatusBadgeProps = {
  value: string | null | undefined;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const label = value || "Unknown";
  const tone =
    label === "Active" || label === "Paid" || label === "Closed"
      ? "good"
      : label === "Partial" || label === "Expense Complete" || label === "Shortfall Generated"
        ? "warn"
        : label === "Suspended" || label === "Pending" || label === "Open"
          ? "bad"
          : "muted";

  return <span className={`badge ${tone}`}>{label}</span>;
}
