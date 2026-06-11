"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { toNumber } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type Settings = {
  id: string;
  committee_name: string;
  default_monthly_fee: number;
  pending_monthly_fee?: number | null;
  pending_monthly_fee_effective_month?: string | null;
  currency: string;
};

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useLanguage();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [applyMode, setApplyMode] = useState<"now" | "next_month">("now");
  const [effectiveMonth, setEffectiveMonth] = useState(nextMonthValue());
  const [isAdmin, setIsAdmin] = useState(false);
  const [resetText, setResetText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data, error: loadError } = await supabase.from("settings").select("*").limit(1).single();
      if (loadError) setError(loadError.message);
      else setSettings(data as Settings);

      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const { data: profile } = await supabase.from("users").select("role").eq("id", authData.user.id).single();
        setIsAdmin(profile?.role === "admin");
      }
    }
    load();
  }, [supabase]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setError("");
    setMessage("");
    const fd = new FormData(event.currentTarget);
    const fee = toNumber(fd.get("default_monthly_fee"), 200);
    const { error: baseSaveError } = await supabase
      .from("settings")
      .update({
        committee_name: String(fd.get("committee_name") || "Mayyat Committee"),
        currency: String(fd.get("currency") || "PKR"),
      })
      .eq("id", settings.id);

    if (baseSaveError) {
      setError(baseSaveError.message);
      return;
    }

    const { error: feeError } = await supabase.rpc("apply_monthly_fee_change", {
      p_settings_id: settings.id,
      p_default_monthly_fee: fee,
      p_apply_mode: applyMode,
      p_effective_month: `${effectiveMonth}-01`,
    });

    if (feeError) {
      setError(`${feeError.message}. Run supabase/migrations/002_fee_policy.sql in Supabase SQL Editor, then try again.`);
      return;
    }

    const { data } = await supabase.from("settings").select("*").limit(1).single();
    setSettings(data as Settings);
    setMessage(t("settingsSaved"));
  }

  async function resetCommitteeData() {
    if (resetText !== "RESET ALL DATA") {
      setError("Type RESET ALL DATA to confirm.");
      return;
    }

    const confirmed = confirm("This will clear payments, death cases, expenses, extra collections, and fund ledger. Members, users, and settings will remain. Continue?");
    if (!confirmed) return;

    setError("");
    setMessage("");
    const { error: resetError } = await supabase.rpc("reset_committee_data");

    if (resetError) {
      setError(`${resetError.message}. Run supabase/migrations/003_admin_reset.sql in Supabase SQL Editor, then try again.`);
      return;
    }

    setResetText("");
    setMessage("Financial and case data reset complete. Members were kept.");
  }

  return (
    <section className="grid">
      <div className="page-title">
        <h1>{t("settings")}</h1>
        <p>{t("settingsSubtitle")}</p>
      </div>
      <form className="card" onSubmit={save}>
        <div className="form-grid">
          <label className="field">
            <span>{t("committeeName")}</span>
            <input className="input" name="committee_name" required defaultValue={settings?.committee_name || "Mayyat Committee"} />
          </label>
          <label className="field">
            <span>{t("defaultMonthlyFee")}</span>
            <input className="input" name="default_monthly_fee" required type="number" defaultValue={settings?.default_monthly_fee || 200} />
          </label>
          <label className="field">
            <span>{t("currency")}</span>
            <input className="input" name="currency" required defaultValue={settings?.currency || "PKR"} />
          </label>
          <label className="field">
            <span>{t("feeApplyMode")}</span>
            <select className="select" value={applyMode} onChange={(event) => setApplyMode(event.target.value as "now" | "next_month")}>
              <option value="now">{t("applyFromNow")}</option>
              <option value="next_month">{t("applyFromNextMonth")}</option>
            </select>
          </label>
          {applyMode === "next_month" ? (
            <label className="field">
              <span>{t("effectiveMonth")}</span>
              <input className="input" type="month" value={effectiveMonth} onChange={(event) => setEffectiveMonth(event.target.value)} />
            </label>
          ) : null}
        </div>
        <p className="notice">{applyMode === "now" ? t("feeNowHelp") : t("feeNextHelp")}</p>
        {settings?.pending_monthly_fee && settings.pending_monthly_fee_effective_month ? (
          <p className="notice">
            {t("pendingFee")}: Rs {settings.pending_monthly_fee} from {settings.pending_monthly_fee_effective_month.slice(0, 7)}
          </p>
        ) : null}
        {message ? <div className="success">{message}</div> : null}
        {error ? <div className="error">{error}</div> : null}
        <button className="button" type="submit">
          <Save size={18} /> {t("saveSettings")}
        </button>
      </form>
      {isAdmin ? (
        <section className="card danger-zone">
          <h2>Reset financial and case data</h2>
          <p className="notice">
            Clears monthly payments, death cases, expenses, extra collections, and fund ledger. Keeps all members, admin/editor users, and settings.
          </p>
          <label className="field">
            <span>Type RESET ALL DATA</span>
            <input className="input" value={resetText} onChange={(event) => setResetText(event.target.value)} placeholder="RESET ALL DATA" />
          </label>
          <button className="button danger" disabled={resetText !== "RESET ALL DATA"} onClick={resetCommitteeData} type="button">
            <RotateCcw size={18} /> Reset financial data
          </button>
        </section>
      ) : null}
    </section>
  );
}

function nextMonthValue() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
