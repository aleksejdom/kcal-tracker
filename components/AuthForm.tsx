"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Flame, Eye, EyeOff, TrendingDown, Beef, Scale } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function AuthForm() {
  const { t } = useLanguage();
  const [tab, setTab]       = useState<"login" | "register">("login");
  const [email, setEmail]   = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [info, setInfo]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    if (tab === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: "https://kcal-tracker-omega.vercel.app" } });
      if (error) setError(error.message);
      else setInfo(t.confirmEmailSent);
    }
    setLoading(false);
  }

  const features = [
    { icon: <TrendingDown size={15} className="text-blue-400" />,  title: t.feature1Title, desc: t.feature1Desc },
    { icon: <Beef size={15} className="text-emerald-400" />,       title: t.feature2Title, desc: t.feature2Desc },
    { icon: <Scale size={15} className="text-violet-400" />,       title: t.feature3Title, desc: t.feature3Desc },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div className="blob blob-1" /><div className="blob blob-2" />
        <div className="blob blob-3" /><div className="blob blob-4" />
      </div>

      {/* ── LEFT: Branding — flex-1, links ausgerichtet ── */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 xl:px-24 relative" style={{ zIndex: 1 }}>
        <div className="max-w-[420px]">
          {/* Logo */}
          <div className="w-[58px] h-[58px] rounded-2xl flex items-center justify-center mb-8 shadow-xl"
            style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
            <Flame size={26} className="text-white" strokeWidth={1.8} />
          </div>

          <h1 className="text-[42px] font-black text-slate-900 dark:text-white leading-tight mb-1.5">
            Kalorien-Defizit
          </h1>
          <p className="text-base text-blue-500 dark:text-blue-400 font-semibold mb-4">by Domowets</p>
          <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed mb-12">
            {t.heroDesc}
          </p>

          {/* Features — horizontal, frei, kein Glasmorphismus */}
          <div className="flex gap-10">
            {features.map((f) => (
              <div key={f.title} className="flex flex-col gap-2">
                <div className="w-[34px] h-[34px] bg-slate-200/70 dark:bg-white/[0.08] rounded-xl flex items-center justify-center">
                  {f.icon}
                </div>
                <p className="text-[13px] font-bold text-slate-800 dark:text-white mt-0.5">{f.title}</p>
                <p className="text-[12px] text-slate-500 leading-snug max-w-[120px]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Formular — schmal, freischwebend ── */}
      <div
        className="flex-1 lg:max-w-[540px] flex flex-col justify-center items-center px-10 xl:px-16 py-16 relative"
        style={{ zIndex: 1 }}
      >
        {/* Mobile brand */}
        <div className="flex flex-col items-center text-center mb-10 lg:hidden">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-xl"
            style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
            <Flame size={26} className="text-white" strokeWidth={1.8} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Kalorien-Defizit</h1>
          <p className="text-sm text-blue-500 dark:text-blue-400 font-semibold mt-1">by Domowets</p>
          <p className="text-sm text-slate-500 mt-3 max-w-xs leading-relaxed">{t.heroDesc}</p>
        </div>

        {/* Form card — füllt Panel-Breite */}
        <div className="w-full gc rounded-2xl overflow-hidden shadow-2xl shadow-black/10 dark:shadow-black/50">

          {/* Tab-Switcher */}
          <div className="flex border-b border-black/[0.06] dark:border-white/[0.07]">
            {(["login", "register"] as const).map((tp) => (
              <button key={tp} type="button"
                onClick={() => { setTab(tp); setError(""); setInfo(""); }}
                className={`flex-1 py-[18px] text-[15px] font-semibold transition-all border-b-2 -mb-px ${
                  tab === tp
                    ? "text-slate-900 dark:text-white border-blue-500"
                    : "text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {tp === "login" ? t.loginTab : t.registerTab}
              </button>
            ))}
          </div>

          {/* Felder */}
          <form onSubmit={handleSubmit} className="px-7 pt-6 pb-7 space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-2.5 uppercase tracking-widest">
                {t.emailLabel}
              </label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder} required
                className="gi w-full rounded-xl px-4 py-[14px] text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-2.5 uppercase tracking-widest">
                {t.passwordLabel}
                {tab === "register" && (
                  <span className="font-normal text-slate-400 normal-case ml-1">{t.minChars}</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required minLength={6}
                  className="gi w-full rounded-xl px-4 py-[14px] pr-12 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            {info && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                {info}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full font-bold rounded-xl py-[15px] text-[15px] text-white transition-all disabled:opacity-40 mt-1"
              style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", boxShadow: "0 6px 22px rgba(59,130,246,0.45)" }}
            >
              {loading ? "…" : tab === "login" ? t.loginBtn : t.registerBtn}
            </button>

            {tab === "register" && (
              <p className="text-center text-sm text-slate-500">{t.secureStorage}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
