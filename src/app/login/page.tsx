"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { HeartHandshake, LogIn, ShieldCheck, Users, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !data.user) {
      setError(authError?.message || "Login failed");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role,status")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile || profile.status !== "active") {
      await supabase.auth.signOut();
      setError("This account is not an active admin/editor user.");
      setLoading(false);
      return;
    }

    router.replace("/app/dashboard");
  }

  return (
    <main className="login-page entry-page">
      <section className="entry-shell staff-entry">
        <div className="entry-visual">
          <div className="brand-lockup">
            <div className="brand-mark brand-mark-lg">
              <HeartHandshake size={30} />
            </div>
            <div>
              <strong>Mayyat Committee</strong>
              <small>Admin workspace</small>
            </div>
          </div>
          <h1>Manage members, payments, and fund records with confidence.</h1>
          <div className="entry-feature-grid">
            <div className="entry-feature">
              <Users size={18} />
              <span>Member records</span>
            </div>
            <div className="entry-feature">
              <WalletCards size={18} />
              <span>Fund ledger</span>
            </div>
            <div className="entry-feature">
              <ShieldCheck size={18} />
              <span>Admin control</span>
            </div>
          </div>
        </div>
        <div className="auth-panel entry-card">
          <div>
            <span className="entry-kicker">Admin access</span>
            <h2>Welcome back</h2>
            <p>Login to continue to the admin/editor workspace.</p>
          </div>
        <form className="grid" onSubmit={onSubmit}>
          <label className="field">
            <span>Email</span>
            <input className="input" name="email" required type="email" />
          </label>
          <label className="field">
            <span>Password</span>
            <input className="input" name="password" required type="password" />
          </label>
          {error ? <div className="error">{error}</div> : null}
          <Link className="entry-link" href="/public">Open public member lookup</Link>
          <button className="button" disabled={loading || !supabase} type="submit">
            <LogIn size={18} />
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        </div>
      </section>
    </main>
  );
}
