"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  BookOpen,
  ClipboardList,
  Gauge,
  HeartHandshake,
  LogOut,
  Menu,
  Receipt,
  Search,
  Settings,
  Shield,
  X,
  Users,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import type { StaffUser } from "@/lib/types";

const navItems = [
  { href: "/app/dashboard", labelKey: "dashboard", icon: Gauge },
  { href: "/app/members", labelKey: "members", icon: Users },
  { href: "/app/payments", labelKey: "payments", icon: WalletCards },
  { href: "/app/cases", labelKey: "deathCases", icon: HeartHandshake },
  { href: "/app/expenses", labelKey: "expenses", icon: Receipt },
  { href: "/app/extra", labelKey: "extraCollections", icon: Banknote },
  { href: "/app/ledger", labelKey: "fundLedger", icon: BookOpen },
  { href: "/app/reports", labelKey: "reports", icon: ClipboardList },
  { href: "/app/settings", labelKey: "settings", icon: Settings },
  { href: "/app/users", labelKey: "users", icon: Shield, adminOnly: true },
  { href: "/public", labelKey: "publicLookup", icon: Search },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const [profile, setProfile] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const [error, setError] = useState("");
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Supabase is not configured");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;
    async function loadProfile() {
      const { data: authData } = await client.auth.getUser();
      if (!authData.user) {
        router.replace("/login");
        return;
      }

      const { data, error: profileError } = await client
        .from("users")
        .select("id,name,email,phone,role,status")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !data || data.status !== "active") {
        await client.auth.signOut();
        router.replace("/login");
        return;
      }

      setProfile(data as StaffUser);
      setLoading(false);
    }

    loadProfile();
  }, [router, supabase]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="public-page">
        <div className="lookup-panel">{t("loadingWorkspace")}</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="public-page">
        <div className="lookup-panel">
          <h1>{t("supabaseSetupNeeded")}</h1>
          <p>{t("envSetupHelp")}</p>
          <div className="error">{error}</div>
        </div>
      </main>
    );
  }

  return (
    <div className="app-layout">
      <aside className={`sidebar ${navOpen ? "nav-open" : ""}`}>
        <div className="sidebar-header">
          <div className="brand-mark">
            <HeartHandshake size={24} />
          </div>
          <div>
            <strong>Mayyat Committee</strong>
            <small>
              {profile?.role === "admin" ? t("admin") : t("editor")} {t("workspace")}
            </small>
          </div>
          <button className="mobile-menu-button" onClick={() => setNavOpen((value) => !value)} type="button" aria-label={navOpen ? "Close menu" : "Open menu"}>
            {navOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems
            .filter((item) => !item.adminOnly || profile?.role === "admin")
            .map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link className={`nav-link ${active ? "active" : ""}`} href={item.href} key={item.href}>
                  <Icon size={18} />
                  <span>{t(item.labelKey)}</span>
                </Link>
              );
            })}
        </nav>
      </aside>
      <main className="app-main">
        <div className="topbar">
          <div className="page-title">
            <p>{profile?.name}</p>
          </div>
          <div className="toolbar">
            <label className="language-toggle">
              <span>{t("language")}</span>
              <select className="select" onChange={(event) => setLanguage(event.target.value as "en" | "ur")} value={language}>
                <option value="en">{t("english")}</option>
                <option value="ur">{t("urdu")}</option>
              </select>
            </label>
            <button className="icon-button" onClick={signOut} title={t("signOut")} type="button">
              <LogOut size={18} />
            </button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
