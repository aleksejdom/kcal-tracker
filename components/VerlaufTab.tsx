"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { TrendingDown, TrendingUp, Minus, Trash2, Activity, ChevronDown, Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

interface DayEntry { date: string; total: number; count: number; }
interface FoodItem { id: string; name: string; calories: number; protein: number; fat: number; entry_time: string; }
interface SportItem { id: string; activity_name: string; amount: number; unit: string; }
interface Props { userId: string; budget: number; }

export default function VerlaufTab({ userId, budget }: Props) {
  const { lang, t } = useLanguage();
  const [history, setHistory]       = useState<DayEntry[]>([]);
  const [stepsMap, setStepsMap]     = useState<Record<string, number>>({});
  const [foodByDate,   setFoodByDate]   = useState<Record<string, FoodItem[]>>({});
  const [sportByDate,  setSportByDate]  = useState<Record<string, SportItem[]>>({});
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const from = thirtyDaysAgo.toISOString().split("T")[0];

    const [{ data: foodData }, { data: stepsData }, { data: sportData }] = await Promise.all([
      supabase.from("food_entries")
        .select("id,entry_date,name,calories,protein,fat,entry_time")
        .eq("user_id", userId).gte("entry_date", from)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase.from("daily_steps").select("logged_at,steps")
        .eq("user_id", userId).gte("logged_at", from),
      supabase.from("sport_entries")
        .select("id,entry_date,activity_name,amount,unit")
        .eq("user_id", userId).gte("entry_date", from)
        .order("created_at", { ascending: true }),
    ]);

    const grouped: Record<string, DayEntry> = {};
    const byDate: Record<string, FoodItem[]> = {};

    for (const row of foodData ?? []) {
      if (!grouped[row.entry_date]) {
        grouped[row.entry_date] = { date: row.entry_date, total: 0, count: 0 };
        byDate[row.entry_date] = [];
      }
      grouped[row.entry_date].total += row.calories;
      grouped[row.entry_date].count += 1;
      byDate[row.entry_date].push({
        id: row.id, name: row.name, calories: row.calories,
        protein: row.protein, fat: row.fat, entry_time: row.entry_time,
      });
    }

    setHistory(Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)));
    setFoodByDate(byDate);

    const sm: Record<string, number> = {};
    for (const row of stepsData ?? []) sm[row.logged_at] = row.steps;
    setStepsMap(sm);

    const sd: Record<string, SportItem[]> = {};
    for (const row of sportData ?? []) {
      if (!sd[row.entry_date]) sd[row.entry_date] = [];
      sd[row.entry_date].push({ id: row.id, activity_name: row.activity_name, amount: row.amount, unit: row.unit });
    }
    setSportByDate(sd);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  function toggleDay(date: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  async function executeDeleteDay(date: string) {
    const { error } = await supabase
      .from("food_entries").delete().eq("user_id", userId).eq("entry_date", date);
    if (!error) {
      setHistory((prev) => prev.filter((d) => d.date !== date));
      setFoodByDate((prev)  => { const next = { ...prev };  delete next[date]; return next; });
      setSportByDate((prev) => { const next = { ...prev };  delete next[date]; return next; });
      setExpandedDays((prev) => { const next = new Set(prev); next.delete(date); return next; });
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

  const deficit     = history.reduce((s, d) => s + Math.max(0, budget - d.total), 0);
  const daysUnder   = history.filter((d) => d.total <= budget).length;
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
          <div className="space-y-2">
            {history.map((day) => {
              const steps           = stepsMap[day.date] ?? 0;
              const burned          = Math.round(steps * 0.04);
              const effectiveBudget = budget + burned;
              const pct             = Math.min((day.total / effectiveBudget) * 100, 100);
              const over            = day.total > effectiveBudget;
              const isToday         = day.date === new Date().toISOString().split("T")[0];
              const diff            = effectiveBudget - day.total;
              const expanded        = expandedDays.has(day.date);
              const items           = foodByDate[day.date]  ?? [];
              const sportItems      = sportByDate[day.date] ?? [];

              return (
                <div key={day.date} className="border border-black/[0.06] dark:border-white/[0.07] rounded-xl overflow-hidden">
                  {/* Day header — clickable */}
                  <button
                    onClick={() => toggleDay(day.date)}
                    className="w-full px-3 sm:px-4 pt-3 pb-2.5 flex flex-col gap-1.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {/* Left: chevron + date */}
                      <ChevronDown
                        size={13}
                        className={`text-slate-400 transition-transform duration-200 shrink-0 ${expanded ? "rotate-180" : ""}`}
                      />
                      <span className={`text-sm truncate min-w-0 flex-1 ${isToday ? "font-bold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300 font-medium"}`}>
                        {fmtDate(day.date)}
                      </span>
                      {/* Right: diff + calories + delete — shrink-0 so they never wrap */}
                      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                        {steps > 0 && (
                          <span className="hidden sm:flex text-xs text-teal-600 dark:text-teal-400 font-medium items-center gap-0.5">
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
                          {day.total}<span className="text-xs font-normal text-slate-500 ml-0.5">kcal</span>
                        </span>
                        <span
                          onClick={(e) => { e.stopPropagation(); confirmDeleteDay(day); }}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                          title={t.deleteDayTitle}
                        >
                          <Trash2 size={13} />
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
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
                  </button>

                  {/* Expandable entries */}
                  {expanded && (items.length > 0 || sportItems.length > 0 || steps > 0) && (
                    <div className="border-t border-black/[0.06] dark:border-white/[0.07] divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                      {items.map((item) => (
                        <div key={item.id} className="px-4 py-2.5 flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {item.entry_time}
                              {(Number(item.protein) > 0 || Number(item.fat) > 0) && <span className="mx-1 text-slate-300 dark:text-slate-600">·</span>}
                              {Number(item.protein) > 0 && <span className="text-emerald-600 dark:text-emerald-400">E {Math.round(Number(item.protein) * 10) / 10}g</span>}
                              {Number(item.fat) > 0 && <span className="ml-1 text-orange-600 dark:text-orange-400">F {Math.round(Number(item.fat) * 10) / 10}g</span>}
                            </p>
                          </div>
                          <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-300 ml-3 shrink-0">
                            {item.calories} <span className="text-xs font-normal text-slate-400">kcal</span>
                          </span>
                        </div>
                      ))}
                      {/* Steps row — only shown on mobile (hidden in header via sm:flex) */}
                      {steps > 0 && (
                        <div className="sm:hidden px-4 py-2 flex items-center gap-2 bg-teal-500/[0.04]">
                          <Activity size={12} className="text-teal-500 shrink-0" />
                          <span className="text-xs text-teal-600 dark:text-teal-400 font-medium">
                            {steps.toLocaleString(locale)} {t.stepsLabel} · +{burned} kcal
                          </span>
                        </div>
                      )}
                      {sportItems.length > 0 && (
                        <>
                          {items.length > 0 && (
                            <div className="px-4 py-1.5 flex items-center gap-2">
                              <div className="h-px flex-1 bg-black/[0.05] dark:bg-white/[0.05]" />
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                <Dumbbell size={9} /> {t.sportHistoryLabel}
                              </span>
                              <div className="h-px flex-1 bg-black/[0.05] dark:bg-white/[0.05]" />
                            </div>
                          )}
                          {sportItems.map((s) => (
                            <div key={s.id} className="px-4 py-2.5 flex items-center justify-between bg-emerald-500/[0.03]">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Dumbbell size={12} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                                <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{s.activity_name}</p>
                              </div>
                              <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 ml-3 shrink-0">
                                {Number(s.amount) % 1 === 0 ? s.amount : Number(s.amount).toFixed(1)}
                                <span className="text-xs font-normal text-slate-400 ml-1">{s.unit}</span>
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
