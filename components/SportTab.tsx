"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Dumbbell, Plus, Trash2, Trophy, Flame, ChevronDown, Check, Activity } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

type Unit = "Stück" | "Min" | "Std";

interface SportEntry {
  id: string;
  activity_name: string;
  amount: number;
  unit: Unit;
  entry_date: string;
  burned_kcal: number | null;
}

// MET values for timed activities (kcal = MET × weight_kg × hours)
const MET: Record<string, number> = {
  "Laufen":     9.8,
  "Radfahren":  7.5,
  "Schwimmen":  7.0,
  "Yoga":       2.5,
  "Kettlebell": 6.0,
};
// kcal per rep for piece-based activities (at ~75 kg)
const KCAL_PER_REP: Record<string, number> = {
  "Liegestützen": 0.3,
  "Klimmzüge":    0.8,
  "Sit-ups":      0.2,
  "Kniebeugen":   0.4,
};

function suggestKcal(name: string, amount: number, unit: Unit, weightKg: number): number | null {
  const met = MET[name];
  if (met && (unit === "Min" || unit === "Std")) {
    const hours = unit === "Min" ? amount / 60 : amount;
    // Net-MET: subtract resting metabolism (1 MET) to avoid double-counting
    return Math.round((met - 1) * weightKg * hours);
  }
  const perRep = KCAL_PER_REP[name];
  if (perRep && unit === "Stück") return Math.round(perRep * amount);
  return null;
}

interface Props { userId: string; }

const SUGGESTIONS: { label: string; unit: Unit }[] = [
  { label: "Liegestützen", unit: "Stück" },
  { label: "Klimmzüge",   unit: "Stück" },
  { label: "Sit-ups",     unit: "Stück" },
  { label: "Kniebeugen",  unit: "Stück" },
  { label: "Laufen",      unit: "Min"   },
  { label: "Radfahren",   unit: "Min"   },
  { label: "Schwimmen",   unit: "Min"   },
  { label: "Yoga",        unit: "Min"   },
];

function monthLabel(year: number, month: number, locale: string) {
  return new Date(year, month, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

export default function SportTab({ userId }: Props) {
  const { lang, t } = useLanguage();
  const locale = lang === "ru" ? "ru-RU" : "de-DE";

  const [todayEntries,     setTodayEntries]     = useState<SportEntry[]>([]);
  const [thisMonthEntries, setThisMonthEntries] = useState<SportEntry[]>([]);
  const [lastMonthEntries, setLastMonthEntries] = useState<SportEntry[]>([]);
  const [activityName, setActivityName] = useState("");
  const [amount,       setAmount]       = useState("");
  const [unit,         setUnit]         = useState<Unit>("Stück");
  const [saving,       setSaving]       = useState(false);
  const [showAll,      setShowAll]      = useState(false);
  const [todaySteps,   setTodaySteps]   = useState(0);
  const [stepsInput,   setStepsInput]   = useState("");
  const [burnedKcal,   setBurnedKcal]   = useState("");
  const [userWeight,   setUserWeight]   = useState(75);

  const now   = new Date();
  const today = now.toISOString().split("T")[0];

  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("sport_entries")
      .select("id,activity_name,amount,unit,entry_date,burned_kcal")
      .eq("user_id", userId)
      .gte("entry_date", lastMonthStart)
      .order("created_at", { ascending: false });

    const all = (data ?? []) as SportEntry[];
    setTodayEntries(all.filter((e) => e.entry_date === today));
    setThisMonthEntries(all.filter((e) => e.entry_date >= thisMonthStart));
    setLastMonthEntries(all.filter((e) => e.entry_date >= lastMonthStart && e.entry_date <= lastMonthEnd));
  }, [userId, today, thisMonthStart, lastMonthStart, lastMonthEnd]);

  const loadSteps = useCallback(async () => {
    const { data } = await supabase
      .from("daily_steps").select("steps")
      .eq("user_id", userId).eq("logged_at", today).maybeSingle();
    setTodaySteps(data?.steps ?? 0);
  }, [userId, today]);

  useEffect(() => {
    load();
    loadSteps();
    supabase.from("body_profile").select("current_weight,start_weight").eq("user_id", userId).maybeSingle()
      .then(({ data }) => {
        const w = parseFloat(data?.current_weight ?? data?.start_weight ?? "75");
        if (w > 0) setUserWeight(w);
      });
  }, [load, loadSteps, userId]);

  // Auto-suggest burned kcal when activity / amount / unit changes
  useEffect(() => {
    const amtNum = parseFloat(amount);
    if (!activityName || !amtNum) { setBurnedKcal(""); return; }
    const suggestion = suggestKcal(activityName, amtNum, unit, userWeight);
    if (suggestion !== null) setBurnedKcal(String(suggestion));
    // don't clear manual entries for unknown activities
  }, [activityName, amount, unit, userWeight]);

  async function handleSaveSteps() {
    const s = parseInt(stepsInput, 10);
    if (!s || s < 0) return;
    await supabase.from("daily_steps").upsert(
      { user_id: userId, logged_at: today, steps: s, updated_at: new Date().toISOString() },
      { onConflict: "user_id,logged_at" }
    );
    setTodaySteps(s);
    setStepsInput("");
    toast.success(t.toastStepsSaved, { description: `${s.toLocaleString()} ${t.stepsLabel} · +${Math.round(s * 0.04)} kcal` });
  }

  async function handleAdd() {
    if (!activityName.trim() || !amount) return;
    setSaving(true);
    const kcalVal = parseInt(burnedKcal, 10);
    const { error } = await supabase.from("sport_entries").insert({
      user_id: userId, entry_date: today,
      activity_name: activityName.trim(), amount: parseFloat(amount), unit,
      burned_kcal: kcalVal > 0 ? kcalVal : null,
    });
    if (!error) {
      const kcal = parseInt(burnedKcal, 10);
      toast.success(t.toastActivityAdded, {
        description: `${activityName.trim()} · ${amount} ${unit}${kcal > 0 ? ` · -${kcal} kcal` : ""}`,
      });
      setActivityName(""); setAmount(""); setBurnedKcal("");
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("sport_entries").delete().eq("id", id);
    await load();
    toast(t.toastActivityRemoved);
  }

  // Monthly challenge metrics
  const thisCount  = thisMonthEntries.length;
  const lastCount  = lastMonthEntries.length;
  const isFirst    = lastCount === 0;
  const isRecord   = !isFirst && thisCount > lastCount;
  const remaining  = Math.max(0, lastCount - thisCount);
  const progress   = isFirst ? (thisCount > 0 ? 100 : 0) : lastCount > 0 ? Math.min((thisCount / lastCount) * 100, 100) : 0;

  // Activity breakdown for this month
  const breakdown: Record<string, { count: number; total: number; unit: string }> = {};
  for (const e of thisMonthEntries) {
    if (!breakdown[e.activity_name]) breakdown[e.activity_name] = { count: 0, total: 0, unit: e.unit };
    breakdown[e.activity_name].count += 1;
    breakdown[e.activity_name].total += Number(e.amount);
  }
  const breakdownEntries = Object.entries(breakdown).sort((a, b) => b[1].count - a[1].count);

  const card = "gc rounded-2xl";
  const visibleToday = showAll ? todayEntries : todayEntries.slice(0, 4);
  const totalBurnedToday = useMemo(
    () => todayEntries.reduce((s, e) => s + (e.burned_kcal ?? 0), 0),
    [todayEntries]
  );

  return (
    <div className="space-y-4">

      {/* ── Monthly Challenge ── */}
      <div className={`${card} p-5 overflow-hidden relative`}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top right, rgba(16,185,129,0.08) 0%, transparent 60%)" }} />

        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
            {isRecord
              ? <Trophy size={15} className="text-white" />
              : <Flame size={15} className="text-white" />
            }
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">{t.sportMonthlyChallenge}</p>
          <span className="ml-auto text-xs text-slate-400">
            {monthLabel(now.getFullYear(), now.getMonth(), locale)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-black/[0.07] dark:bg-white/[0.07] rounded-full h-2.5 overflow-hidden mb-3">
          <div
            className="h-2.5 rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: isRecord
                ? "linear-gradient(90deg,#f59e0b,#f97316)"
                : "linear-gradient(90deg,#10b981,#34d399)",
            }}
          />
        </div>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
              {thisCount}
              <span className="text-sm font-normal text-slate-500 ml-1.5">{t.sportWorkouts}</span>
            </p>
            {!isFirst && (
              <p className="text-xs text-slate-500 mt-0.5">
                {t.sportLastMonth}: <span className="font-medium">{lastCount}</span> · {monthLabel(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), locale)}
              </p>
            )}
          </div>
          <div className="sm:text-right">
            {isFirst && thisCount === 0 && (
              <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-400">{t.sportFirstMonth}</p>
            )}
            {isFirst && thisCount > 0 && (
              <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-400">
                {t.sportKeepGoing} 💪
              </p>
            )}
            {!isFirst && isRecord && (
              <p className="text-sm font-bold text-amber-500 dark:text-amber-400">{t.sportNewRecord}</p>
            )}
            {!isFirst && !isRecord && remaining > 0 && (
              <p className="text-xs text-slate-500">
                {t.sportRemaining} <span className="font-bold text-emerald-600 dark:text-emerald-400">{remaining}</span> {t.sportToRecord}
              </p>
            )}
            {!isFirst && !isRecord && remaining === 0 && thisCount === lastCount && (
              <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-400">{t.sportEqualRecord} 🎯</p>
            )}
          </div>
        </div>

        {/* Activity breakdown */}
        {breakdownEntries.length > 0 && (
          <div className="mt-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.07]">
            <div className="flex flex-wrap gap-2">
              {breakdownEntries.map(([name, stats]) => (
                <div key={name}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                >
                  <Dumbbell size={11} />
                  <span className="font-medium">{name}</span>
                  <span className="text-emerald-600/70 dark:text-emerald-400/60">
                    {stats.count}× · {stats.total % 1 === 0 ? stats.total : stats.total.toFixed(1)} {stats.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Log form ── */}
      <div className={`${card} p-5`}>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
          {t.sportLogTitle}
        </p>

        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => { setActivityName(s.label); setUnit(s.unit); }}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                activityName === s.label
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "border-black/[0.08] dark:border-white/[0.10] text-slate-500 dark:text-slate-400 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          <input
            type="text"
            value={activityName}
            onChange={(e) => setActivityName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={t.sportActivityPlaceholder}
            className="gi w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
          />

          <div className="flex gap-2">
            {/* Amount */}
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={t.sportAmount}
              min="0.1"
              step="0.1"
              className="gi flex-1 min-w-0 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            />

            {/* Unit toggle */}
            <div className="flex rounded-xl overflow-hidden border border-black/[0.08] dark:border-white/[0.10] shrink-0 flex-none">
              {(["Stück", "Min", "Std"] as Unit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`px-2 py-3 text-xs font-semibold transition-colors ${
                    unit === u
                      ? "bg-emerald-500 text-white"
                      : "text-slate-500 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>

            <button
              onClick={handleAdd}
              disabled={!activityName.trim() || !amount || saving}
              className="flex items-center gap-1.5 text-white font-semibold rounded-xl px-3 py-3 text-sm transition-all disabled:opacity-30 shrink-0"
              style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 4px 16px rgba(16,185,129,0.30)" }}
            >
              <Plus size={15} />
            </button>
          </div>

          {/* Burned kcal */}
          <div className="flex items-center gap-2">
            <Flame size={14} className="text-orange-500 shrink-0" />
            <input
              type="number"
              value={burnedKcal}
              onChange={(e) => setBurnedKcal(e.target.value)}
              placeholder={t.sportBurnedKcalPlaceholder}
              min="0"
              className="gi flex-1 min-w-0 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
            />
            <span className="text-xs text-slate-400 shrink-0">kcal</span>
          </div>
        </div>
      </div>

      {/* ── Today's entries ── */}
      {todayEntries.length === 0 ? (
        <div className="text-center py-8">
          <Dumbbell size={28} className="text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">{t.sportNoActivitiesToday}</p>
          <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">{t.sportNoActivitiesSubtitle}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleToday.map((e) => (
            <div key={e.id} className={`${card} px-4 py-3.5 flex items-center justify-between`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Dumbbell size={13} className="text-emerald-500 dark:text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{e.activity_name}</p>
              </div>
              <div className="flex items-center gap-3 ml-3 shrink-0">
                {e.burned_kcal != null && e.burned_kcal > 0 && (
                  <span className="text-xs font-semibold text-orange-500 dark:text-orange-400 tabular-nums">
                    -{e.burned_kcal} kcal
                  </span>
                )}
                <span className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {Number(e.amount) % 1 === 0 ? e.amount : Number(e.amount).toFixed(1)}
                  <span className="text-xs font-normal text-slate-500 ml-1">{e.unit}</span>
                </span>
                <button
                  onClick={() => handleDelete(e.id)}
                  className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {todayEntries.length > 4 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ChevronDown size={14} className={`transition-transform ${showAll ? "rotate-180" : ""}`} />
              {showAll ? t.sportShowLess : `${todayEntries.length - 4} ${t.sportShowMore}`}
            </button>
          )}
        </div>
      )}

      {/* ── Steps ── */}
      <div className={`${card} p-5`}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-teal-500/15 rounded-xl flex items-center justify-center shrink-0">
            <Activity size={16} className="text-teal-500 dark:text-teal-400" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.stepsToday}</p>
          <div className="ml-auto flex items-center gap-2">
            {totalBurnedToday > 0 && (
              <span className="text-xs font-semibold text-orange-500 dark:text-orange-400">
                -{totalBurnedToday} kcal {t.sportBurnedTotal}
              </span>
            )}
            {todaySteps > 0 && (
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                +{Math.round(todaySteps * 0.04)} kcal
              </span>
            )}
          </div>
        </div>
        {todaySteps > 0 && (
          <p className="text-2xl font-bold tabular-nums text-teal-600 dark:text-teal-400 mb-3">
            {todaySteps.toLocaleString()}
            <span className="text-sm font-normal text-slate-500 ml-1.5">{t.stepsLabel}</span>
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="number"
            value={stepsInput}
            onChange={(e) => setStepsInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveSteps()}
            placeholder={todaySteps > 0 ? String(todaySteps) : t.stepsPlaceholder}
            min="0"
            className="gi flex-1 min-w-0 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
          />
          <button
            onClick={handleSaveSteps}
            disabled={!stepsInput}
            className="flex items-center gap-1.5 font-semibold rounded-xl px-3 py-3 text-sm transition-all disabled:opacity-30 text-white whitespace-nowrap shrink-0"
            style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)", boxShadow: "0 4px 16px rgba(20,184,166,0.30)" }}
          >
            <Check size={14} /> {t.logSteps}
          </button>
        </div>
      </div>
    </div>
  );
}
