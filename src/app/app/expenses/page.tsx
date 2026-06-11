"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { dateOnly, money, toNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type CaseOption = {
  id: string;
  case_no: string;
  deceased_name: string;
  case_status: string;
};

type Expense = {
  id: string;
  case_id: string;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  paid_by: string | null;
  receipt_photo: string | null;
  notes: string | null;
  death_cases: { case_no: string; deceased_name: string } | null;
};

export default function ExpensesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [caseId, setCaseId] = useState("");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [caseResult, expenseResult] = await Promise.all([
      supabase.from("death_cases").select("id,case_no,deceased_name,case_status").order("created_at", { ascending: false }),
      supabase
        .from("case_expenses")
        .select("*, death_cases(case_no,deceased_name)")
        .order("expense_date", { ascending: false }),
    ]);
    if (caseResult.error || expenseResult.error) setError(caseResult.error?.message || expenseResult.error?.message || "Unable to load expenses");
    else {
      setCases((caseResult.data || []) as CaseOption[]);
      setExpenses((expenseResult.data || []) as Expense[]);
      if (!caseId && caseResult.data?.[0]) setCaseId(caseResult.data[0].id);
    }
  }

  async function loadRole() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const { data } = await supabase.from("users").select("role").eq("id", authData.user.id).single();
    setIsAdmin(data?.role === "admin");
  }

  useEffect(() => {
    load();
    loadRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const fd = new FormData(event.currentTarget);
    const payload = {
      case_id: String(fd.get("case_id")),
      expense_date: String(fd.get("expense_date")),
      category: String(fd.get("category")),
      description: String(fd.get("description") || "").trim() || null,
      amount: toNumber(fd.get("amount"), 0),
      paid_by: String(fd.get("paid_by") || "").trim() || null,
      receipt_photo: String(fd.get("receipt_photo") || "").trim() || null,
      notes: String(fd.get("notes") || "").trim() || null,
    };
    const request = editingExpense
      ? supabase.from("case_expenses").update(payload).eq("id", editingExpense.id)
      : supabase.from("case_expenses").insert(payload);
    const { error: saveError } = await request;
    if (saveError) setError(saveError.message);
    else {
      setMessage(editingExpense ? "Expense corrected and case totals recalculated." : "Expense added and case totals recalculated.");
      setEditingExpense(null);
      event.currentTarget.reset();
      load();
    }
  }

  async function deleteExpense(expense: Expense) {
    if (!confirm(`Delete expense ${expense.category} - ${money(expense.amount)}?\n\nThis will also remove its ledger entry and recalculate the case totals.`)) return;
    setError("");
    setMessage("");
    const { error: deleteError } = await supabase.from("case_expenses").delete().eq("id", expense.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (editingExpense?.id === expense.id) setEditingExpense(null);
    setMessage("Expense deleted and case totals recalculated.");
    load();
  }

  const visible = caseId ? expenses.filter((item) => item.case_id === caseId) : expenses;
  const totals = visible.reduce((acc, item) => acc + Number(item.amount), 0);
  const categoryTotals = EXPENSE_CATEGORIES.map((category) => ({
    category,
    total: visible.filter((item) => item.category === category).reduce((acc, item) => acc + Number(item.amount), 0),
  })).filter((item) => item.total > 0);

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Case Expenses</h1>
        <p>Expense entries create outgoing fund ledger records and recalculate shortfall.</p>
      </div>
      <div className="metrics-grid">
        <article className="metric-card">
          <span>Grand total</span>
          <strong>{money(totals)}</strong>
        </article>
        {categoryTotals.slice(0, 3).map((item) => (
          <article className="metric-card" key={item.category}>
            <span>{item.category}</span>
            <strong>{money(item.total)}</strong>
          </article>
        ))}
      </div>
      <div className="two-col">
        <div className="table-card">
          <div className="card" style={{ border: 0, boxShadow: "none" }}>
            <label className="field">
              <span>Filter case</span>
              <select className="select" onChange={(e) => setCaseId(e.target.value)} value={caseId}>
                <option value="">All cases</option>
                {cases.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.case_no} - {item.deceased_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Paid by</th>
                  <th>Amount</th>
                  <th>Correction</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <td>{item.death_cases?.case_no}</td>
                    <td>{dateOnly(item.expense_date)}</td>
                    <td>{item.category}</td>
                    <td>{item.description || "-"}</td>
                    <td>{item.paid_by || "-"}</td>
                    <td>{money(item.amount)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="action-button" onClick={() => setEditingExpense(item)} type="button">
                          <Pencil size={15} />
                          Edit
                        </button>
                        {isAdmin ? (
                          <button className="action-button danger-action" onClick={() => deleteExpense(item)} type="button">
                            <Trash2 size={15} />
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-list">
            {visible.map((item) => (
              <div className="list-card" key={item.id}>
                <div className="toolbar" style={{ justifyContent: "space-between" }}>
                  <strong>
                    {item.death_cases?.case_no} - {item.category}
                  </strong>
                  <strong>{money(item.amount)}</strong>
                </div>
                <small>
                  {dateOnly(item.expense_date)} - Paid by {item.paid_by || "-"} - {item.description || "No description"}
                </small>
                <div className="row-actions">
                  <button className="action-button" onClick={() => setEditingExpense(item)} type="button">
                    <Pencil size={15} />
                    Edit
                  </button>
                  {isAdmin ? (
                    <button className="action-button danger-action" onClick={() => deleteExpense(item)} type="button">
                      <Trash2 size={15} />
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
        <form className="card" key={editingExpense?.id || "new-expense"} onSubmit={saveExpense}>
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <h2>{editingExpense ? "Correct expense" : "Add expense"}</h2>
            {editingExpense ? (
              <button className="button secondary" onClick={() => setEditingExpense(null)} type="button">
                <X size={16} /> Cancel
              </button>
            ) : (
              <button className="button secondary" onClick={() => setEditingExpense(null)} type="button">
                <Plus size={16} /> New
              </button>
            )}
          </div>
          {editingExpense ? <p className="notice">Editing updates the expense ledger entry and recalculates the death case shortfall.</p> : null}
          <div className="form-grid">
            <label className="field full">
              <span>Death case</span>
              <select className="select" name="case_id" required defaultValue={editingExpense?.case_id || caseId || cases[0]?.id}>
                {cases.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.case_no} - {item.deceased_name} ({item.case_status})
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Date</span>
              <input className="input" name="expense_date" required type="date" defaultValue={editingExpense?.expense_date || new Date().toISOString().slice(0, 10)} />
            </label>
            <label className="field">
              <span>Category</span>
              <select className="select" name="category" defaultValue={editingExpense?.category || "Kafan"}>
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Amount</span>
              <input className="input" name="amount" required type="number" defaultValue={editingExpense?.amount || ""} />
            </label>
            <label className="field">
              <span>Paid by</span>
              <input className="input" name="paid_by" defaultValue={editingExpense?.paid_by || ""} />
            </label>
            <label className="field full">
              <span>Description</span>
              <input className="input" name="description" defaultValue={editingExpense?.description || ""} />
            </label>
            <label className="field full">
              <span>Receipt photo URL</span>
              <input className="input" name="receipt_photo" defaultValue={editingExpense?.receipt_photo || ""} />
            </label>
            <label className="field full">
              <span>Notes</span>
              <textarea className="textarea" name="notes" defaultValue={editingExpense?.notes || ""} />
            </label>
          </div>
          {message ? <div className="success">{message}</div> : null}
          {error ? <div className="error">{error}</div> : null}
          <button className="button" type="submit">
            <Save size={18} /> {editingExpense ? "Save correction" : "Save expense"}
          </button>
        </form>
      </div>
      <div className="card">
        <h2>Expense total by category</h2>
        <div className="detail-grid">
          {categoryTotals.map((item) => (
            <div className="detail-item" key={item.category}>
              <div className="detail-label">{item.category}</div>
              <div className="detail-value">{money(item.total)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
