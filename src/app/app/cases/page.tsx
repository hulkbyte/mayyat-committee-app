"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Lock, Plus, RefreshCcw, Save } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { dateOnly, money } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { MemberOption } from "@/lib/types";

type DeathCase = {
  id: string;
  case_no: string;
  account_id: string;
  deceased_type: string;
  deceased_name: string;
  death_date: string;
  burial_date: string | null;
  case_status: string;
  fund_before_case: number;
  total_expense: number;
  shortfall: number;
  active_members_count: number;
  per_member_extra: number;
  member_accounts: { account_no: string; member_name: string } | null;
};

export default function CasesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [cases, setCases] = useState<DeathCase[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [deceasedType, setDeceasedType] = useState("Self");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const [memberResult, caseResult] = await Promise.all([
      supabase.from("member_accounts").select("id,account_no,member_name,wife_name,marital_status,monthly_fee").order("account_no"),
      supabase
        .from("death_cases")
        .select("*, member_accounts(account_no,member_name)")
        .order("created_at", { ascending: false }),
    ]);
    if (memberResult.error || caseResult.error) setError(memberResult.error?.message || caseResult.error?.message || "Unable to load cases");
    else {
      setMembers((memberResult.data || []) as MemberOption[]);
      setCases((caseResult.data || []) as DeathCase[]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const fd = new FormData(event.currentTarget);
    const { error: rpcError } = await supabase.rpc("create_death_case", {
      p_case_no: String(fd.get("case_no") || "").trim(),
      p_account_id: String(fd.get("account_id")),
      p_deceased_type: String(fd.get("deceased_type")),
      p_death_date: String(fd.get("death_date")),
      p_burial_date: String(fd.get("burial_date") || "") || null,
      p_notes: String(fd.get("notes") || "").trim() || null,
    });
    if (rpcError) setError(rpcError.message);
    else {
      setMessage("Death case created.");
      event.currentTarget.reset();
      setSelectedAccount("");
      load();
    }
  }

  async function generateExtra(caseId: string) {
    if (!confirm("Generate extra collection rows for every active paying member? Existing rows for this case will be updated.")) return;
    const { data, error: rpcError } = await supabase.rpc("generate_extra_collections", { p_case_id: caseId });
    if (rpcError) setError(rpcError.message);
    else {
      setMessage(`Extra collections generated/updated for ${data} active members.`);
      load();
    }
  }

  async function closeCase(caseId: string) {
    if (!confirm("Close this death case?")) return;
    const { error: closeError } = await supabase
      .from("death_cases")
      .update({ case_status: "Closed", closed_at: new Date().toISOString() })
      .eq("id", caseId);
    if (closeError) setError(closeError.message);
    else {
      setMessage("Death case closed.");
      load();
    }
  }

  const selected = members.find((member) => member.id === selectedAccount);
  const wifeAllowed = selected?.marital_status === "Married" && selected.wife_name;

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Death Cases</h1>
        <p>Create cases, review expenses, calculate shortfall, generate extra collections, and close cases.</p>
      </div>
      <div className="two-col">
        <div className="table-card">
          {cases.length === 0 ? (
            <EmptyState title="No death cases yet" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Member</th>
                    <th>Deceased</th>
                    <th>Dates</th>
                    <th>Fund before</th>
                    <th>Expenses</th>
                    <th>Shortfall</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((item) => (
                    <tr key={item.id}>
                      <td>{item.case_no}</td>
                      <td>
                        {item.member_accounts?.account_no} - {item.member_accounts?.member_name}
                      </td>
                      <td>
                        {item.deceased_name}
                        <br />
                        <small>{item.deceased_type}</small>
                      </td>
                      <td>
                        Death: {dateOnly(item.death_date)}
                        <br />
                        Burial: {dateOnly(item.burial_date)}
                      </td>
                      <td>{money(item.fund_before_case)}</td>
                      <td>{money(item.total_expense)}</td>
                      <td>
                        {money(item.shortfall)}
                        <br />
                        <small>{money(item.per_member_extra)} / member</small>
                      </td>
                      <td>
                        <StatusBadge value={item.case_status} />
                      </td>
                      <td>
                        <div className="toolbar">
                          <button className="icon-button" onClick={() => generateExtra(item.id)} title="Generate extra collections" type="button">
                            <RefreshCcw size={17} />
                          </button>
                          <button className="icon-button" onClick={() => closeCase(item.id)} title="Close case" type="button">
                            <Lock size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <form className="card" onSubmit={createCase}>
          <h2>Create death case</h2>
          <div className="form-grid">
            <label className="field">
              <span>Case number</span>
              <input className="input" name="case_no" placeholder="C-001" required />
            </label>
            <label className="field">
              <span>Member account</span>
              <select className="select" name="account_id" onChange={(e) => setSelectedAccount(e.target.value)} required value={selectedAccount}>
                <option value="">Select member</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.account_no} - {member.member_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Deceased type</span>
              <select
                className="select"
                name="deceased_type"
                onChange={(e) => setDeceasedType(e.target.value)}
                value={deceasedType}
              >
                <option>Self</option>
                <option disabled={!wifeAllowed}>Wife</option>
              </select>
            </label>
            <div className="detail-item">
              <div className="detail-label">Deceased name</div>
              <div className="detail-value">{deceasedType === "Wife" ? selected?.wife_name || "-" : selected?.member_name || "-"}</div>
            </div>
            <label className="field">
              <span>Death date</span>
              <input className="input" name="death_date" required type="date" />
            </label>
            <label className="field">
              <span>Burial date</span>
              <input className="input" name="burial_date" type="date" />
            </label>
            <label className="field full">
              <span>Notes</span>
              <textarea className="textarea" name="notes" />
            </label>
          </div>
          {message ? <div className="success">{message}</div> : null}
          {error ? <div className="error">{error}</div> : null}
          <button className="button" type="submit">
            <Save size={18} />
            Create case
          </button>
        </form>
      </div>
    </section>
  );
}
