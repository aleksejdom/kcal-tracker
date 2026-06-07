"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { TrendingDown, TrendingUp, Minus, Trash2, Activity } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

interface DayEntry { date: string; total: number; count: number; }
interface Props { userId: string; budget: number; }

export default function VerlaufTab({ userId, budget }: Props) {
  const { lang, t } = useLanguage();
  const [history, setHistory]   = useState<DayEntry[]>([]);
  const [stepsMap, setStepsMap] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const from = thirtyDaysAgo.toISOString().split("T")[0];

    const [{ data: foodData }, { data: stepsData }] = await Promise.all([
      supabase.from("food_entries").select("entry_date,calories")
        .eq("user_id", userId).gte("entry_date", from)
        .order("entry_date", { ascending: false }),
      supabase.from("daily_steps").select("logged_at,steps")
        .eq("user_id", userId).gte("logged_at", from),
    ]);

    const grouped: Record<string, DayEntry> = {};
    for (const row of foodData ?? []) {
      if (!grouped[row.entry_date]) grouped[row.entry_date] = { date: row.entry_date, total: 0, count: 0 };
      grouped[row.entry_date].total += row.calories;
      grouped[row.entry_date].count += 1;
    }
    setHistory(Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)));

    const sm: Record<string, number> = {};
    for (const row of stepsData ?? []) sm[row.logged_at] = row.steps;
    setStepsMap(sm);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function executeDeleteDay(date: string) {
    const { error } = await supabase
      .from("food_entries").delete().eq("user_id", userId).eq("entry_date", date);
    if (!error) {
      setHistory((prev) => prev.filter((d) => d.date !== date));
      toast.success(t.toastDayDeleted);
    }
  }

  function confirmDeleteDay(day: DayEntry) {
    toast.warning(t.deleteDayTitle, {
      description: fmtDate(day.date),
      action: { label: t.confirmYesDelete, onClick: () => executeDeleteDay(day.date) },
      cancel: { label: t.confirmCancel, onClick: () => {} },
      duration: 8000,
    });
  }

  const locale = lang === "ru" ? "ru-RU" : "de-DE";

  function fmtDate(d: string) {
    const today = new Date().toISOString().split("T")[0];
    if (d === today) return t.todayLabel;
    return new Date(d + "T00:00:00").toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  }

  const deficit    = history.reduce((s, d) => s + Math.max(0, budget - d.total), 0);
  const daysUnder  = history.filter((d) => d.total <= budget).length;
  const stepsValues = Object.values(stepsMap).filter((v) => v > 0);
  const avgStepsVal = stepsValues.length > 0 ? Math.round(stepsValues.reduce((s, v) => s + v, 0) / stepsValues.length) : 0;

  const card = "gc rounded-2xl";

  return (
    <div className="space-y-4">

      {/* Summary strip */}
      {history.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t.daysTracked, value: history.length, icon: <Minus size={14} className="text-slate-500" />, color: "text-slate-900 dark:text-white" },
            { label: t.inGoal, value: daysUnder, icon: <TrendingDown size={14} className="text-emerald-500 dark:text-emerald-400" />, color: "text-emerald-600 dark:text-emerald-300" },
            { label: t.avgDeficit, value: `${Math.round(deficit / history.length)}`, sub: "kcal", icon: <TrendingDown size={14} className="text-blue-500 dark:text-blue-400" />, color: "text-blue-600 dark:text-blue-300" },
            { label: t.avgSteps, value: avgStepsVal > 0 ? avgStepsVal.toLocaleString(locale) : "—", icon: <Activity size={14} className="text-teal-500 dark:text-teal-400" />, color: "text-teal-600 dark:text-teal-300" },
          ].map((s) => (
            <div key={s.label} className={`${card} p-4 text-center`}>
              <div className="flex items-center justify-center mb-2">{s.icon}</div>
              <p className={`text-xl font-bold tabular-nums ${s.color}`}>
                {s.value}
                {"sub" in s && s.sub && <span className="text-xs font-normal text-slate-500 ml-0.5">{s.sub}</span>}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* History list */}
      <div className={`${card} p-5`}>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-5">
          {t.historyTitle}
        </p>

        {history.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-slate-500">{t.noHistory}</p>
            <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">{t.noHistorySubtitle}</p>
          </div>
        ) : (
          <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-4 lg:space-y-0">
            {history.map((day) => {
              const steps   = stepsMap[day.date] ?? 0;
              const burned  = Math.round(steps * 0.04);
              const effectiveBudget = budget + burned;
              const pct     = Math.min((day.total / effectiveBudget) * 100, 100);
              const over    = day.total > effectiveBudget;
              const isToday = day.date === new Date().toISOString().split("T")[0];
              const diff    = effectiveBudget - day.total;
              return (
                <div key={day.date}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`text-sm ${isToday ? "font-bold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300 font-medium"}`}>
                      {fmtDate(day.date)}
                    </span>
                    <div className="flex items-center gap-2">
                      {steps > 0 && (
                        <span className="text-xs text-teal-600 dark:text-teal-400 font-medium flex items-center gap-0.5">
                          <Activity size={11} /> {steps.toLocaleString(locale)}
                        </span>
                      )}
                      {!over && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                          <TrendingDown size={11} /> {Math.abs(diff)}
                        </span>
                      )}
                      {over && (
                        <span className="text-xs text-red-500 dark:text-red-400 font-medium flex items-center gap-0.5">
                          <TrendingUp size={11} /> +{Math.abs(diff)}
                        </span>
                      )}
                      <span className={`text-sm font-semibold tabular-nums ${over ? "text-red-500 dark:text-red-400" : "text-slate-900 dark:text-white"}`}>
                        {day.total} <span className="text-xs font-normal text-slate-500">kcal</span>
                      </span>
                      <button
                        onClick={() => confirmDeleteDay(day)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title={t.deleteDayTitle}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="w-full bg-black/[0.07] dark:bg-white/[0.07] rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        over
                          ? "bg-gradient-to-r from-red-400 to-rose-500"
                          : "bg-gradient-to-r from-blue-400 to-violet-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
