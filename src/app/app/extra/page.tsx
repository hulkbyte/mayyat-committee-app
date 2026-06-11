"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants";
import { money, toNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type CaseOption = {
  id: string;
  case_no: string;
  deceased_name: string;
  shortfall: number;
  per_member_extra: number;
};

type ExtraRow = {
  id: string;
  case_id: string;
  account_id: string;
  extra_due: number;
  extra_paid: number;
  balance: number;
  extra_status: string;
  payment_method: string;
  member_accounts: { account_no: string; member_name: string } | null;
  death_cases: { case_no: string } | null;
};

export default function ExtraCollectionsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [rows, setRows] = useState<ExtraRow[]>([]);
  const [caseId, setCaseId] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<ExtraRow | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [caseResult, extraResult] = await Promise.all([
      supabase.from("death_cases").select("id,case_no,deceased_name,shortfall,per_member_extra").order("created_at", { ascending: false }),
      supabase
        .from("extra_collections")
        .select("*, member_accounts(account_no,member_name), death_cases(case_no)")
        .order("created_at", { ascending: false }),
    ]);
    if (caseResult.error || extraResult.error) setError(caseResult.error?.message || extraResult.error?.message || "Unable to load collections");
    else {
      setCases((caseResult.data || []) as CaseOption[]);
      setRows((extraResult.data || []) as ExtraRow[]);
      if (!caseId && caseResult.data?.[0]) setCaseId(caseResult.data[0].id);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    if (!caseId) return;
    if (!confirm("Generate extra collection rows for every active paying member?")) return;
    const { data, error: rpcError } = await supabase.rpc("generate_extra_collections", { p_case_id: caseId });
    if (rpcError) setError(rpcError.message);
    else {
      setMessage(`Extra collections generated/updated for ${data} active members.`);
      load();
    }
  }

  async function receivePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const fd = new FormData(event.currentTarget);
    const paid = toNumber(fd.get("extra_paid"), editing.extra_paid);
    const { error: updateError } = await supabase
      .from("extra_collections")
      .update({
        extra_paid: paid,
        payment_date: String(fd.get("payment_date") || "") || null,
        payment_method: String(fd.get("payment_method") || "Cash"),
        transaction_ref: String(fd.get("transaction_ref") || "").trim() || null,
        receipt_photo: String(fd.get("receipt_photo") || "").trim() || null,
        notes: String(fd.get("notes") || "").trim() || null,
      })
      .eq("id", editing.id);
    if (updateError) setError(updateError.message);
    else {
      setMessage("Extra collection payment saved.");
      setEditing(null);
      load();
    }
  }

  const visible = rows.filter((row) => (!caseId || row.case_id === caseId) && (!status || row.extra_status === status));
  const totals = visible.reduce(
    (acc, item) => ({
      due: acc.due + Number(item.extra_due),
      paid: acc.paid + Number(item.extra_paid),
      balance: acc.balance + Number(item.balance),
    }),
    { due: 0, paid: 0, balance: 0 },
  );

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Extra Collections</h1>
        <p>Shortfall is divided among active paying member accounts only.</p>
      </div>
      <div className="metrics-grid">
        <Metric label="Extra due" value={money(totals.due)} />
        <Metric label="Extra paid" value={money(totals.paid)} />
        <Metric label="Remaining" value={money(totals.balance)} />
        <Metric label="Rows" value={visible.length} />
      </div>
      <div className="toolbar">
        <select className="select" onChange={(e) => setCaseId(e.target.value)} value={caseId}>
          <option value="">All cases</option>
          {cases.map((item) => (
            <option key={item.id} value={item.id}>
              {item.case_no} - {item.deceased_name} ({money(item.per_member_extra)} each)
            </option>
          ))}
        </select>
        <select className="select" onChange={(e) => setStatus(e.target.value)} value={status}>
          <option value="">All statuses</option>
          {PAYMENT_STATUSES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button className="button" onClick={generate} type="button">
          <RefreshCcw size={18} /> Generate extra collections
        </button>
      </div>
      {message ? <div className="success">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}
      <div className="two-col">
        <div className="table-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Case</th>
                  <th>Due</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.member_accounts?.account_no} - {row.member_accounts?.member_name}
                    </td>
                    <td>{row.death_cases?.case_no}</td>
                    <td>{money(row.extra_due)}</td>
                    <td>{money(row.extra_paid)}</td>
                    <td>{money(row.balance)}</td>
                    <td>
                      <StatusBadge value={row.extra_status} />
                    </td>
                    <td>
                      <button className="button secondary" onClick={() => setEditing(row)} type="button">
                        Receive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <form className="card" onSubmit={receivePayment}>
          <h2>Receive extra payment</h2>
          {editing ? (
            <>
              <div className="notice">
                {editing.member_accounts?.account_no} - {editing.member_accounts?.member_name}
                <br />
                Due: {money(editing.extra_due)}
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Extra paid</span>
                  <input className="input" name="extra_paid" required type="number" defaultValue={editing.extra_paid || editing.extra_due} />
                </label>
                <label className="field">
                  <span>Payment date</span>
                  <input className="input" name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                </label>
                <label className="field">
                  <span>Method</span>
                  <select className="select" name="payment_method" defaultValue={editing.payment_method || "Cash"}>
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Transaction ref</span>
                  <input className="input" name="transaction_ref" />
                </label>
                <label className="field full">
                  <span>Receipt photo URL</span>
                  <input className="input" name="receipt_photo" />
                </label>
                <label className="field full">
                  <span>Notes</span>
                  <textarea className="textarea" name="notes" />
                </label>
              </div>
              <button className="button" type="submit">
                <Save size={18} /> Save extra payment
              </button>
            </>
          ) : (
            <div className="notice">Choose Receive on a member row.</div>
          )}
        </form>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
