"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants";
import { dateOnly, money, monthValue, toNumber } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { MemberOption } from "@/lib/types";

type PaymentMemberOption = MemberOption & {
  status: string;
};

type PaymentRow = {
  id: string;
  account_id: string;
  payment_month: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  payment_status: string;
  payment_date: string | null;
  payment_method: string;
  transaction_ref: string | null;
  receipt_photo: string | null;
  notes: string | null;
  member_accounts: { account_no: string; member_name: string } | null;
};

type SettingsRow = {
  default_monthly_fee: number;
  pending_monthly_fee?: number | null;
  pending_monthly_fee_effective_month?: string | null;
};

export default function PaymentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useLanguage();
  const [members, setMembers] = useState<PaymentMemberOption[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [memberId, setMemberId] = useState("");
  const [month, setMonth] = useState(monthValue());
  const [paymentMonth, setPaymentMonth] = useState(monthValue());
  const [amountDue, setAmountDue] = useState("200");
  const [amountPaid, setAmountPaid] = useState("200");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [transactionRef, setTransactionRef] = useState("");
  const [receiptPhoto, setReceiptPhoto] = useState("");
  const [notes, setNotes] = useState("");
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const [memberResult, settingsResult] = await Promise.all([
      supabase.from("member_accounts").select("id,account_no,member_name,wife_name,marital_status,monthly_fee,status").order("account_no"),
      supabase.from("settings").select("*").limit(1).single(),
    ]);
    let paymentQuery = supabase
      .from("monthly_payments")
      .select("*, member_accounts(account_no,member_name)")
      .order("payment_month", { ascending: false });
    if (month) paymentQuery = paymentQuery.gte("payment_month", month).lt("payment_month", nextMonth(month));
    if (status) paymentQuery = paymentQuery.eq("payment_status", status);
    const paymentResult = await paymentQuery;

    if (memberResult.error || paymentResult.error) setError(memberResult.error?.message || paymentResult.error?.message || "Unable to load payments");
    else {
      setMembers((memberResult.data || []) as PaymentMemberOption[]);
      if (!settingsResult.error) setSettings(settingsResult.data as SettingsRow);
      setPayments((paymentResult.data || []) as PaymentRow[]);
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
  }, [month, status]);

  useEffect(() => {
    if (editingPayment) return;
    const selected = members.find((item) => item.id === memberId);
    const due = calculateDue(selected, settings, paymentMonth);
    setAmountDue(String(due));
    setAmountPaid(String(due));
  }, [editingPayment, memberId, members, paymentMonth, settings]);

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const fd = new FormData(event.currentTarget);
    const selected = members.find((item) => item.id === String(fd.get("account_id")));
    const payload = {
      account_id: String(fd.get("account_id")),
      payment_month: paymentMonth,
      amount_due: toNumber(fd.get("amount_due"), selected?.monthly_fee || 200),
      amount_paid: toNumber(fd.get("amount_paid"), 0),
      payment_date: paymentDate || null,
      payment_method: paymentMethod,
      transaction_ref: transactionRef.trim() || null,
      receipt_photo: receiptPhoto.trim() || null,
      notes: notes.trim() || null,
    };
    const request = editingPayment
      ? supabase.from("monthly_payments").update(payload).eq("id", editingPayment.id)
      : supabase.from("monthly_payments").upsert(payload, { onConflict: "account_id,payment_month" });
    const { error: saveError } = await request;
    if (saveError) setError(saveError.message);
    else {
      setMessage(editingPayment ? "Monthly payment corrected." : t("monthlyPaymentSaved"));
      load();
      resetForm();
    }
  }

  function editPayment(payment: PaymentRow) {
    setEditingPayment(payment);
    setMemberId(payment.account_id);
    setPaymentMonth(payment.payment_month);
    setAmountDue(String(payment.amount_due));
    setAmountPaid(String(payment.amount_paid));
    setPaymentDate(payment.payment_date || new Date().toISOString().slice(0, 10));
    setPaymentMethod(payment.payment_method || "Cash");
    setTransactionRef(payment.transaction_ref || "");
    setReceiptPhoto(payment.receipt_photo || "");
    setNotes(payment.notes || "");
    setError("");
    setMessage("");
  }

  function resetForm() {
    setEditingPayment(null);
    setMemberId("");
    setPaymentMonth(monthValue());
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("Cash");
    setTransactionRef("");
    setReceiptPhoto("");
    setNotes("");
  }

  async function deletePayment(payment: PaymentRow) {
    const label = `${payment.member_accounts?.account_no || ""} - ${payment.member_accounts?.member_name || "member"}`;
    if (!confirm(`Delete monthly payment for ${label}?\n\nThis will also remove its linked fund ledger entry.`)) return;

    setError("");
    setMessage("");
    const { error: deleteError } = await supabase.from("monthly_payments").delete().eq("id", payment.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingPayment?.id === payment.id) resetForm();
    setMessage("Monthly payment deleted.");
    load();
  }

  const selectedMember = members.find((member) => member.id === memberId);
  const paidAccountIds = new Set(payments.filter((payment) => payment.payment_status === "Paid").map((payment) => payment.account_id));
  const unpaidActiveMembers = members.filter((member) => member.status === "Active" && !paidAccountIds.has(member.id));
  const filtered = payments.filter((payment) => {
    if (!query) return true;
    const haystack = `${payment.member_accounts?.account_no} ${payment.member_accounts?.member_name}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const totals = filtered.reduce(
    (acc, item) => ({
      due: acc.due + Number(item.amount_due),
      paid: acc.paid + Number(item.amount_paid),
      pending: acc.pending + Number(item.balance),
    }),
    { due: 0, paid: 0, pending: 0 },
  );

  return (
    <section className="grid">
      <div className="page-title">
        <h1>{t("monthlyPayments")}</h1>
        <p>{t("paymentsSubtitle")}</p>
      </div>
      <div className="metrics-grid">
        <Metric label={t("totalDue")} value={money(totals.due)} />
        <Metric label={t("totalPaid")} value={money(totals.paid)} />
        <Metric label={t("pending")} value={money(totals.pending)} />
        <Metric label={t("records")} value={filtered.length} />
      </div>
      <div className="card soft-panel">
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Payment month</h2>
            <p className="muted-text">Showing records for {month.slice(0, 7)}. Unpaid list includes active members without a paid record for this month.</p>
          </div>
          <strong>{unpaidActiveMembers.length} unpaid active</strong>
        </div>
        {unpaidActiveMembers.length > 0 ? (
          <div className="compact-list">
            {unpaidActiveMembers.slice(0, 8).map((member) => (
              <button
                className="mini-pill"
                key={member.id}
                onClick={() => {
                  setMemberId(member.id);
                  setPaymentMonth(month);
                }}
                type="button"
              >
                {member.account_no} - {member.member_name}
              </button>
            ))}
            {unpaidActiveMembers.length > 8 ? <span className="mini-pill muted-pill">+{unpaidActiveMembers.length - 8} more</span> : null}
          </div>
        ) : (
          <div className="notice compact-notice">All active members are paid for this month.</div>
        )}
      </div>
      <div className="two-col">
        <div className="table-card">
          <div className="card" style={{ border: 0, boxShadow: "none" }}>
            <div className="toolbar">
              <Search size={18} />
              <input className="input" onChange={(e) => setQuery(e.target.value)} placeholder={t("searchAccountMember")} value={query} />
              <input className="input" onChange={(e) => setMonth(`${e.target.value}-01`)} type="month" value={month.slice(0, 7)} />
              <select className="select" onChange={(e) => setStatus(e.target.value)} value={status}>
                <option value="">{t("allStatuses")}</option>
                {PAYMENT_STATUSES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>
          {filtered.length === 0 ? (
            <EmptyState title={t("noPaymentsFound")} />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("member")}</th>
                    <th>{t("month")}</th>
                    <th>{t("due")}</th>
                    <th>{t("paid")}</th>
                    <th>{t("balance")}</th>
                    <th>{t("status")}</th>
                    <th>{t("method")}</th>
                    <th>Correction</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        {payment.member_accounts?.account_no} - {payment.member_accounts?.member_name}
                      </td>
                      <td>{dateOnly(payment.payment_month)}</td>
                      <td>{money(payment.amount_due)}</td>
                      <td>{money(payment.amount_paid)}</td>
                      <td>{money(payment.balance)}</td>
                      <td>
                        <StatusBadge value={payment.payment_status} />
                      </td>
                      <td>{payment.payment_method}</td>
                      <td>
                        <div className="toolbar">
                          <button className="icon-button" onClick={() => editPayment(payment)} title="Edit payment" type="button">
                            <Pencil size={17} />
                          </button>
                          {isAdmin ? (
                            <button className="icon-button danger-icon" onClick={() => deletePayment(payment)} title="Delete payment" type="button">
                              <Trash2 size={17} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <form className="card" onSubmit={savePayment}>
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <h2>{editingPayment ? "Correct monthly payment" : t("addMonthlyPayment")}</h2>
            {editingPayment ? (
              <button className="button secondary" onClick={resetForm} type="button">
                <X size={16} /> Cancel
              </button>
            ) : (
              <button className="button secondary" onClick={resetForm} type="button">
                <Plus size={16} /> New
              </button>
            )}
          </div>
          {editingPayment ? <p className="notice">Editing updates the payment and replaces its ledger entry, so fund balance stays correct.</p> : null}
          <div className="form-grid">
            <label className="field full">
              <span>{t("memberAccount")}</span>
              <select className="select" name="account_id" onChange={(e) => setMemberId(e.target.value)} required value={memberId}>
                <option value="">{t("selectMember")}</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.account_no} - {member.member_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("paymentMonth")}</span>
              <input className="input" name="payment_month" required type="date" value={paymentMonth} onChange={(event) => setPaymentMonth(event.target.value)} />
            </label>
            <label className="field">
              <span>{t("amountDue")}</span>
              <input className="input" name="amount_due" required type="number" value={amountDue} onChange={(event) => setAmountDue(event.target.value)} />
            </label>
            <label className="field">
              <span>{t("amountPaid")}</span>
              <input className="input" name="amount_paid" required type="number" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} />
            </label>
            <label className="field">
              <span>{t("paymentDate")}</span>
              <input className="input" name="payment_date" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
            </label>
            <label className="field">
              <span>{t("method")}</span>
              <select className="select" name="payment_method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("transactionRef")}</span>
              <input className="input" name="transaction_ref" value={transactionRef} onChange={(event) => setTransactionRef(event.target.value)} />
            </label>
            <label className="field">
              <span>{t("receiptPhotoUrl")}</span>
              <input className="input" name="receipt_photo" placeholder={t("uploadUrlPath")} value={receiptPhoto} onChange={(event) => setReceiptPhoto(event.target.value)} />
            </label>
            <label className="field full">
              <span>{t("notes")}</span>
              <textarea className="textarea" name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </div>
          {message ? <div className="success">{message}</div> : null}
          {error ? <div className="error">{error}</div> : null}
          <button className="button" type="submit">
            <Save size={18} /> {editingPayment ? "Save correction" : t("savePayment")}
          </button>
        </form>
      </div>
    </section>
  );
}

function calculateDue(member: MemberOption | undefined, settings: SettingsRow | null, paymentMonth: string) {
  const memberFee = Number(member?.monthly_fee || settings?.default_monthly_fee || 200);
  const pendingFee = Number(settings?.pending_monthly_fee || 0);
  const effectiveMonth = settings?.pending_monthly_fee_effective_month;

  if (pendingFee > 0 && effectiveMonth && monthStart(paymentMonth) >= monthStart(effectiveMonth)) {
    return pendingFee;
  }

  return memberFee;
}

function monthStart(value: string) {
  return value.slice(0, 7);
}

function nextMonth(month: string) {
  const date = new Date(month);
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
