"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { money, dateOnly, toNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type LedgerRow = {
  id: string;
  transaction_date: string;
  transaction_type: string;
  source_type: string;
  description: string;
  in_amount: number;
  out_amount: number;
  payment_method: string | null;
  member_accounts: { account_no: string; member_name: string } | null;
  death_cases: { case_no: string } | null;
};

export default function LedgerPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [source, setSource] = useState("");
  const [editingOpening, setEditingOpening] = useState<LedgerRow | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    let query = supabase
      .from("fund_ledger")
      .select("*, member_accounts(account_no,member_name), death_cases(case_no)")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (source) query = query.eq("source_type", source);
    const { data, error: loadError } = await query;
    if (loadError) setError(loadError.message);
    else setRows((data || []) as LedgerRow[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  async function saveOpening(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const fd = new FormData(event.currentTarget);
    const payload = {
      transaction_date: String(fd.get("transaction_date")),
      transaction_type: "In",
      source_type: "Opening Balance",
      description: String(fd.get("description") || "Opening fund balance"),
      in_amount: toNumber(fd.get("in_amount"), 0),
      out_amount: 0,
      payment_method: "Cash",
    };

    const request = editingOpening
      ? supabase.from("fund_ledger").update(payload).eq("id", editingOpening.id).eq("source_type", "Opening Balance")
      : supabase.from("fund_ledger").insert(payload);
    const { error: saveError } = await request;

    if (saveError) setError(saveError.message);
    else {
      setMessage(editingOpening ? "Opening balance updated." : "Opening balance added.");
      setEditingOpening(null);
      event.currentTarget.reset();
      load();
    }
  }

  async function deleteOpening(row: LedgerRow) {
    if (!confirm(`Delete opening balance entry of ${money(row.in_amount)}?`)) return;
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase.from("fund_ledger").delete().eq("id", row.id).eq("source_type", "Opening Balance");
    if (deleteError) setError(deleteError.message);
    else {
      setMessage("Opening balance deleted.");
      if (editingOpening?.id === row.id) setEditingOpening(null);
      load();
    }
  }

  const balance = rows.reduce((acc, row) => acc + Number(row.in_amount) - Number(row.out_amount), 0);
  const totalIn = rows.reduce((acc, row) => acc + Number(row.in_amount), 0);
  const totalOut = rows.reduce((acc, row) => acc + Number(row.out_amount), 0);

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Fund Ledger</h1>
        <p>Current fund is calculated as total in minus total out. No donations or adjustments are included.</p>
      </div>
      <div className="metrics-grid">
        <Metric label="Current balance" value={money(balance)} />
        <Metric label="Total in" value={money(totalIn)} />
        <Metric label="Total out" value={money(totalOut)} />
        <Metric label="Entries" value={rows.length} />
      </div>
      <div className="toolbar">
        <select className="select" onChange={(e) => setSource(e.target.value)} value={source}>
          <option value="">All sources</option>
          <option>Opening Balance</option>
          <option>Monthly Payment</option>
          <option>Extra Collection</option>
          <option>Death Expense</option>
        </select>
      </div>
      {message ? <div className="success">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}
      <div className="two-col">
        <div className="table-card">
          {rows.length === 0 ? (
            <EmptyState title="No ledger entries yet" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Member</th>
                    <th>Case</th>
                    <th>Description</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Correction</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{dateOnly(row.transaction_date)}</td>
                      <td>{row.transaction_type}</td>
                      <td>{row.source_type}</td>
                      <td>{row.member_accounts ? `${row.member_accounts.account_no} - ${row.member_accounts.member_name}` : "-"}</td>
                      <td>{row.death_cases?.case_no || "-"}</td>
                      <td>{row.description}</td>
                      <td>{money(row.in_amount)}</td>
                      <td>{money(row.out_amount)}</td>
                      <td>
                        {row.source_type === "Opening Balance" ? (
                          <div className="toolbar">
                            <button className="icon-button" onClick={() => setEditingOpening(row)} title="Edit opening balance" type="button">
                              <Pencil size={17} />
                            </button>
                            <button className="icon-button danger-icon" onClick={() => deleteOpening(row)} title="Delete opening balance" type="button">
                              <Trash2 size={17} />
                            </button>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <form className="card" key={editingOpening?.id || "new-opening"} onSubmit={saveOpening}>
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <h2>{editingOpening ? "Edit opening balance" : "Opening balance"}</h2>
            {editingOpening ? (
              <button className="icon-button" onClick={() => setEditingOpening(null)} title="Cancel edit" type="button">
                <X size={17} />
              </button>
            ) : null}
          </div>
          <p className="notice">Admin can add, edit, or delete opening balance rows. Other ledger rows remain locked to their source records.</p>
          <div className="form-grid">
            <label className="field">
              <span>Date</span>
              <input className="input" name="transaction_date" required type="date" defaultValue={editingOpening?.transaction_date || new Date().toISOString().slice(0, 10)} />
            </label>
            <label className="field">
              <span>Amount</span>
              <input className="input" name="in_amount" required type="number" defaultValue={editingOpening?.in_amount || ""} />
            </label>
            <label className="field full">
              <span>Description</span>
              <input className="input" name="description" defaultValue={editingOpening?.description || "Opening fund balance"} />
            </label>
          </div>
          <button className="button" type="submit">
            <Save size={18} /> {editingOpening ? "Update opening balance" : "Add opening balance"}
          </button>
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
