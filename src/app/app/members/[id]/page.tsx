"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { dateOnly, money } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { MemberAccount } from "@/lib/types";

type MemberDetail = MemberAccount & {
  parent?: { account_no: string; member_name: string } | null;
};

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [children, setChildren] = useState<MemberAccount[]>([]);
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [extras, setExtras] = useState<Record<string, unknown>[]>([]);
  const [cases, setCases] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const [memberResult, childrenResult, paymentResult, extraResult, caseResult] = await Promise.all([
        supabase.from("member_accounts").select("*, parent:parent_account_id(account_no,member_name)").eq("id", id).single(),
        supabase.from("member_accounts").select("*").eq("parent_account_id", id).order("account_no"),
        supabase.from("monthly_payments").select("*").eq("account_id", id).order("payment_month", { ascending: false }),
        supabase.from("extra_collections").select("*, death_cases(case_no)").eq("account_id", id).order("created_at", { ascending: false }),
        supabase.from("death_cases").select("*").eq("account_id", id).order("created_at", { ascending: false }),
      ]);

      if (memberResult.error) setError(memberResult.error.message);
      else setMember(memberResult.data as MemberDetail);
      setChildren((childrenResult.data || []) as MemberAccount[]);
      setPayments(paymentResult.data || []);
      setExtras(extraResult.data || []);
      setCases(caseResult.data || []);
    }

    load();
  }, [id, supabase]);

  if (error) return <div className="error">{error}</div>;
  if (!member) return <div className="notice">Loading member...</div>;

  return (
    <section className="grid">
      <div className="toolbar">
        <Link className="icon-button" href="/app/members" title="Back to members">
          <ArrowLeft size={18} />
        </Link>
        <div className="page-title">
          <h1>
            {member.account_no} - {member.member_name}
          </h1>
          <p>Member detail, family coverage, payments, extra collections, and cases.</p>
        </div>
      </div>
      <div className="two-col">
        <div className="card">
          <h2>Account details</h2>
          <div className="detail-grid">
            <Detail label="AccountNo" value={member.account_no} />
            <Detail label="Public lookup PIN" value={member.public_pin || "-"} />
            <Detail label="Status" value={<StatusBadge value={member.status} />} />
            <Detail label="Father" value={member.father_name || "-"} />
            <Detail label="Phone" value={member.phone || "-"} />
            <Detail label="Address" value={member.address || "-"} />
            <Detail label="Area" value={member.area || "-"} />
            <Detail label="Join date" value={dateOnly(member.join_date)} />
            <Detail label="Monthly fee" value={money(member.monthly_fee)} />
            <Detail label="Marital status" value={member.marital_status} />
            <Detail label="Wife" value={member.wife_name || "-"} />
            <Detail label="Parent member" value={member.parent ? `${member.parent.member_name} (${member.parent.account_no})` : "-"} />
            <Detail label="Opening balance" value={money(member.opening_balance)} />
          </div>
        </div>
        <div className="card">
          <h2>Family coverage</h2>
          <div className="detail-item">
            <strong>{member.member_name}</strong>
            {member.wife_name ? <p>Wife: {member.wife_name}</p> : <p>No wife recorded for coverage.</p>}
          </div>
          <h3>Married sons / linked member accounts</h3>
          {children.length === 0 ? <div className="notice">No linked child accounts.</div> : null}
          {children.map((child) => (
            <Link className="detail-item" href={`/app/members/${child.id}`} key={child.id}>
              {child.member_name}, AccountNo {child.account_no}
            </Link>
          ))}
        </div>
      </div>
      <HistoryTable
        title="Payment history"
        columns={["Month", "Due", "Paid", "Balance", "Status"]}
        rows={payments.map((payment) => [
          dateOnly(payment.payment_month as string),
          money(payment.amount_due as number),
          money(payment.amount_paid as number),
          money(payment.balance as number),
          <StatusBadge key="s" value={payment.payment_status as string} />,
        ])}
      />
      <HistoryTable
        title="Extra collection history"
        columns={["Case", "Due", "Paid", "Balance", "Status"]}
        rows={extras.map((extra) => [
          ((extra.death_cases as { case_no?: string } | null)?.case_no || "-") as string,
          money(extra.extra_due as number),
          money(extra.extra_paid as number),
          money(extra.balance as number),
          <StatusBadge key="s" value={extra.extra_status as string} />,
        ])}
      />
      <HistoryTable
        title="Death cases linked to this account"
        columns={["Case", "Deceased", "Type", "Expenses", "Status"]}
        rows={cases.map((item) => [
          item.case_no as string,
          item.deceased_name as string,
          item.deceased_type as string,
          money(item.total_expense as number),
          <StatusBadge key="s" value={item.case_status as string} />,
        ])}
      />
    </section>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-item">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value}</div>
    </div>
  );
}

function HistoryTable({ title, columns, rows }: { title: string; columns: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="table-card">
      <div className="card" style={{ border: 0, boxShadow: "none" }}>
        <h2>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">No records yet.</div>
      ) : (
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
              {rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
