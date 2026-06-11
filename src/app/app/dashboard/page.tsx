"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Banknote, Clock, HeartHandshake, Users, WalletCards } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { money } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { DashboardSummary } from "@/lib/types";

type OpenCase = {
  case_no: string;
  deceased_name: string;
  total_expense: number;
  shortfall: number;
  per_member_extra: number;
  case_status: string;
};

type RecentLedger = {
  id: string;
  transaction_date: string;
  source_type: string;
  description: string;
  in_amount: number;
  out_amount: number;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [cases, setCases] = useState<OpenCase[]>([]);
  const [recentLedger, setRecentLedger] = useState<RecentLedger[]>([]);
  const [error, setError] = useState("");
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function load() {
      const [{ data: summaryData, error: summaryError }, { data: caseData, error: caseError }, { data: ledgerData, error: ledgerError }] = await Promise.all([
        supabase.from("dashboard_summary").select("*").single(),
        supabase
          .from("death_cases")
          .select("case_no,deceased_name,total_expense,shortfall,per_member_extra,case_status")
          .neq("case_status", "Closed")
          .order("created_at", { ascending: false })
          .limit(4),
        supabase
          .from("fund_ledger")
          .select("id,transaction_date,source_type,description,in_amount,out_amount")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (summaryError || caseError || ledgerError) setError(summaryError?.message || caseError?.message || ledgerError?.message || "Unable to load dashboard");
      setSummary(summaryData as DashboardSummary | null);
      setCases((caseData || []) as OpenCase[]);
      setRecentLedger((ledgerData || []) as RecentLedger[]);
    }

    load();
  }, [supabase]);

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Dashboard</h1>
        <p>Fund, collections, active members, and open case totals.</p>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="dashboard-hero">
        <article>
          <span>Current fund</span>
          <strong>{money(summary?.fund_balance)}</strong>
          <small>Calculated from fund ledger</small>
        </article>
        <article>
          <span>This month</span>
          <strong>{money(summary?.this_month_collection)}</strong>
          <small>Monthly payments only</small>
        </article>
        <article>
          <span>Active members</span>
          <strong>{summary?.active_members ?? 0}</strong>
          <small>Included in collection and shortfall</small>
        </article>
      </div>
      <div className="metrics-grid">
        <MetricCard label="Active members" value={summary?.active_members ?? 0} />
        <MetricCard label="Inactive members" value={summary?.inactive_members ?? 0} />
        <MetricCard label="Suspended" value={summary?.suspended_members ?? 0} />
        <MetricCard label="Current fund" value={money(summary?.fund_balance)} />
        <MetricCard label="This month" value={money(summary?.this_month_collection)} />
        <MetricCard label="Pending monthly" value={money(summary?.pending_monthly)} />
        <MetricCard label="Open cases" value={summary?.open_cases ?? 0} />
        <MetricCard label="Pending extra" value={money(summary?.pending_extra)} />
      </div>
      <div className="metrics-grid">
        <MetricCard label="Active case expenses" value={money(summary?.active_case_expenses)} sub="Open cases only" />
        <MetricCard label="Current shortfall" value={money(summary?.current_shortfall)} sub="Against fund before case" />
        <MetricCard label="Per member extra" value={money(summary?.per_member_extra)} sub="Active paying members only" />
        <MetricCard label="Ledger basis" value="Fund ledger" sub="In minus out" />
      </div>
      <div className="two-col">
        <div className="card">
          <h2>Open death cases</h2>
          <div className="grid">
            {cases.length === 0 ? <div className="notice">No open death case right now.</div> : null}
            {cases.map((item) => (
              <div className="detail-item" key={item.case_no}>
                <div className="toolbar" style={{ justifyContent: "space-between" }}>
                  <strong>
                    {item.case_no} - {item.deceased_name}
                  </strong>
                  <StatusBadge value={item.case_status} />
                </div>
                <div className="detail-grid">
                  <Detail icon={<WalletCards size={16} />} label="Expenses" value={money(item.total_expense)} />
                  <Detail icon={<AlertTriangle size={16} />} label="Shortfall" value={money(item.shortfall)} />
                  <Detail icon={<Users size={16} />} label="Extra/member" value={money(item.per_member_extra)} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Recent activity</h2>
          <div className="grid">
            {recentLedger.length === 0 ? <div className="notice">No ledger activity yet.</div> : null}
            {recentLedger.map((item) => (
              <div className="detail-item" key={item.id}>
                <div className="toolbar" style={{ justifyContent: "space-between" }}>
                  <span className="detail-label">{item.source_type}</span>
                  <strong>{Number(item.in_amount) > 0 ? money(item.in_amount) : `-${money(item.out_amount)}`}</strong>
                </div>
                <div className="toolbar">
                  <Clock size={15} />
                  <small>{item.transaction_date}</small>
                </div>
                <div className="detail-value">{item.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <h2>Operating rules</h2>
        <div className="detail-grid">
          <Detail icon={<Users size={16} />} label="Paying account" value="Every active paying member has one account." />
          <Detail icon={<HeartHandshake size={16} />} label="Wife coverage" value="Wife is covered from member account, never separate row." />
          <Detail icon={<Activity size={16} />} label="Married sons" value="Separate account linked to father account." />
          <Detail icon={<Banknote size={16} />} label="Shortfall" value="Divided only across active paying members." />
        </div>
      </div>
    </section>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="detail-item">
      <div className="toolbar">
        {icon}
        <span className="detail-label">{label}</span>
      </div>
      <div className="detail-value">{value}</div>
    </div>
  );
}
