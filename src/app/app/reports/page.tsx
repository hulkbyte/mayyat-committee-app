"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { money } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { DashboardSummary } from "@/lib/types";

type SimpleRow = Record<string, string | number | null>;

export default function ReportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [pendingPayments, setPendingPayments] = useState<SimpleRow[]>([]);
  const [pendingExtras, setPendingExtras] = useState<SimpleRow[]>([]);
  const [areaRows, setAreaRows] = useState<SimpleRow[]>([]);
  const [linkedRows, setLinkedRows] = useState<SimpleRow[]>([]);
  const [caseExpenses, setCaseExpenses] = useState<SimpleRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const [summaryResult, pendingResult, extraResult, membersResult, linkedResult, expenseResult] = await Promise.all([
        supabase.from("dashboard_summary").select("*").single(),
        supabase
          .from("monthly_payments")
          .select("payment_month,balance,payment_status, member_accounts(account_no,member_name)")
          .neq("payment_status", "Paid")
          .order("payment_month", { ascending: false }),
        supabase
          .from("extra_collections")
          .select("balance,extra_status, member_accounts(account_no,member_name), death_cases(case_no)")
          .neq("extra_status", "Paid"),
        supabase.from("member_accounts").select("area,status"),
        supabase
          .from("member_accounts")
          .select("account_no,member_name,parent:parent_account_id(account_no,member_name)")
          .not("parent_account_id", "is", null)
          .order("account_no"),
        supabase.from("case_expenses").select("category,amount, death_cases(case_no,deceased_name)").order("created_at", { ascending: false }),
      ]);

      if (summaryResult.error) setError(summaryResult.error.message);
      setSummary(summaryResult.data as DashboardSummary | null);
      setPendingPayments(
        (pendingResult.data || []).map((row) => ({
          member: label(row.member_accounts),
          month: String(row.payment_month),
          balance: Number(row.balance),
          status: String(row.payment_status),
        })),
      );
      setPendingExtras(
        (extraResult.data || []).map((row) => ({
          member: label(row.member_accounts),
          case: (row.death_cases as { case_no?: string } | null)?.case_no || "-",
          balance: Number(row.balance),
          status: String(row.extra_status),
        })),
      );
      const byArea = new Map<string, { total: number; active: number }>();
      (membersResult.data || []).forEach((row) => {
        const key = row.area || "No area";
        const value = byArea.get(key) || { total: 0, active: 0 };
        value.total += 1;
        if (row.status === "Active") value.active += 1;
        byArea.set(key, value);
      });
      setAreaRows(Array.from(byArea.entries()).map(([area, value]) => ({ area, total: value.total, active: value.active })));
      setLinkedRows(
        (linkedResult.data || []).map((row) => ({
          son: `${row.account_no} - ${row.member_name}`,
          parent: label(row.parent),
        })),
      );
      setCaseExpenses(
        (expenseResult.data || []).map((row) => ({
          case: (row.death_cases as { case_no?: string; deceased_name?: string } | null)?.case_no || "-",
          deceased: (row.death_cases as { deceased_name?: string } | null)?.deceased_name || "-",
          category: row.category,
          amount: Number(row.amount),
        })),
      );
    }
    load();
  }, [supabase]);

  return (
    <section className="grid">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div className="page-title">
          <h1>Reports</h1>
          <p>Print-friendly committee reports for operations and finance.</p>
        </div>
        <button className="button" onClick={() => window.print()} type="button">
          <Printer size={18} /> Print
        </button>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="metrics-grid">
        <Metric label="Current fund" value={money(summary?.fund_balance)} />
        <Metric label="Monthly collection" value={money(summary?.this_month_collection)} />
        <Metric label="Pending payments" value={money(summary?.pending_monthly)} />
        <Metric label="Pending extra" value={money(summary?.pending_extra)} />
      </div>
      <ReportTable title="Pending Payments Report" columns={["Member", "Month", "Balance", "Status"]} rows={pendingPayments} moneyKeys={["balance"]} />
      <ReportTable title="Extra Collection Pending Report" columns={["Member", "Case", "Balance", "Status"]} rows={pendingExtras} moneyKeys={["balance"]} />
      <ReportTable title="Area-wise Members Report" columns={["Area", "Total", "Active"]} rows={areaRows} />
      <ReportTable title="Married Sons / Parent Linked Members Report" columns={["Son", "Parent"]} rows={linkedRows} />
      <ReportTable title="Death Case Expense Report" columns={["Case", "Deceased", "Category", "Amount"]} rows={caseExpenses} moneyKeys={["amount"]} />
    </section>
  );
}

function label(value: unknown) {
  const item = value as { account_no?: string; member_name?: string } | null;
  return item ? `${item.account_no} - ${item.member_name}` : "-";
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ReportTable({
  title,
  columns,
  rows,
  moneyKeys = [],
}: {
  title: string;
  columns: string[];
  rows: SimpleRow[];
  moneyKeys?: string[];
}) {
  return (
    <div className="table-card">
      <div className="card" style={{ border: 0, boxShadow: "none" }}>
        <h2>{title}</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>No records.</td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => {
                    const key = column.toLowerCase().replaceAll(" ", "_");
                    const compactKey = column.toLowerCase();
                    const value = row[key] ?? row[compactKey] ?? row[column.toLowerCase()];
                    return (
                      <td key={column}>
                        {column === "Status" ? <StatusBadge value={String(value)} /> : moneyKeys.includes(compactKey) ? money(value as number) : String(value ?? "-")}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
