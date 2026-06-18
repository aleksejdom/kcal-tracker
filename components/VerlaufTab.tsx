"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { TrendingDown, TrendingUp, Minus, Trash2, Activity, ChevronDown, Dumbbell, Target, Info } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

interface DayEntry { date: string; total: number; count: number; }
interface FoodItem { id: string; name: string; calories: number; protein: number; fat: number; entry_time: string; }
interface SportItem { id: string; activity_name: string; amount: number; unit: string; burned_kcal: number | null; }
interface Props { userId: string; budget: number; deficit: number; }

type PrognosisResult =
  | { state: "noData" }
  | { state: "goalReached" }
  | { state: "noTdee" }
  | { state: "impossible" }
  | { state: "ok"; remainingKg: string; remainingKcal: string; goalDateStr: string };

/* ─── Info Tooltip ─────────────────────────────────────── */
function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isTouchRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative inline-flex shrink-0"
      onTouchStart={() => { isTouchRef.current = true; }}
      onMouseEnter={() => { if (!isTouchRef.current) setOpen(true); }}
      onMouseLeave={() => { if (!isTouchRef.current) setOpen(false); }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors ml-1 flex items-center justify-center p-[11px] sm:p-0.5 -m-[11px] sm:m-0 sm:ml-1"
        aria-label="Erklärung"
      >
        <Info className="w-[30px] h-[30px] sm:w-3 sm:h-3" />
      </button>
      {open && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-black/[0.06] dark:border-white/[0.10] p-3">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{text}</p>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2">
            <svg width="12" height="6" viewBox="0 0 12 6" className="overflow-visible">
              <path d="M0 0 L6 6 L12 0Z" className="fill-white dark:fill-slate-800" />
              <path d="M0 0 L6 6 L12 0" fill="none" stroke="black" strokeOpacity="0.06" strokeWidth="1" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Analysis Row ──────────────────────────────────────── */
function AnalysisRow({
  label,
  value,
  valueClass = "text-slate-900 dark:text-white font-semibold",
  tooltip,
}: {
  label: string;
  value: string;
  valueClass?: string;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center min-w-0">
        <span className="text-sm text-slate-500 leading-snug">{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <span className={`text-sm tabular-nums ml-3 shrink-0 ${valueClass}`}>{value}</span>
    </div>
  );
}

/* ─── Section Header ────────────────────────────────────── */
function SectionHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
        {title}
      </p>
      <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5 leading-snug">{sub}</p>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────── */
export default function VerlaufTab({ userId, budget, deficit }: Props) {
  const { lang, t } = useLanguage();
  const [history, setHistory]           = useState<DayEntry[]>([]);
  const [stepsMap, setStepsMap]         = useState<Record<string, number>>({});
  const [foodByDate, setFoodByDate]     = useState<Record<string, FoodItem[]>>({});
  const [sportByDate, setSportByDate]   = useState<Record<string, SportItem[]>>({});
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [goalWeight, setGoalWeight]     = useState<number | null>(null);
  const [userHeight, setUserHeight]     = useState<number | null>(null);
  const [userAge, setUserAge]           = useState<number | null>(null);
  const [userGender, setUserGender]     = useState<"male" | "female" | null>(null);
  const [analysisPeriod, setAnalysisPeriod] = useState<7 | 30>(7);
  const sportToastRef = useRef(false);

  const locale = lang === "ru" ? "ru-RU" : "de-DE";
  const tdee = budget + deficit;
  const hasTdeeData = deficit > 0;

  // Dynamic baseTdee from body profile (BMR × 1.2 sedentary baseline)
  const baseTdee = useMemo(() => {
    if (!currentWeight || !userHeight || !userAge || !userGender) return null;
    const bmr = 10 * currentWeight + 6.25 * userHeight - 5 * userAge + (userGender === "male" ? 5 : -161);
    return Math.round(bmr * 1.2);
  }, [currentWeight, userHeight, userAge, userGender]);

  const load = useCallback(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const from = thirtyDaysAgo.toISOString().split("T")[0];

    const [
      { data: foodData },
      { data: stepsData },
      { data: sportData },
      { data: profileData },
    ] = await Promise.all([
      supabase
        .from("food_entries")
        .select("id,entry_date,name,calories,protein,fat,entry_time")
        .eq("user_id", userId).gte("entry_date", from)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase.from("daily_steps").select("logged_at,steps")
        .eq("user_id", userId).gte("logged_at", from),
      supabase
        .from("sport_entries")
        .select("id,entry_date,activity_name,amount,unit,burned_kcal")
        .eq("user_id", userId).gte("entry_date", from)
        .order("created_at", { ascending: true }),
      supabase.from("body_profile")
        .select("current_weight,goal_weight,height_cm,age,gender")
        .eq("user_id", userId).maybeSingle(),
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
      sd[row.entry_date].push({
        id: row.id, activity_name: row.activity_name, amount: row.amount, unit: row.unit, burned_kcal: row.burned_kcal ?? null,
      });
    }
    setSportByDate(sd);

    if (profileData) {
      setCurrentWeight(profileData.current_weight != null ? parseFloat(profileData.current_weight) : null);
      setGoalWeight(profileData.goal_weight != null ? parseFloat(profileData.goal_weight) : null);
      setUserHeight(profileData.height_cm ?? null);
      setUserAge(profileData.age ?? null);
      setUserGender((profileData.gender as "male" | "female") ?? null);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Sport-burned sum per day
  const sportBurnedByDate = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [date, items] of Object.entries(sportByDate)) {
      result[date] = items.reduce((s, e) => s + (e.burned_kcal ?? 0), 0);
    }
    return result;
  }, [sportByDate]);

  // Toast if no sport for more than 3 days
  useEffect(() => {
    if (sportToastRef.current || history.length === 0) return;
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 3);
    const thresholdStr = threshold.toISOString().split("T")[0];
    const hasRecentSport = Object.keys(sportByDate).some((d) => d >= thresholdStr);
    if (!hasRecentSport) {
      sportToastRef.current = true;
      const lastDate = Object.keys(sportByDate).sort().reverse()[0];
      const daysSince = lastDate
        ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
        : null;
      toast("Zeit für Sport! 💪", {
        description: daysSince
          ? `Dein letztes Training war vor ${daysSince} Tagen. Bleib aktiv!`
          : "Du hast noch kein Training eingetragen. Fang heute an!",
        duration: 8000,
      });
    }
  }, [history, sportByDate]);

  function toggleDay(date: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  }

  async function executeDeleteDay(date: string) {
    const { error } = await supabase
      .from("food_entries").delete().eq("user_id", userId).eq("entry_date", date);
    if (!error) {
      setHistory((prev) => prev.filter((d) => d.date !== date));
      setFoodByDate((prev)  => { const next = { ...prev }; delete next[date]; return next; });
      setSportByDate((prev) => { const next = { ...prev }; delete next[date]; return next; });
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

  function fmtDate(d: string) {
    const today = new Date().toISOString().split("T")[0];
    if (d === today) return t.todayLabel;
    return new Date(d + "T00:00:00").toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  }

  // Summary stats (all 30 tracked days)
  const weightForStats = currentWeight ?? 75;
  const daysUnder = history.filter((d) => {
    const sportB = sportBurnedByDate[d.date] ?? 0;
    const stepB  = Math.round((stepsMap[d.date] ?? 0) * 0.04 * (weightForStats / 75));
    const effBudget = baseTdee ? (baseTdee - deficit) + sportB + stepB : budget + sportB + stepB;
    return d.total <= effBudget;
  }).length;
  const stepsValues = Object.values(stepsMap).filter((v) => v > 0);
  const avgStepsVal = stepsValues.length > 0
    ? Math.round(stepsValues.reduce((s, v) => s + v, 0) / stepsValues.length) : 0;
  const avgDiffAll = history.length > 0
    ? Math.round(history.reduce((s, d) => {
        const sportB = sportBurnedByDate[d.date] ?? 0;
        const stepB  = Math.round((stepsMap[d.date] ?? 0) * 0.04 * (weightForStats / 75));
        const effBudget = baseTdee ? (baseTdee - deficit) + sportB + stepB : budget + sportB + stepB;
        return s + (d.total - effBudget);
      }, 0) / history.length) : 0;
  const diffDesc = avgDiffAll > 0 ? t.overGoalText : avgDiffAll < 0 ? t.underGoalText : t.exactGoalText;
  const diffDescColor = avgDiffAll > 0
    ? "text-red-500 dark:text-red-400"
    : avgDiffAll < 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-slate-400";

  // Zielanalyse: data for selected period
  const analysisData = useMemo(() => {
    if (history.length === 0) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - analysisPeriod);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    const days = history.filter((d) => d.date >= cutoffStr);
    const n = days.length;
    if (n === 0) return null;

    const avgCal = Math.round(days.reduce((s, d) => s + d.total, 0) / n);
    const w = weightForStats;
    const avgDiff = Math.round(days.reduce((s, d) => {
      const sportB = sportBurnedByDate[d.date] ?? 0;
      const stepB  = Math.round((stepsMap[d.date] ?? 0) * 0.04 * (w / 75));
      const effBudget = baseTdee ? (baseTdee - deficit) + sportB + stepB : budget + sportB + stepB;
      return s + (d.total - effBudget);
    }, 0) / n);
    const avgRealDeficit = hasTdeeData
      ? Math.round(days.reduce((s, d) => {
          const sportB = sportBurnedByDate[d.date] ?? 0;
          const stepB  = Math.round((stepsMap[d.date] ?? 0) * 0.04 * (w / 75));
          const maintenance = (baseTdee ?? tdee) + sportB + stepB;
          return s + (maintenance - d.total);
        }, 0) / n)
      : null;

    return { n, avgCal, avgDiff, avgRealDeficit };
  }, [history, budget, deficit, tdee, hasTdeeData, analysisPeriod, sportBurnedByDate, stepsMap, baseTdee, weightForStats]);

  // Prognosis
  const prognosis = useMemo((): PrognosisResult => {
    if (currentWeight == null || goalWeight == null) return { state: "noData" };
    const remaining = currentWeight - goalWeight;
    if (remaining <= 0) return { state: "goalReached" };
    if (!hasTdeeData) return { state: "noTdee" };
    const avgRD = analysisData?.avgRealDeficit;
    if (avgRD == null || avgRD <= 0) return { state: "impossible" };

    const remainingKcal = Math.round(remaining * 7700);
    const daysToGoal = Math.round(remainingKcal / avgRD);
    const goalDate = new Date();
    goalDate.setDate(goalDate.getDate() + daysToGoal);

    return {
      state: "ok",
      remainingKg: remaining.toFixed(1),
      remainingKcal: remainingKcal.toLocaleString(locale),
      goalDateStr: goalDate.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }),
    };
  }, [currentWeight, goalWeight, hasTdeeData, analysisData, locale]);

  const card = "gc rounded-2xl";

  return (
    <div className="space-y-4">

      {/* ── Summary strip ── */}
      {history.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: t.daysTracked,
              value: history.length,
              icon: <Minus size={14} className="text-slate-500" />,
              color: "text-slate-900 dark:text-white",
            },
            {
              label: t.inGoal,
              value: daysUnder,
              icon: <TrendingDown size={14} className="text-emerald-500 dark:text-emerald-400" />,
              color: "text-emerald-600 dark:text-emerald-300",
            },
            {
              label: t.avgDiffToTarget,
              value: `${avgDiffAll >= 0 ? "+" : ""}${avgDiffAll}`,
              sub: "kcal",
              description: diffDesc,
              descColor: diffDescColor,
              tooltip: t.tipAvgDiff,
              icon: avgDiffAll > 0
                ? <TrendingUp size={14} className="text-red-500 dark:text-red-400" />
                : <TrendingDown size={14} className="text-blue-500 dark:text-blue-400" />,
              color: avgDiffAll > 0 ? "text-red-500 dark:text-red-400" : "text-blue-600 dark:text-blue-300",
            },
            {
              label: t.avgSteps,
              value: avgStepsVal > 0 ? avgStepsVal.toLocaleString(locale) : "—",
              icon: <Activity size={14} className="text-teal-500 dark:text-teal-400" />,
              color: "text-teal-600 dark:text-teal-300",
            },
          ].map((s) => (
            <div key={s.label} className={`${card} p-4 text-center`}>
              <div className="flex items-center justify-center mb-2">{s.icon}</div>
              <p className={`text-xl font-bold tabular-nums ${s.color}`}>
                {s.value}
                {"sub" in s && <span className="text-xs font-normal text-slate-500 ml-0.5">{s.sub}</span>}
              </p>
              {"description" in s && "descColor" in s && s.description && (
                <p className={`text-[11px] font-semibold mt-1 leading-tight ${s.descColor}`}>
                  {s.description}
                </p>
              )}
              <div className="flex items-center justify-center gap-0.5 mt-0.5">
                <p className="text-xs text-slate-500 leading-tight">{s.label}</p>
                {"tooltip" in s && s.tooltip && <InfoTooltip text={s.tooltip} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Zielanalyse ── */}
      {history.length > 0 && (
        <div className={`${card} p-5`}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-violet-500/15 rounded-xl flex items-center justify-center">
              <Target size={16} className="text-violet-500 dark:text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.goalAnalysisTitle}</p>
          </div>

          {/* GEPLANT */}
          <div className="mb-5">
            <SectionHeading title={t.plannedSection} sub={t.tipSectionPlanned} />
            <AnalysisRow
              label={t.calorieTargetLabel}
              value={`${budget} kcal`}
              tooltip={t.tipCalorieTarget}
            />
            {hasTdeeData && (
              <>
                <AnalysisRow
                  label={t.tdeeLabel}
                  value={`${tdee} kcal`}
                  tooltip={t.tipTdee}
                />
                <AnalysisRow
                  label={t.plannedDeficitLabel}
                  value={`${tdee - budget} kcal/Tag`}
                  valueClass="text-violet-600 dark:text-violet-400 font-semibold"
                  tooltip={t.tipPlannedDeficit}
                />
              </>
            )}
          </div>

          <div className="h-px bg-black/[0.05] dark:bg-white/[0.06] mb-5" />

          {/* TATSÄCHLICH */}
          <div className="mb-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {t.actualSection}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5 leading-snug">
                  {t.tipSectionActual}
                </p>
              </div>
              <div className="flex gap-1 bg-black/[0.05] dark:bg-white/[0.06] rounded-xl p-0.5 shrink-0">
                {([7, 30] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setAnalysisPeriod(d)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                      analysisPeriod === d
                        ? "text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                    }`}
                    style={analysisPeriod === d ? { background: "linear-gradient(135deg, #3b82f6, #6366f1)" } : {}}
                  >
                    {d === 7 ? t.period7d : t.period30d}
                  </button>
                ))}
              </div>
            </div>
            {analysisData ? (
              <>
                <AnalysisRow
                  label={t.avgCalorieIntake}
                  value={`${analysisData.avgCal} kcal`}
                  tooltip={t.tipAvgCalorieIntake}
                />
                <AnalysisRow
                  label={t.avgDiffToTarget}
                  value={`${analysisData.avgDiff >= 0 ? "+" : ""}${analysisData.avgDiff} kcal`}
                  valueClass={analysisData.avgDiff > 0
                    ? "text-red-500 dark:text-red-400 font-semibold"
                    : "text-emerald-600 dark:text-emerald-400 font-semibold"}
                  tooltip={t.tipAvgDiff}
                />
                {analysisData.avgRealDeficit !== null && (
                  <AnalysisRow
                    label={t.avgEnergyDeficit}
                    value={`${analysisData.avgRealDeficit} kcal`}
                    valueClass={analysisData.avgRealDeficit > 0
                      ? "text-blue-600 dark:text-blue-400 font-semibold"
                      : "text-red-500 dark:text-red-400 font-semibold"}
                    tooltip={t.tipAvgEnergyDeficit}
                  />
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400">{t.noHistory}</p>
            )}
          </div>

          {/* PROGNOSE */}
          {hasTdeeData && (
            <>
              <div className="h-px bg-black/[0.05] dark:bg-white/[0.06] mb-5" />
              <div>
                <SectionHeading title={t.forecastSection} sub={t.tipSectionForecast} />
                {prognosis.state === "noData" && (
                  <p className="text-xs text-slate-400">{t.noBodyDataForForecast}</p>
                )}
                {prognosis.state === "goalReached" && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">🎉 {t.goalReached}</p>
                )}
                {prognosis.state === "noTdee" && (
                  <p className="text-xs text-slate-400">{t.noBodyDataForForecast}</p>
                )}
                {prognosis.state === "impossible" && (
                  <p className="text-xs text-red-500 dark:text-red-400">{t.noForecastPossible}</p>
                )}
                {prognosis.state === "ok" && (
                  <>
                    <AnalysisRow
                      label={t.remainingWeightLabel}
                      value={`${prognosis.remainingKg} kg`}
                      tooltip={t.tipRemainingWeight}
                    />
                    <AnalysisRow
                      label={t.remainingKcalLabel}
                      value={`${prognosis.remainingKcal} kcal`}
                      tooltip={t.tipRemainingKcal}
                    />
                    <AnalysisRow
                      label={t.estimatedGoalDateLabel}
                      value={prognosis.goalDateStr}
                      valueClass="text-blue-600 dark:text-blue-400 font-semibold"
                      tooltip={t.tipGoalDate}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── History list ── */}
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
              const steps          = stepsMap[day.date] ?? 0;
              const weightForCalc  = currentWeight ?? 75;
              const burned         = Math.round(steps * 0.04 * (weightForCalc / 75));
              const sportBurnedDay = sportBurnedByDate[day.date] ?? 0;
              // Dynamic: baseTdee + net activity − deficit; fallback to stored budget
              const effectiveDayBudget = baseTdee
                ? (baseTdee - deficit) + burned + sportBurnedDay
                : budget + burned + sportBurnedDay;
              // Consistent realDeficit: maintenance − consumed
              const maintenanceToday = (baseTdee ?? tdee) + burned + sportBurnedDay;
              const diffToTarget = day.total - effectiveDayBudget;
              const over         = day.total > effectiveDayBudget;
              const pct          = Math.min((day.total / effectiveDayBudget) * 100, 100);
              const isToday      = day.date === new Date().toISOString().split("T")[0];
              const expanded     = expandedDays.has(day.date);
              const items        = foodByDate[day.date]  ?? [];
              const sportItems   = sportByDate[day.date] ?? [];
              const realDeficit  = hasTdeeData ? maintenanceToday - day.total : null;

              return (
                <div key={day.date} className="border border-black/[0.06] dark:border-white/[0.07] rounded-xl overflow-hidden">
                  {/* Day header */}
                  <button
                    onClick={() => toggleDay(day.date)}
                    className="w-full px-3 sm:px-4 pt-3 pb-2.5 flex flex-col gap-1.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ChevronDown
                        size={13}
                        className={`text-slate-400 transition-transform duration-200 shrink-0 ${expanded ? "rotate-180" : ""}`}
                      />
                      <span className={`text-sm truncate min-w-0 flex-1 ${isToday ? "font-bold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300 font-medium"}`}>
                        {fmtDate(day.date)}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                        {steps > 0 && (
                          <span className="hidden sm:flex text-xs text-teal-600 dark:text-teal-400 font-medium items-center gap-0.5">
                            <Activity size={11} /> {steps.toLocaleString(locale)}
                          </span>
                        )}
                        {sportBurnedDay > 0 && (
                          <span className="text-xs text-orange-500 dark:text-orange-400 font-medium flex items-center gap-0.5">
                            <Dumbbell size={11} /> -{sportBurnedDay}
                          </span>
                        )}
                        {!over && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                            <TrendingDown size={11} /> {Math.abs(diffToTarget)}
                          </span>
                        )}
                        {over && (
                          <span className="text-xs text-red-500 dark:text-red-400 font-medium flex items-center gap-0.5">
                            <TrendingUp size={11} /> +{Math.abs(diffToTarget)}
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

                    {/* Progress bar against fixed calorie target */}
                    <div className="w-full bg-black/[0.07] dark:bg-white/[0.07] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          over ? "bg-gradient-to-r from-red-400 to-rose-500" : "bg-gradient-to-r from-blue-400 to-violet-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>

                  {/* Expandable entries */}
                  {expanded && (items.length > 0 || sportItems.length > 0 || steps > 0) && (
                    <div className="border-t border-black/[0.06] dark:border-white/[0.07] divide-y divide-black/[0.04] dark:divide-white/[0.04]">

                      {/* Day summary row */}
                      <div className="px-4 py-2 flex items-center gap-3 flex-wrap bg-slate-50/50 dark:bg-white/[0.02]">
                        <span className="text-xs text-slate-500">
                          {t.calorieTargetLabel}:{" "}
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{effectiveDayBudget} kcal</span>
                          {(sportBurnedDay > 0 || burned > 0) && (
                            <span className="text-slate-400 ml-1">
                              ({budget}{sportBurnedDay > 0 ? ` +${sportBurnedDay} Sport` : ""}{burned > 0 ? ` +${burned} Schr.` : ""})
                            </span>
                          )}
                        </span>
                        <span className={`text-xs font-semibold ${diffToTarget > 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {t.differenceToTargetLabel}: {diffToTarget > 0 ? "+" : ""}{diffToTarget} kcal
                        </span>
                        {sportBurnedDay > 0 && (
                          <span className="text-xs font-semibold text-orange-500 dark:text-orange-400">
                            Sport: -{sportBurnedDay} kcal
                          </span>
                        )}
                        {realDeficit !== null && (
                          <span className={`text-xs font-semibold ${realDeficit > 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-500 dark:text-orange-400"}`}>
                            {t.realDeficitLabel}: {realDeficit} kcal
                          </span>
                        )}
                      </div>

                      {/* Food items */}
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

                      {/* Steps — mobile only */}
                      {steps > 0 && (
                        <div className="sm:hidden px-4 py-2 flex items-center gap-2 bg-teal-500/[0.04]">
                          <Activity size={12} className="text-teal-500 shrink-0" />
                          <span className="text-xs text-teal-600 dark:text-teal-400 font-medium">
                            {steps.toLocaleString(locale)} {t.stepsLabel} · +{burned} kcal
                          </span>
                        </div>
                      )}

                      {/* Sport items */}
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
                                <div className="min-w-0">
                                  <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{s.activity_name}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {Number(s.amount) % 1 === 0 ? s.amount : Number(s.amount).toFixed(1)}{" "}
                                    {s.unit}
                                  </p>
                                </div>
                              </div>
                              {s.burned_kcal != null && s.burned_kcal > 0 ? (
                                <span className="text-sm font-semibold tabular-nums text-orange-500 dark:text-orange-400 ml-3 shrink-0">
                                  -{s.burned_kcal} <span className="text-xs font-normal text-slate-400">kcal</span>
                                </span>
                              ) : (
                                <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 ml-3 shrink-0">
                                  {Number(s.amount) % 1 === 0 ? s.amount : Number(s.amount).toFixed(1)}
                                  <span className="text-xs font-normal text-slate-400 ml-1">{s.unit}</span>
                                </span>
                              )}
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
