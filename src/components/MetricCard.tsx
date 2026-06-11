import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: ReactNode;
  sub?: string;
};

export function MetricCard({ label, value, sub }: MetricCardProps) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </article>
  );
}
