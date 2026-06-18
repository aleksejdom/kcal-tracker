"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Check, Scale, Trash2, TrendingDown, TrendingUp, Minus, Target, Info } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  userId: string;
  onProfileSaved?: () => void;
  onGoalsApplied?: (budget: number, proteinGoal: number) => void;
}
interface BodyProfile {
  start_weight: string; goal_weight: string;
  height_cm: string; age: string; current_weight: string;
  gender: "male" | "female" | "";
}
interface WeightEntry { id: string; weight: number; logged_at: string; }
type Period = "7d" | "30d" | "365d";
type ActivityKey = "sedentary" | "light" | "moderate" | "active" | "very_active";

const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "365d": 365 };

const ACTIVITY_OPTIONS: { key: ActivityKey; mult: number; labelKey: keyof typeof import("@/lib/translations").translations.de }[] = [
  { key: "sedentary",   mult: 1.20, labelKey: "activitySedentary"  },
  { key: "light",       mult: 1.375, labelKey: "activityLight"     },
  { key: "moderate",    mult: 1.55, labelKey: "activityModerate"   },
  { key: "active",      mult: 1.725, labelKey: "activityActive"    },
  { key: "very_active", mult: 1.90, labelKey: "activityVeryActive" },
];

/* ─────────────── SVG Chart ─────────────── */
const VW = 400, VH = 120;
const PL = 38, PR = 8, PT = 10, PB = 24;
const PW = VW - PL - PR, PH = VH - PT - PB;

function smoothLine(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const mx = (p.x + c.x) / 2;
    d += ` C ${mx} ${p.y} ${mx} ${c.y} ${c.x} ${c.y}`;
  }
  return d;
}

interface ChartProps {
  entries: WeightEntry[];
  period: Period;
  goalWeight: number | null;
  lang: string;
  goalLabel: string;
}
function WeightChart({ entries, period, goalWeight, lang, goalLabel }: ChartProps) {
  if (entries.length === 0) return null;
  const weights = entries.map((e) => e.weight);
  const rawMin = Math.min(...weights), rawMax = Math.max(...weights);
  const spread = rawMax - rawMin;
  const pad = spread < 0.5 ? 2 : spread * 0.35;
  let yMin = rawMin - pad, yMax = rawMax + pad;
  if (goalWeight !== null) { yMin = Math.min(yMin, goalWeight - pad * 0.5); yMax = Math.max(yMax, goalWeight + pad * 0.5); }
  const yRange = yMax - yMin || 1;
  const timestamps = entries.map((e) => new Date(e.logged_at + "T00:00:00").getTime());
  const xMin = timestamps[0], xMax = timestamps[timestamps.length - 1];
  const xRange = xMax - xMin || 1;
  const pts = entries.map((_, i) => ({
    x: PL + ((timestamps[i] - xMin) / xRange) * PW,
    y: PT + PH - ((weights[i] - yMin) / yRange) * PH,
  }));
  const linePath = smoothLine(pts);
  const areaPath = pts.length > 1 ? `${linePath} L ${pts[pts.length-1].x} ${PT+PH} L ${pts[0].x} ${PT+PH} Z` : "";
  const yLabels = [{ v: yMax, y: PT+3 }, { v: (yMin+yMax)/2, y: PT+PH/2+3 }, { v: yMin, y: PT+PH+3 }];
  const locale = lang === "ru" ? "ru-RU" : "de-DE";
  const fmtX = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(locale, period === "365d" ? { month: "short" } : { day: "numeric", month: "short" });
  const xIdxs = entries.length === 1 ? [0] : entries.length === 2 ? [0,1] : [0, Math.floor(entries.length/2), entries.length-1];
  const xLabels = [...new Set(xIdxs)].map((i) => ({ label: fmtX(entries[i].logged_at), x: pts[i].x }));
  const goalY = goalWeight !== null ? PT + PH - ((goalWeight - yMin) / yRange) * PH : null;
  return (
    <div style={{ height: "130px", overflow: "hidden" }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {yLabels.map(({ v, y }) => (
          <g key={v.toFixed(2)}>
            <line x1={PL} y1={y-3} x2={VW-PR} y2={y-3} stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.7" strokeDasharray="3 2" />
            <text x={PL-3} y={y} textAnchor="end" fontSize="8" fill="currentColor" fillOpacity="0.40">{v.toFixed(1)}</text>
          </g>
        ))}
        {goalY !== null && goalY > PT+2 && goalY < PT+PH-2 && (
          <>
            <line x1={PL} y1={goalY} x2={VW-PR} y2={goalY} stroke="#10b981" strokeOpacity="0.55" strokeWidth="0.9" strokeDasharray="5 3" />
            <text x={VW-PR-2} y={goalY-3} textAnchor="end" fontSize="7.5" fill="#10b981" fillOpacity="0.75">{goalLabel}</text>
          </>
        )}
        {areaPath && <path d={areaPath} fill="url(#wg)" />}
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {entries.length <= 45 && pts.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r="2.6" fill="white" stroke="#3b82f6" strokeWidth="1.6" />
        ))}
        {xLabels.map(({ label, x }) => (
          <text key={label+x} x={x} y={VH-5} textAnchor="middle" fontSize="8.5" fill="currentColor" fillOpacity="0.45">{label}</text>
        ))}
      </svg>
    </div>
  );
}
/* ─────────────── End Chart ─────────────── */

export default function KoerperTab({ userId, onProfileSaved, onGoalsApplied }: Props) {
  const { t, lang } = useLanguage();
  const [weightInput, setWeightInput] = useState("");
  const [profile, setProfile] = useState<BodyProfile>({
    start_weight: "", goal_weight: "", height_cm: "", age: "", current_weight: "", gender: "",
  });
  const [saving, setSaving] = useState(false);
  const [applyingSaving, setApplyingSaving] = useState(false);
  const [weightLog, setWeightLog] = useState<WeightEntry[]>([]);
  const [period, setPeriod] = useState<Period>("30d");
  const [weeks, setWeeks] = useState(12);
  const [activity, setActivity] = useState<ActivityKey>("moderate");

  const skipSaveRef = useRef(true);

  const loadProfile = useCallback(async () => {
    skipSaveRef.current = true;
    const { data } = await supabase
      .from("body_profile")
      .select("start_weight,goal_weight,height_cm,age,current_weight,gender,calc_weeks,calc_activity")
      .eq("user_id", userId).maybeSingle();
    if (data) {
      setProfile({
        start_weight:   data.start_weight?.toString()   ?? "",
        goal_weight:    data.goal_weight?.toString()    ?? "",
        height_cm:      data.height_cm?.toString()      ?? "",
        age:            data.age?.toString()            ?? "",
        current_weight: data.current_weight?.toString() ?? "",
        gender:         (data.gender as "male" | "female") ?? "",
      });
      if (data.calc_weeks) setWeeks(data.calc_weeks);
      if (data.calc_activity && ACTIVITY_OPTIONS.some((o) => o.key === data.calc_activity))
        setActivity(data.calc_activity as ActivityKey);
    }
    // Allow saving only after all loaded state updates have been processed
    setTimeout(() => { skipSaveRef.current = false; }, 0);
  }, [userId]);

  const loadWeightLog = useCallback(async () => {
    const yearAgo = new Date();
    yearAgo.setDate(yearAgo.getDate() - 365);
    const { data } = await supabase
      .from("weight_log").select("id,weight,logged_at")
      .eq("user_id", userId).gte("logged_at", yearAgo.toISOString().split("T")[0])
      .order("logged_at", { ascending: true });
    setWeightLog(data ?? []);
  }, [userId]);

  useEffect(() => { loadProfile(); loadWeightLog(); }, [loadProfile, loadWeightLog]);

  /* ── Debounced save of calculator preferences to Supabase ── */
  const calcPrefTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (skipSaveRef.current) return;
    if (calcPrefTimer.current) clearTimeout(calcPrefTimer.current);
    calcPrefTimer.current = setTimeout(() => {
      supabase.from("body_profile").upsert(
        { user_id: userId, calc_weeks: weeks, calc_activity: activity },
        { onConflict: "user_id" }
      );
    }, 800);
    return () => { if (calcPrefTimer.current) clearTimeout(calcPrefTimer.current); };
  }, [weeks, activity, userId]);

  /* ── Chart: filter by period ── */
  const chartEntries = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[period]);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    return weightLog.filter((e) => e.logged_at >= cutoffStr);
  }, [weightLog, period]);

  const latestEntry   = weightLog[weightLog.length - 1] ?? null;
  const firstInPeriod = chartEntries[0] ?? null;
  const delta = latestEntry && firstInPeriod && latestEntry.logged_at !== firstInPeriod.logged_at
    ? latestEntry.weight - firstInPeriod.weight : null;
  const goalWeightNum = profile.goal_weight ? parseFloat(profile.goal_weight) : null;

  /* ── Goal calculator ── */
  const calc = useMemo(() => {
    const sw  = parseFloat(profile.start_weight);
    const gw  = parseFloat(profile.goal_weight);
    const h   = parseFloat(profile.height_cm);
    const age = parseInt(profile.age);
    const g   = profile.gender;
    if (!sw || !gw || !h || !age || !g) return { missing: true } as const;
    if (sw <= gw) return { noLoss: true } as const;

    const bodyW = parseFloat(profile.current_weight) || sw;
    const weightToLose = sw - gw;
    const totalKcal    = weightToLose * 7700;
    const dailyDeficit = Math.round(totalKcal / (weeks * 7));
    const mult = ACTIVITY_OPTIONS.find((a) => a.key === activity)?.mult ?? 1.55;
    const bmr  = 10 * bodyW + 6.25 * h - 5 * age + (g === "male" ? 5 : -161);
    const tdee = Math.round(bmr * mult);
    const minKcal  = g === "male" ? 1500 : 1200;
    const rawBudget = tdee - dailyDeficit;
    const budget    = Math.max(rawBudget, minKcal);
    const actualDeficit = tdee - budget;
    const proteinGoal   = Math.round(bodyW * 2.0);
    const isHighDeficit       = dailyDeficit > 1000;
    const isTooLowCalories    = rawBudget < minKcal;
    const isDeficitOver30Pct  = dailyDeficit / tdee > 0.3;
    const isBudgetBelowBMR    = budget < bmr;
    const maxLossPerWeekKg    = parseFloat((bodyW * 0.01).toFixed(2));
    const projectedWeeklyLoss = parseFloat(((dailyDeficit * 7) / 7700).toFixed(2));
    const isTooFast           = projectedWeeklyLoss > maxLossPerWeekKg;
    const minWeeks = Math.ceil(totalKcal / (1000 * 7));
    return {
      ok: true, dailyDeficit, actualDeficit, tdee, budget, proteinGoal, bmr,
      isHighDeficit, isTooLowCalories, isDeficitOver30Pct, isBudgetBelowBMR,
      isTooFast, maxLossPerWeekKg, projectedWeeklyLoss, minWeeks,
    } as const;
  }, [profile, weeks, activity]);

  /* ── Handlers ── */
  async function handleWeightEntry() {
    if (!weightInput) return;
    setSaving(true);
    const w = parseFloat(weightInput);
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("weight_log").upsert({ user_id: userId, weight: w, logged_at: today }, { onConflict: "user_id,logged_at" });
    await supabase.from("body_profile").upsert({ user_id: userId, current_weight: w }, { onConflict: "user_id" });
    setProfile((p) => ({ ...p, current_weight: w.toString() }));
    setWeightInput("");
    setSaving(false);
    toast.success(t.toastWeightLogged, { description: `${w} kg` });
    onProfileSaved?.();
    await loadWeightLog();
  }

  async function handleSaveProfile() {
    setSaving(true);
    await supabase.from("body_profile").upsert({
      user_id: userId,
      start_weight: profile.start_weight ? parseFloat(profile.start_weight) : null,
      goal_weight:  profile.goal_weight  ? parseFloat(profile.goal_weight)  : null,
      height_cm:    profile.height_cm    ? parseInt(profile.height_cm)      : null,
      age:          profile.age          ? parseInt(profile.age)            : null,
      gender:       profile.gender || null,
      updated_at:   new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSaving(false);
    toast.success(t.toastProfileSaved);
    onProfileSaved?.();
  }

  async function handleApplyGoals() {
    if (!calc || !("budget" in calc)) return;
    // `as number` safe: "budget" in calc confirms this is the ok-branch
    const budget      = calc.budget as number;
    const proteinGoal = calc.proteinGoal as number;
    const deficit     = calc.actualDeficit as number;
    setApplyingSaving(true);
    await Promise.all([
      supabase.from("user_settings").upsert({
        user_id: userId, budget, deficit, protein_goal: proteinGoal,
      }, { onConflict: "user_id" }),
      supabase.from("body_profile").upsert({
        user_id: userId, calc_weeks: weeks, calc_activity: activity,
      }, { onConflict: "user_id" }),
    ]);
    setApplyingSaving(false);
    toast.success(t.toastGoalsSaved, { description: `${budget} kcal · ${proteinGoal}g ${t.protein}` });
    onGoalsApplied?.(budget, proteinGoal);
  }

  async function handleDeleteWeight(id: string) {
    const { error } = await supabase.from("weight_log").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setWeightLog((prev) => prev.filter((e) => e.id !== id));
    toast.success(t.toastWeightDeleted);
  }

  function confirmDeleteWeight(entry: WeightEntry) {
    toast.warning(`${fmtDate(entry.logged_at)} — ${entry.weight} kg ${t.confirmDeleteProduct}`, {
      description: t.confirmCannotUndo,
      action: { label: t.confirmYesDelete, onClick: () => handleDeleteWeight(entry.id) },
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

  const profileFields = [
    { label: t.startWeightField, key: "start_weight", placeholder: "z.B. 92",  suffix: "kg" },
    { label: t.goalWeightField,  key: "goal_weight",  placeholder: "z.B. 78",  suffix: "kg" },
    { label: t.heightField,      key: "height_cm",    placeholder: "z.B. 178", suffix: "cm" },
    { label: t.ageField,         key: "age",          placeholder: "z.B. 30",  suffix: "J." },
  ];

  const PERIODS: { key: Period; label: string }[] = [
    { key: "7d",   label: t.period7d   },
    { key: "30d",  label: t.period30d  },
    { key: "365d", label: t.period365d },
  ];

  const card = "gc rounded-2xl";

  /* ── BMI ── */
  const bmiValue = (() => {
    const w = parseFloat(profile.current_weight);
    const hm = parseFloat(profile.height_cm) / 100;
    return w > 0 && hm > 0 ? w / (hm * hm) : null;
  })();
  const BMI_SEGMENTS = [
    { from: 15,   to: 18.5, bg: "bg-blue-500",   text: "text-blue-500",   label: t.bmiUnderweight, range: "<18.5" },
    { from: 18.5, to: 25,   bg: "bg-emerald-500", text: "text-emerald-500",label: t.bmiNormal,      range: "18.5–25" },
    { from: 25,   to: 30,   bg: "bg-yellow-400",  text: "text-yellow-500", label: t.bmiOverweight,  range: "25–30" },
    { from: 30,   to: 35,   bg: "bg-orange-500",  text: "text-orange-500", label: t.bmiObesity1,    range: "30–35" },
    { from: 35,   to: 40,   bg: "bg-red-500",     text: "text-red-500",    label: t.bmiObesity2,    range: "35–40" },
    { from: 40,   to: 45,   bg: "bg-red-800",     text: "text-red-800 dark:text-red-400", label: t.bmiObesity3, range: "≥40" },
  ] as const;
  const BMI_RANGE = 30;
  const bmiSegment = bmiValue !== null
    ? BMI_SEGMENTS.find((s) => bmiValue >= s.from && bmiValue < s.to) ?? BMI_SEGMENTS[BMI_SEGMENTS.length - 1]
    : null;
  const markerPct = bmiValue !== null
    ? Math.min(Math.max((Math.min(bmiValue, 44.9) - 15) / BMI_RANGE, 0), 0.98) * 100
    : null;

  const recentLog = useMemo(() => [...weightLog].reverse().slice(0, 20), [weightLog]);

  return (
    <div className="space-y-4">

      {/* ── Row 1: Weight entry + Body profile ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">

        {/* Weight entry */}
        <div className={`${card} p-5`}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-blue-500/15 rounded-xl flex items-center justify-center">
              <Scale size={16} className="text-blue-500 dark:text-blue-400" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.enterWeight}</p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="number" step="0.1" value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleWeightEntry()}
                placeholder="z.B. 84.5"
                className="gi w-full rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">kg</span>
            </div>
            <button onClick={handleWeightEntry} disabled={!weightInput || saving}
              className="flex items-center gap-1.5 font-semibold rounded-xl px-5 py-3 text-sm text-white transition-all whitespace-nowrap disabled:opacity-30"
              style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", boxShadow: "0 4px 16px rgba(59,130,246,0.30)" }}
            >
              <Check size={15} /> {t.logWeight}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-4">{t.enterWeightSub}</p>
        </div>

        {/* Body profile */}
        <div className={`${card} p-5`}>
          <p className="text-sm font-semibold text-slate-900 dark:text-white mb-4">{t.bodyData}</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {profileFields.map(({ label, key, placeholder, suffix }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  {label} <span className="text-slate-400">({suffix})</span>
                </label>
                <input
                  type="number"
                  value={profile[key as keyof BodyProfile]}
                  onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="gi w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
            ))}
          </div>

          {/* Gender toggle */}
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-500 mb-2">{t.genderLabel}</p>
            <div className="flex gap-2">
              {(["male", "female"] as const).map((g) => (
                <button key={g} onClick={() => setProfile((p) => ({ ...p, gender: g }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                    profile.gender === g
                      ? "text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white bg-black/[0.05] dark:bg-white/[0.06]"
                  }`}
                  style={profile.gender === g ? { background: "linear-gradient(135deg, #3b82f6, #6366f1)" } : {}}
                >
                  {g === "male" ? t.genderMale : t.genderFemale}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSaveProfile} disabled={saving}
            className="w-full flex items-center justify-center gap-2 font-semibold rounded-xl py-3 text-sm text-white transition-all disabled:opacity-30"
            style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", boxShadow: "0 4px 16px rgba(59,130,246,0.25)" }}
          >
            <Check size={15} />
            {saving ? t.saving : t.saveProfile}
          </button>
        </div>
      </div>

      {/* ── Goal Calculator ── */}
      <div className={`${card} p-5`}>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 bg-violet-500/15 rounded-xl flex items-center justify-center">
            <Target size={16} className="text-violet-500 dark:text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.goalCalculatorTitle}</p>
        </div>

        {/* Missing data or no-loss hint */}
        {(!calc || "missing" in calc) && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
            <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-600 dark:text-amber-400">{t.calculatorNeedsData}</p>
          </div>
        )}
        {"noLoss" in (calc ?? {}) && (
          <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-600 dark:text-blue-400">{t.calculatorNoLoss}</p>
          </div>
        )}

        {"ok" in (calc ?? {}) && "ok" in calc && (
          <div className="space-y-5">

            {/* Timeframe slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-500">{t.timeframeLabel}</p>
                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {weeks} <span className="text-xs font-normal text-slate-500">{t.weeksUnit}</span>
                  <span className="text-xs font-normal text-slate-400 ml-2">
                    (~{(weeks / 4.33).toFixed(1)} Mon.)
                  </span>
                </span>
              </div>
              <input
                type="range" min={4} max={52} step={1} value={weeks}
                onChange={(e) => setWeeks(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  accentColor: "#3b82f6",
                  background: `linear-gradient(to right, #3b82f6 ${((weeks - 4) / 48) * 100}%, rgba(100,116,139,0.2) ${((weeks - 4) / 48) * 100}%)`,
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-400">4 {t.weeksUnit}</span>
                <span className="text-[10px] text-slate-400">52 {t.weeksUnit}</span>
              </div>
            </div>

            {/* Activity level */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">{t.activityLevelLabel}</p>
              <div className="flex flex-wrap gap-1.5">
                {ACTIVITY_OPTIONS.map(({ key, labelKey }) => (
                  <button key={key} onClick={() => setActivity(key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      activity === key
                        ? "text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white bg-black/[0.05] dark:bg-white/[0.06]"
                    }`}
                    style={activity === key ? { background: "linear-gradient(135deg, #3b82f6, #6366f1)" } : {}}
                  >
                    {t[labelKey as keyof typeof t] as string}
                  </button>
                ))}
              </div>
            </div>

            {/* Warnings */}
            {(calc.isHighDeficit || calc.isTooLowCalories || calc.isDeficitOver30Pct || calc.isBudgetBelowBMR || calc.isTooFast) && (
              <div className="space-y-2">
                {(calc.isHighDeficit || calc.isTooLowCalories) && (
                  <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                    <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {calc.isHighDeficit
                        ? `${t.warningHighDeficit} ${calc.minWeeks} ${t.warningMinWeeksUnit}`
                        : t.warningLowCalories}
                    </p>
                  </div>
                )}
                {calc.isDeficitOver30Pct && (
                  <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3">
                    <Info size={14} className="text-orange-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      Defizit über 30 % des TDEE ({Math.round((calc.dailyDeficit / calc.tdee) * 100)} %). Muskelabbau wahrscheinlich.
                    </p>
                  </div>
                )}
                {calc.isBudgetBelowBMR && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <Info size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Budget ({calc.budget} kcal) liegt unter dem Grundumsatz ({Math.round(calc.bmr)} kcal). Stoffwechselschäden möglich.
                    </p>
                  </div>
                )}
                {calc.isTooFast && !calc.isBudgetBelowBMR && (
                  <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                    <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Progn. Verlust {calc.projectedWeeklyLoss} kg/Woche übersteigt empf. Maximum ({calc.maxLossPerWeekKg} kg = 1 % Körpergewicht).
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Results */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                <p className="text-[10px] font-semibold text-red-500/80 dark:text-red-400/80 uppercase tracking-wide mb-1">{t.resultDailyDeficit}</p>
                <p className="text-xl font-black tabular-nums text-red-600 dark:text-red-400">
                  {calc.actualDeficit}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">kcal</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                <p className="text-[10px] font-semibold text-blue-500/80 dark:text-blue-400/80 uppercase tracking-wide mb-1">{t.resultDailyBudget}</p>
                <p className="text-xl font-black tabular-nums text-blue-600 dark:text-blue-400">
                  {calc.budget}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">kcal/Tag</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                <p className="text-[10px] font-semibold text-emerald-500/80 dark:text-emerald-400/80 uppercase tracking-wide mb-1">{t.resultDailyProtein}</p>
                <p className="text-xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                  {calc.proteinGoal}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">g/Tag</p>
              </div>
            </div>

            {/* Protein tip */}
            <div className="flex items-start gap-2 bg-emerald-500/08 border border-emerald-500/15 rounded-xl px-4 py-3">
              <Info size={13} className="text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {t.proteinTip} (2g {t.perKgWeight})
              </p>
            </div>

            {/* Apply button */}
            <button onClick={handleApplyGoals} disabled={applyingSaving}
              className="w-full flex items-center justify-center gap-2 font-semibold rounded-xl py-3 text-sm text-white transition-all disabled:opacity-30"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)", boxShadow: "0 4px 16px rgba(99,102,241,0.30)" }}
            >
              <Check size={15} />
              {applyingSaving ? t.saving : t.applyGoals}
            </button>
          </div>
        )}
      </div>

      {/* ── Weight Chart ── */}
      <div className={`${card} p-5`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">{t.weightChartTitle}</p>
            <div className="flex items-baseline gap-2">
              {latestEntry ? (
                <>
                  <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {latestEntry.weight.toFixed(1)}<span className="text-sm font-normal text-slate-500 ml-1">kg</span>
                  </span>
                  {delta !== null && (
                    <span className={`flex items-center gap-0.5 text-xs font-semibold ${
                      delta < 0 ? "text-emerald-600 dark:text-emerald-400" :
                      delta > 0 ? "text-red-500 dark:text-red-400" : "text-slate-500"
                    }`}>
                      {delta < 0 ? <TrendingDown size={13} /> : delta > 0 ? <TrendingUp size={13} /> : <Minus size={13} />}
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)} kg
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm text-slate-500">{t.noWeightData}</span>
              )}
            </div>
          </div>
          <div className="flex gap-1 bg-black/[0.05] dark:bg-white/[0.06] rounded-xl p-1">
            {PERIODS.map(({ key, label }) => (
              <button key={key} onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  period === key ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
                style={period === key ? { background: "linear-gradient(135deg, #3b82f6, #6366f1)" } : {}}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {chartEntries.length > 0 ? (
          <WeightChart entries={chartEntries} period={period} goalWeight={goalWeightNum} lang={lang} goalLabel={t.goalLabel} />
        ) : (
          <div className="flex items-center justify-center" style={{ height: "130px" }}>
            <p className="text-sm text-slate-500">{t.noWeightData}</p>
          </div>
        )}

        {recentLog.length > 0 && (
          <div className="mt-5 pt-4 border-t border-black/[0.05] dark:border-white/[0.06]">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">{t.weightHistoryTitle}</p>
            <div className="space-y-1">
              {recentLog.map((entry) => {
                const isToday = entry.logged_at === new Date().toISOString().split("T")[0];
                return (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b border-black/[0.04] dark:border-white/[0.05] last:border-0">
                    <span className={`text-sm ${isToday ? "font-semibold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>
                      {fmtDate(entry.logged_at)}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold tabular-nums ${isToday ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-white"}`}>
                        {entry.weight.toFixed(1)} <span className="text-xs font-normal text-slate-500">kg</span>
                      </span>
                      <button onClick={() => confirmDeleteWeight(entry)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── BMI ── */}
      {bmiValue !== null && bmiSegment !== null && markerPct !== null ? (
        <div className={`${card} p-5`}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">{t.bmiTitle}</p>
          <div className="flex items-center gap-4 mb-5">
            <p className={`text-5xl font-black tabular-nums leading-none ${bmiSegment.text}`}>{bmiValue.toFixed(1)}</p>
            <div>
              <p className={`text-base font-bold ${bmiSegment.text}`}>{bmiSegment.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t.bmiLabel}</p>
            </div>
          </div>
          <div className="relative mb-5 pb-2">
            <div className="flex h-2.5 rounded-full overflow-hidden">
              {BMI_SEGMENTS.map((seg) => (
                <div key={seg.from} className={`${seg.bg} opacity-80`}
                  style={{ width: `${((seg.to - seg.from) / BMI_RANGE) * 100}%` }} />
              ))}
            </div>
            <div className="absolute top-0 w-0.5 h-4 -translate-x-1/2 rounded-full bg-white dark:bg-slate-900 shadow"
              style={{ left: `${markerPct}%` }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            {BMI_SEGMENTS.map((seg) => (
              <div key={seg.from} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${seg.bg}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{seg.label}</p>
                  <p className="text-[10px] text-slate-400">{seg.range}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`${card} p-4 text-center`}>
          <p className="text-sm text-slate-500">{t.bmiNoData}</p>
        </div>
      )}
    </div>
  );
}
