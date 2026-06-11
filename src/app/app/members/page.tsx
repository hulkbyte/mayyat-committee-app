"use client";

import Link from "next/link";
import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { MEMBER_STATUSES } from "@/lib/constants";
import { dateOnly, money, toNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { MemberAccount } from "@/lib/types";

type MemberRow = MemberAccount & {
  parent?: { account_no: string; member_name: string } | null;
};

function makeEmptyForm(monthlyFee = 200, accountNo = "") {
  return {
    id: "",
    account_no: accountNo,
    member_name: "",
    father_name: "",
    parent_account_id: "",
    phone: "",
    address: "",
    area: "",
    join_date: new Date().toISOString().slice(0, 10),
    monthly_fee: String(monthlyFee),
    marital_status: "Single",
    wife_name: "",
    status: "Active",
    opening_balance: "0",
    notes: "",
  };
}

type MemberForm = ReturnType<typeof makeEmptyForm>;

function nextAccountNoFromRows(rows: Array<{ account_no: string | null }>) {
  const max = rows.reduce((largest, row) => {
    const parsed = Number(String(row.account_no || "").replace(/\D/g, ""));
    return Number.isFinite(parsed) && parsed > largest ? parsed : largest;
  }, 0);

  return String(max + 1).padStart(6, "0");
}

export default function MembersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [defaultFee, setDefaultFee] = useState(200);
  const [nextAccountNo, setNextAccountNo] = useState("000001");
  const [form, setForm] = useState<MemberForm>(makeEmptyForm());
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [marital, setMarital] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadMembers() {
    let builder = supabase
      .from("member_accounts")
      .select("*, parent:parent_account_id(account_no,member_name)")
      .order("account_no");

    if (query) builder = builder.or(`account_no.ilike.%${query}%,member_name.ilike.%${query}%`);
    if (area) builder = builder.eq("area", area);
    if (status) builder = builder.eq("status", status);
    if (marital) builder = builder.eq("marital_status", marital);

    const [memberResult, settingsResult, accountResult] = await Promise.all([
      builder,
      supabase.from("settings").select("*").limit(1).single(),
      supabase.from("member_accounts").select("account_no"),
    ]);
    if (memberResult.error) setError(memberResult.error.message);
    else setMembers((memberResult.data || []) as MemberRow[]);

    const generatedAccountNo = nextAccountNoFromRows((accountResult.data || []) as Array<{ account_no: string | null }>);
    setNextAccountNo(generatedAccountNo);
    if (!settingsResult.error && settingsResult.data?.default_monthly_fee) {
      const fee = Number(settingsResult.data.default_monthly_fee);
      setDefaultFee(fee);
      setForm((current) => (current.id || current.member_name || current.account_no ? current : makeEmptyForm(fee, generatedAccountNo)));
    } else {
      setForm((current) => (current.id || current.member_name || current.account_no ? current : makeEmptyForm(defaultFee, generatedAccountNo)));
    }
  }

  async function loadRole() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;

    const { data } = await supabase.from("users").select("role").eq("id", authData.user.id).single();
    setIsAdmin(data?.role === "admin");
  }

  useEffect(() => {
    loadMembers();
    loadRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, area, status, marital]);

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const fd = new FormData(event.currentTarget);
    const payload = {
      account_no: String(fd.get("account_no") || "").trim(),
      member_name: String(fd.get("member_name") || "").trim(),
      father_name: String(fd.get("father_name") || "").trim() || null,
      parent_account_id: String(fd.get("parent_account_id") || "") || null,
      phone: String(fd.get("phone") || "").trim() || null,
      address: String(fd.get("address") || "").trim() || null,
      area: String(fd.get("area") || "").trim() || null,
      join_date: String(fd.get("join_date")),
      monthly_fee: toNumber(fd.get("monthly_fee"), 200),
      marital_status: String(fd.get("marital_status")) as "Single" | "Married",
      wife_name: String(fd.get("marital_status")) === "Married" ? String(fd.get("wife_name") || "").trim() : null,
      status: String(fd.get("status")),
      opening_balance: toNumber(fd.get("opening_balance"), 0),
      notes: String(fd.get("notes") || "").trim() || null,
    };

    if (payload.marital_status === "Married" && !payload.wife_name) {
      setError("Wife name is required when marital status is Married.");
      return;
    }

    const request = form.id
      ? supabase.from("member_accounts").update(payload).eq("id", form.id)
      : supabase.from("member_accounts").insert(payload);
    const { error: saveError } = await request;

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setMessage(form.id ? "Member updated." : "Member added.");
    const generatedAccountNo = nextAccountNoFromRows([...members, { account_no: payload.account_no }]);
    setNextAccountNo(generatedAccountNo);
    setForm(makeEmptyForm(defaultFee, generatedAccountNo));
    await loadMembers();
  }

  async function deleteMember(member: MemberRow) {
    const confirmed = confirm(
      `Delete member ${member.account_no} - ${member.member_name}?\n\nIf this member has payments, cases, ledger entries, or linked records, Supabase will block deletion. Use Inactive/Suspended for real historical members.`,
    );
    if (!confirmed) return;

    setError("");
    setMessage("");
    const { error: deleteError } = await supabase.from("member_accounts").delete().eq("id", member.id);

    if (deleteError) {
      setError(`Cannot delete this member: ${deleteError.message}`);
      return;
    }

    setMessage("Member deleted.");
    loadMembers();
  }

  function editMember(member: MemberRow) {
    setForm({
      ...makeEmptyForm(defaultFee),
      ...member,
      parent_account_id: member.parent_account_id || "",
      father_name: member.father_name || "",
      phone: member.phone || "",
      address: member.address || "",
      area: member.area || "",
      monthly_fee: String(member.monthly_fee),
      wife_name: member.wife_name || "",
      opening_balance: String(member.opening_balance),
      notes: member.notes || "",
    });
    setError("");
    setMessage("");
  }

  const areas = Array.from(new Set(members.map((m) => m.area).filter(Boolean))) as string[];
  const counts = {
    Active: members.filter((member) => member.status === "Active").length,
    Inactive: members.filter((member) => member.status === "Inactive").length,
    Suspended: members.filter((member) => member.status === "Suspended").length,
  };

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Member Accounts</h1>
        <p>Only paying members are accounts. Wives are stored inside married member records.</p>
      </div>
      <div className="summary-chips">
        <button className={`summary-chip ${status === "Active" ? "selected" : ""}`} onClick={() => setStatus(status === "Active" ? "" : "Active")} type="button">
          <span>Active</span>
          <strong>{counts.Active}</strong>
        </button>
        <button className={`summary-chip ${status === "Inactive" ? "selected" : ""}`} onClick={() => setStatus(status === "Inactive" ? "" : "Inactive")} type="button">
          <span>Inactive</span>
          <strong>{counts.Inactive}</strong>
        </button>
        <button className={`summary-chip ${status === "Suspended" ? "selected" : ""}`} onClick={() => setStatus(status === "Suspended" ? "" : "Suspended")} type="button">
          <span>Suspended</span>
          <strong>{counts.Suspended}</strong>
        </button>
        <div className="notice compact-notice">Use Inactive/Suspended for real members with history. Delete only wrong test records.</div>
      </div>
      <div className="toolbar">
        <label className="field" style={{ flex: "1 1 220px" }}>
          <span>Search</span>
          <div className="toolbar">
            <Search size={18} />
            <input className="input" onChange={(e) => setQuery(e.target.value)} placeholder="AccountNo or name" value={query} />
          </div>
        </label>
        <label className="field">
          <span>Area</span>
          <select className="select" onChange={(e) => setArea(e.target.value)} value={area}>
            <option value="">All areas</option>
            {areas.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select className="select" onChange={(e) => setStatus(e.target.value)} value={status}>
            <option value="">All statuses</option>
            {MEMBER_STATUSES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Marital</span>
          <select className="select" onChange={(e) => setMarital(e.target.value)} value={marital}>
            <option value="">All</option>
            <option>Single</option>
            <option>Married</option>
          </select>
        </label>
      </div>
      <div className="two-col">
        <div className="table-card">
          {members.length === 0 ? (
            <EmptyState title="No members found" body="Add the first paying member account from the form." />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Member</th>
                      <th>Parent</th>
                      <th>Phone / Area</th>
                      <th>Fee</th>
                      <th>Family</th>
                      <th>Status</th>
                      <th>Member since</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td>{member.account_no}</td>
                        <td>
                          <strong>{member.member_name}</strong>
                          <br />
                          <small>{member.father_name || "-"}</small>
                        </td>
                        <td>{member.parent ? `${member.parent.member_name} (${member.parent.account_no})` : "-"}</td>
                        <td>
                          {member.phone || "-"}
                          <br />
                          <small>{member.area || "-"}</small>
                        </td>
                        <td>{money(member.monthly_fee)}</td>
                        <td>
                          {member.marital_status}
                          {member.wife_name ? (
                            <>
                              <br />
                              <small>Wife: {member.wife_name}</small>
                            </>
                          ) : null}
                        </td>
                        <td>
                          <StatusBadge value={member.status} />
                        </td>
                        <td>{dateOnly(member.join_date)}</td>
                        <td>
                          <div className="row-actions">
                            <button className="action-button" onClick={() => editMember(member)} type="button">
                              <Pencil size={15} />
                              Edit
                            </button>
                            <Link className="action-button secondary-action" href={`/app/members/${member.id}`}>
                              <Eye size={15} />
                              View
                            </Link>
                            {isAdmin ? (
                              <button className="action-button danger-action" onClick={() => deleteMember(member)} type="button">
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
                {members.map((member) => (
                  <div className="list-card" key={member.id}>
                    <div className="toolbar" style={{ justifyContent: "space-between" }}>
                      <strong>
                        {member.account_no} - {member.member_name}
                      </strong>
                      <StatusBadge value={member.status} />
                    </div>
                    <small>
                      {member.area || "-"} - {money(member.monthly_fee)} - {member.marital_status} - Since {dateOnly(member.join_date)}
                    </small>
                    <div className="row-actions">
                      <button
                        className="action-button"
                        onClick={() => editMember(member)}
                        type="button"
                      >
                        <Pencil size={15} />
                        Edit
                      </button>
                      <Link className="action-button secondary-action" href={`/app/members/${member.id}`}>
                        <Eye size={15} />
                        View
                      </Link>
                      {isAdmin ? (
                        <button className="action-button danger-action" onClick={() => deleteMember(member)} type="button">
                          <Trash2 size={15} />
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <form className="card" onSubmit={saveMember}>
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <h2>{form.id ? "Edit member" : "Add member"}</h2>
            {form.id ? (
              <button className="button secondary" onClick={() => setForm(makeEmptyForm(defaultFee, nextAccountNo))} type="button">
                <Plus size={16} /> New
              </button>
            ) : null}
          </div>
          {form.id ? (
            <div className="quick-status">
              <span className="detail-label">Quick status</span>
              {MEMBER_STATUSES.map((item) => (
                <button
                  className={`action-button ${form.status === item ? "" : "secondary-action"}`}
                  key={item}
                  onClick={() => setForm({ ...form, status: item })}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          <div className="form-grid">
            <Field name="account_no" label="AccountNo" required value={form.account_no} onChange={setForm} />
            <Field name="member_name" label="Member name" required value={form.member_name} onChange={setForm} />
            <Field name="father_name" label="Father name" value={form.father_name} onChange={setForm} />
            <label className="field">
              <span>Parent account</span>
              <select className="select" name="parent_account_id" value={form.parent_account_id} onChange={(e) => setForm({ ...form, parent_account_id: e.target.value })}>
                <option value="">None</option>
                {members
                  .filter((m) => m.id !== form.id)
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.account_no} - {member.member_name}
                    </option>
                  ))}
              </select>
            </label>
            <Field name="phone" label="Phone" value={form.phone} onChange={setForm} />
            <Field name="area" label="Area" value={form.area} onChange={setForm} />
            <Field name="join_date" label="Join date" required type="date" value={form.join_date} onChange={setForm} />
            <Field name="monthly_fee" label="Monthly fee" required type="number" value={form.monthly_fee} onChange={setForm} />
            <label className="field">
              <span>Marital status</span>
              <select className="select" name="marital_status" value={form.marital_status} onChange={(e) => setForm({ ...form, marital_status: e.target.value })}>
                <option>Single</option>
                <option>Married</option>
              </select>
            </label>
            {form.marital_status === "Married" ? <Field name="wife_name" label="Wife name" required value={form.wife_name} onChange={setForm} /> : null}
            <label className="field">
              <span>Status</span>
              <select className="select" name="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {MEMBER_STATUSES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <Field name="opening_balance" label="Opening balance" type="number" value={form.opening_balance} onChange={setForm} />
            <label className="field full">
              <span>Address</span>
              <textarea className="textarea" name="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
            <label className="field full">
              <span>Notes</span>
              <textarea className="textarea" name="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
          {message ? <div className="success">{message}</div> : null}
          {error ? <div className="error">{error}</div> : null}
          <button className="button" type="submit">
            <Save size={18} />
            Save member
          </button>
        </form>
      </div>
    </section>
  );
}

function Field({
  name,
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  name: keyof MemberForm;
  label: string;
  value: string;
  onChange: Dispatch<SetStateAction<MemberForm>>;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        name={name}
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange((currentForm) => ({ ...currentForm, [name]: e.target.value }))}
      />
    </label>
  );
}
