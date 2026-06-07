"use client";

import { useState, useEffect, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { LogOut, Flame, Scale, Package, TrendingDown, Shield, Zap, Sun, Moon } from "lucide-react";
import TodayTab from "@/components/TodayTab";
import KoerperTab from "@/components/KoerperTab";
import ProdukteTab from "@/components/ProdukteTab";
import VerlaufTab from "@/components/VerlaufTab";
import AdminTab from "@/components/AdminTab";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";

type Tab = "heute" | "koerper" | "produkte" | "verlauf" | "admin";

interface Settings { budget: number; deficit: number; protein_goal: number | null; }
interface Props { session: Session; }

const DEFAULT_SETTINGS: Settings = { budget: 2000, deficit: 0, protein_goal: null };

export default function Dashboard({ session }: Props) {
  const [tab, setTab]   = useState<Tab>("heute");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [isAdmin, setIsAdmin]   = useState(false);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const userId = session.user.id;
  const email  = session.user.email ?? "";

  const { theme, toggle } = useTheme();
  const { lang, setLang, t } = useLanguage();

  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from("user_settings").select("budget,deficit,protein_goal")
      .eq("user_id", userId).maybeSingle();
    if (data) setSettings({ budget: data.budget ?? 2000, deficit: data.deficit ?? 0, protein_goal: data.protein_goal ?? null });
    else await supabase.from("user_settings").insert({ user_id: userId, budget: 2000, deficit: 0, protein_goal: null });
  }, [userId]);

  const loadRole = useCallback(async () => {
    const { data } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    setIsAdmin(data?.role === "admin");
    setRoleLoaded(true);
  }, [userId]);

  useEffect(() => { loadSettings(); loadRole(); }, [loadSettings, loadRole]);

  const tabs = [
    { id: "heute"    as Tab, label: t.tabs.heute,    Icon: Zap },
    { id: "koerper"  as Tab, label: t.tabs.koerper,  Icon: Scale },
    { id: "produkte" as Tab, label: t.tabs.produkte, Icon: Package },
    { id: "verlauf"  as Tab, label: t.tabs.verlauf,  Icon: TrendingDown },
    ...(isAdmin ? [{ id: "admin" as Tab, label: t.tabs.admin, Icon: Shield }] : []),
  ];

  /* ── Loading screen ── */
  if (!roleLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="blob blob-1" /><div className="blob blob-2" />
          <div className="blob blob-3" /><div className="blob blob-4" />
        </div>
        <div className="flex flex-col items-center gap-4 relative">
          <div className="gc rounded-3xl w-16 h-16 flex items-center justify-center shadow-2xl">
            <Flame size={30} className="text-blue-500" strokeWidth={1.8} />
          </div>
          <div className="w-6 h-6 border-2 border-slate-200 dark:border-white/20 border-t-blue-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* ── Animated background ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
      </div>

      <div className="relative max-w-[1440px] mx-auto min-h-screen flex flex-col lg:flex-row" style={{ zIndex: 1 }}>

        {/* ════════════════════════════════════════
            SIDEBAR  (lg+)
        ════════════════════════════════════════ */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 min-h-screen py-5 pl-5">
          <div className="gs flex flex-col flex-1 rounded-3xl overflow-hidden">

            {/* Brand */}
            <div className="px-6 pt-7 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
                  <Flame size={21} className="text-white" strokeWidth={1.8} />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Kalorien-Defizit</h1>
                  <p className="text-xs text-blue-500 dark:text-slate-400 font-medium">by Domowets</p>
                </div>
              </div>
            </div>

            {/* Tagesziel */}
            <div className="px-4 mb-5">
              <div className="gc rounded-2xl px-4 py-3.5">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-1">{t.tagesziel}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {settings.budget}
                  <span className="text-sm font-normal text-slate-500 ml-1">kcal</span>
                </p>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 space-y-1">
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                    tab === id
                      ? "text-white shadow-lg"
                      : id === "admin"
                        ? "text-amber-600 dark:text-amber-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] hover:text-amber-700 dark:hover:text-amber-300"
                        : "text-slate-600 dark:text-slate-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] hover:text-slate-900 dark:hover:text-white"
                  }`}
                  style={tab === id ? { background: "linear-gradient(135deg, rgba(59,130,246,0.90), rgba(99,102,241,0.80))", boxShadow: "0 8px 24px rgba(59,130,246,0.25)" } : {}}
                >
                  <Icon size={17} />
                  {label}
                  {id === "admin" && tab !== id && (
                    <span className="ml-auto text-[10px] bg-amber-400/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">Admin</span>
                  )}
                </button>
              ))}
            </nav>

            {/* Theme + Language controls */}
            <div className="px-4 pb-3 space-y-2">
              <button
                onClick={toggle}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all text-slate-600 dark:text-slate-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] hover:text-slate-900 dark:hover:text-white"
              >
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                {theme === "dark" ? t.lightMode : t.darkMode}
              </button>
              <div className="flex gap-1.5 px-1">
                {(["de", "ru"] as const).map((l) => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                      lang === l
                        ? "text-white"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    style={lang === l ? { background: "linear-gradient(135deg, rgba(59,130,246,0.90), rgba(99,102,241,0.80))" } : {}}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* User */}
            <div className="px-4 pb-5">
              <div className="gc rounded-2xl px-4 py-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{t.loggedInAs}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">{email}</p>
                </div>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="w-8 h-8 bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.10] dark:hover:bg-white/[0.15] rounded-xl flex items-center justify-center transition-colors"
                  title={t.logout}
                >
                  <LogOut size={14} className="text-slate-500 dark:text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* ════════════════════════════════════════
            MAIN AREA
        ════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-h-screen min-w-0">

          {/* Mobile header */}
          <header className="lg:hidden px-4 pt-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
                <Flame size={19} className="text-white" strokeWidth={1.8} />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 dark:text-white">Kalorien-Defizit</h1>
                <p className="text-xs text-blue-500 dark:text-slate-500">by Domowets</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Lang switcher */}
              <div className="flex rounded-xl overflow-hidden border border-black/[0.08] dark:border-white/[0.10]">
                {(["de", "ru"] as const).map((l) => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`px-2.5 py-1.5 text-[11px] font-bold transition-all ${
                      lang === l ? "text-white" : "text-slate-500"
                    }`}
                    style={lang === l ? { background: "linear-gradient(135deg, #3b82f6, #6366f1)" } : {}}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              {/* Theme toggle */}
              <button
                onClick={toggle}
                className="w-9 h-9 gc rounded-xl flex items-center justify-center transition-colors"
                title={theme === "dark" ? t.lightMode : t.darkMode}
              >
                {theme === "dark"
                  ? <Sun size={15} className="text-slate-600 dark:text-slate-400" />
                  : <Moon size={15} className="text-slate-600 dark:text-slate-400" />
                }
              </button>
              {/* Logout */}
              <button
                onClick={() => supabase.auth.signOut()}
                className="w-9 h-9 gc rounded-xl flex items-center justify-center transition-colors"
              >
                <LogOut size={14} className="text-slate-500 dark:text-slate-400" />
              </button>
            </div>
          </header>

          {/* Desktop page heading */}
          <div className="hidden lg:block px-8 py-7">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {tabs.find(tb => tb.id === tab)?.label}
            </h2>
            <p className="text-sm text-slate-500 mt-1">{t.tabSubtitles[tab]}</p>
          </div>

          {/* Tab content */}
          <main className="flex-1 px-4 lg:px-8 pb-28 lg:pb-10 pt-4 lg:pt-0">
            {tab === "heute" && (
              <TodayTab
                userId={userId}
                settings={settings}
                onSettingsChange={setSettings}
                onGoToKoerper={() => setTab("koerper")}
                refreshKey={profileRefreshKey}
              />
            )}
            {tab === "koerper" && (
              <KoerperTab
                userId={userId}
                onProfileSaved={() => setProfileRefreshKey((k) => k + 1)}
                onGoalsApplied={(budget, proteinGoal) =>
                  setSettings((s) => ({ ...s, budget, protein_goal: proteinGoal }))
                }
              />
            )}
            {tab === "produkte" && <ProdukteTab userId={userId} isAdmin={isAdmin} />}
            {tab === "verlauf"  && <VerlaufTab  userId={userId} budget={settings.budget} />}
            {tab === "admin" && isAdmin && <AdminTab currentUserId={userId} />}
          </main>
        </div>
      </div>

      {/* ════════════════════════════════════════
          MOBILE BOTTOM NAV
      ════════════════════════════════════════ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="gn px-2 py-3">
          <div className="flex justify-around items-center">
            {tabs.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex flex-col items-center gap-1.5 flex-1 py-1 rounded-2xl transition-all ${
                    active ? "text-white" : id === "admin" ? "text-amber-600 dark:text-amber-500" : "text-slate-500 dark:text-slate-500"
                  }`}
                >
                  <div className={`p-2 rounded-xl transition-all ${active ? "bg-blue-500 shadow-lg shadow-blue-500/40" : ""}`}>
                    <Icon size={18} />
                  </div>
                  <span className={`text-[10px] font-semibold leading-none ${active ? "text-blue-500 dark:text-blue-400" : "text-slate-600 dark:text-slate-500"}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
