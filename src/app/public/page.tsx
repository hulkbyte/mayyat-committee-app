"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { BadgeCheck, HeartHandshake, Search, ShieldCheck, WalletCards } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { dateOnly, money } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type LookupResult = {
  member: null | {
    account_no: string;
    member_name: string;
    father_name: string | null;
    area: string | null;
    join_date: string;
    monthly_fee: number;
    marital_status: string;
    wife_name: string | null;
    status: string;
    current_month_payment_status: string;
    pending_monthly_amount: number;
    extra_collection_due: number;
  };
  summary: null | {
    current_fund_balance: number;
    active_members_count: number;
    case_no: string | null;
    deceased_name: string | null;
    total_expense: number | null;
    shortfall: number | null;
    per_member_extra: number | null;
    case_status: string | null;
  };
};

export default function PublicLookupPage() {
  const { language, setLanguage, t } = useLanguage();
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Supabase is not configured");
      return null;
    }
  }, []);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError("");

    const publicPin = String(new FormData(event.currentTarget).get("public_pin") || "").trim();
    const { data, error: lookupError } = await supabase.rpc("public_member_lookup", { p_public_pin: publicPin });

    if (lookupError) {
      setError(lookupError.message);
      setResult(null);
    } else {
      setResult(data as LookupResult);
    }

    setLoading(false);
  }

  return (
    <main className="public-page entry-page">
      <section className="entry-shell public-entry">
        <div className="entry-visual public-visual">
          <div className="brand-lockup">
            <div className="brand-mark brand-mark-lg">
              <HeartHandshake size={30} />
            </div>
            <div>
              <strong>{t("memberLookup")}</strong>
              <small>Public member access</small>
            </div>
          </div>
          <h1>Check your membership and committee fund summary in seconds.</h1>
          <div className="entry-feature-grid">
            <div className="entry-feature">
              <BadgeCheck size={18} />
              <span>Membership status</span>
            </div>
            <div className="entry-feature">
              <WalletCards size={18} />
              <span>Fund summary</span>
            </div>
            <div className="entry-feature">
              <ShieldCheck size={18} />
              <span>Private lookup</span>
            </div>
          </div>
        </div>
        <div className="lookup-panel entry-card">
          <div className="toolbar lookup-actions">
            <label className="language-toggle">
              <span>{t("language")}</span>
              <select className="select" onChange={(event) => setLanguage(event.target.value as "en" | "ur")} value={language}>
                <option value="en">{t("english")}</option>
                <option value="ur">{t("urdu")}</option>
              </select>
            </label>
            <Link className="button secondary" href="/login">
              {t("staffLogin")}
            </Link>
          </div>
          <div>
            <span className="entry-kicker">Member portal</span>
            <h2>{t("memberLookup")}</h2>
            <p>{t("publicLookupHelp")}</p>
          </div>
        <form className="lookup-form" onSubmit={lookup}>
          <input className="input" inputMode="numeric" maxLength={4} name="public_pin" pattern="[0-9]{4}" placeholder={t("examplePin")} required />
          <button className="button" disabled={loading || !supabase} type="submit">
            <Search size={18} />
            {loading ? t("checking") : t("search")}
          </button>
        </form>
        {error ? <div className="error">{error}</div> : null}
        {result?.member === null ? <div className="notice">{t("noMemberFound")}</div> : null}
        {result?.member ? (
          <div className="grid">
            <div className="card public-result-card">
              <h2>{t("yourMembership")}</h2>
              <div className="detail-grid">
                <Detail label={t("accountNo")} value={result.member.account_no} />
                <Detail label={t("member")} value={result.member.member_name} />
                <Detail label={t("father")} value={result.member.father_name || "-"} />
                <Detail label={t("area")} value={result.member.area || "-"} />
                <Detail label={t("joinDate")} value={dateOnly(result.member.join_date)} />
                <Detail label={t("monthlyFee")} value={money(result.member.monthly_fee)} />
                <Detail label={t("maritalStatus")} value={result.member.marital_status} />
                <Detail label={t("wife")} value={result.member.wife_name || "-"} />
                <Detail label={t("status")} value={<StatusBadge value={result.member.status} />} />
                <Detail label={t("currentMonth")} value={<StatusBadge value={result.member.current_month_payment_status} />} />
                <Detail label={t("pendingMonthly")} value={money(result.member.pending_monthly_amount)} />
                <Detail label={t("extraDue")} value={money(result.member.extra_collection_due)} />
              </div>
            </div>
            <div className="card public-result-card public-summary-card">
              <h2>{t("committeeSummary")}</h2>
              <div className="detail-grid">
                <Detail label={t("currentFund")} value={money(result.summary?.current_fund_balance)} />
                <Detail label={t("activeMembers")} value={result.summary?.active_members_count ?? 0} />
                {result.summary?.case_no ? (
                  <>
                    <Detail label={t("openCase")} value={result.summary.case_no} />
                    <Detail label={t("deceased")} value={result.summary.deceased_name || "-"} />
                    <Detail label={t("caseExpenses")} value={money(result.summary.total_expense)} />
                    <Detail label={t("shortfall")} value={money(result.summary.shortfall)} />
                    <Detail label={t("perMemberExtra")} value={money(result.summary.per_member_extra)} />
                    <Detail label={t("caseStatus")} value={<StatusBadge value={result.summary.case_status} />} />
                  </>
                ) : (
                  <Detail label={t("openCase")} value={t("noOpenCase")} />
                )}
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </section>
    </main>
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
