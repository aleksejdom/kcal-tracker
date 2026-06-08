"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import ProductSearch, { Product } from "@/components/ProductSearch";
import { Pencil, X, Plus, Check, Trash2, ChevronRight, Beef, Droplets, Activity } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

interface FoodEntry {
  id: string; name: string; calories: number;
  protein: number; fat: number; entry_time: string;
}
interface Settings { budget: number; deficit: number; protein_goal: number | null; }
interface BodyProfile { start_weight: number | null; goal_weight: number | null; current_weight: number | null; }
interface Props {
  userId: string; settings: Settings;
  onGoToKoerper: () => void; onSettingsChange: (s: Settings) => void;
  refreshKey?: number;
}

function getTodayKey() { return new Date().toISOString().split("T")[0]; }

export default function TodayTab({ userId, settings, onGoToKoerper, onSettingsChange, refreshKey }: Props) {
  const { t } = useLanguage();
  const [entries, setEntries]             = useState<FoodEntry[]>([]);
  const [bodyProfile, setBodyProfile]     = useState<BodyProfile | null>(null);
  const [productName, setProductName]     = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [amount, setAmount]               = useState("");
  const [editingGoal, setEditingGoal]     = useState(false);
  const [goalInput, setGoalInput]         = useState(String(settings.budget));
  const [saving, setSaving]               = useState(false);
  const [todaySteps, setTodaySteps]       = useState(0);
  const [stepsInput, setStepsInput]       = useState("");

  const today    = getTodayKey();
  const consumed = entries.reduce((s, e) => s + e.calories, 0);
  const totalProtein = Math.round(entries.reduce((s, e) => s + Number(e.protein), 0) * 10) / 10;
  const totalFat     = Math.round(entries.reduce((s, e) => s + Number(e.fat), 0) * 10) / 10;
  const burnedFromSteps  = Math.round(todaySteps * 0.04);
  const effectiveBudget  = settings.budget + burnedFromSteps;
  const remaining = effectiveBudget - consumed;
  const pct       = Math.min((consumed / effectiveBudget) * 100, 100);
  const isOver    = remaining < 0;

  const amountNum    = Number(amount);
  const calcKcal    = selectedProduct && amountNum > 0 ? Math.round((selectedProduct.calories * amountNum) / 100) : null;
  const calcProtein = selectedProduct && amountNum > 0 ? Math.round((selectedProduct.protein  * amountNum) / 100 * 10) / 10 : null;
  const calcFat     = selectedProduct && amountNum > 0 ? Math.round((selectedProduct.fat      * amountNum) / 100 * 10) / 10 : null;
  const calcCarbs   = selectedProduct && amountNum > 0 ? Math.round((selectedProduct.carbs    * amountNum) / 100 * 10) / 10 : null;

  const loadEntries = useCallback(async () => {
    const { data } = await supabase
      .from("food_entries").select("id,name,calories,protein,fat,entry_time")
      .eq("user_id", userId).eq("entry_date", today)
      .order("created_at", { ascending: false });
    setEntries(data ?? []);
  }, [userId, today]);

  const loadBodyProfile = useCallback(async () => {
    const { data } = await supabase
      .from("body_profile").select("start_weight,goal_weight,current_weight")
      .eq("user_id", userId).maybeSingle();
    setBodyProfile(data ?? null);
  }, [userId]);

  const loadTodaySteps = useCallback(async () => {
    const { data } = await supabase
      .from("daily_steps").select("steps")
      .eq("user_id", userId).eq("logged_at", getTodayKey()).maybeSingle();
    setTodaySteps(data?.steps ?? 0);
  }, [userId]);

  useEffect(() => { loadEntries(); loadBodyProfile(); loadTodaySteps(); }, [loadEntries, loadBodyProfile, loadTodaySteps]);
  useEffect(() => { if (refreshKey && refreshKey > 0) loadBodyProfile(); }, [refreshKey, loadBodyProfile]);

  async function handleAdd() {
    if (!productName.trim() || !amount || !selectedProduct || calcKcal === null) return;
    setSaving(true);
    await supabase.from("food_entries").insert({
      user_id: userId, entry_date: today,
      name: productName.trim(), calories: calcKcal,
      protein: calcProtein ?? 0, fat: calcFat ?? 0, carbs: calcCarbs ?? 0,
      entry_time: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
    });
    toast.success(t.toastMealAdded, { description: `${productName.trim()} · ${calcKcal} kcal` });
    setProductName(""); setSelectedProduct(null); setAmount("");
    await loadEntries();
    setSaving(false);
  }

  function handleProductNameChange(val: string) {
    setProductName(val);
    if (selectedProduct && val !== selectedProduct.name) setSelectedProduct(null);
  }

  async function handleDelete(id: string) {
    await supabase.from("food_entries").delete().eq("id", id);
    await loadEntries();
    toast(t.toastMealRemoved);
  }

  async function handleSaveSteps() {
    const s = parseInt(stepsInput, 10);
    if (!s || s < 0) return;
    await supabase.from("daily_steps").upsert(
      { user_id: userId, logged_at: getTodayKey(), steps: s, updated_at: new Date().toISOString() },
      { onConflict: "user_id,logged_at" }
    );
    setTodaySteps(s);
    setStepsInput("");
    toast.success(t.toastStepsSaved, { description: `${s.toLocaleString()} ${t.stepsLabel} · +${Math.round(s * 0.04)} kcal` });
  }

  async function saveGoal() {
    const val = parseInt(goalInput, 10);
    if (!val || val < 1) return;
    await supabase.from("user_settings").upsert(
      { user_id: userId, budget: val, deficit: settings.deficit }, { onConflict: "user_id" }
    );
    onSettingsChange({ ...settings, budget: val });
    setEditingGoal(false);
    toast.success(t.toastGoalSaved, { description: `${val} kcal` });
  }

  const startW   = bodyProfile?.start_weight   ?? null;
  const goalW    = bodyProfile?.goal_weight     ?? null;
  const currentW = bodyProfile?.current_weight  ?? startW;
  const hasGoal  = startW !== null && goalW !== null;
  let weightProgress = 0, kgLeft = 0;
  if (hasGoal && currentW !== null && startW !== goalW) {
    const totalDiff = startW! - goalW!;
    weightProgress = Math.max(0, Math.min(100, ((startW! - currentW) / totalDiff) * 100));
    kgLeft = Math.max(0, currentW - goalW!);
  }

  const card = "gc rounded-2xl";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 lg:items-start">

      {/* ── LEFT COLUMN ── */}
      <div className="space-y-4">

        {/* Calorie card */}
        <div className={`${card} p-5`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-bold text-slate-900 dark:text-white tabular-nums">{consumed}</span>
                <span className="text-base text-slate-500 font-medium">kcal</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{t.todayConsumed}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                isOver
                  ? "text-red-500 dark:text-red-400 bg-red-500/10 border-red-500/30"
                  : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
              }`}>
                {isOver ? `${Math.abs(remaining)} ${t.kcalOver}` : `${remaining} ${t.kcalRemaining}`}
              </span>
              <button
                onClick={() => { setGoalInput(String(settings.budget)); setEditingGoal(true); }}
                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.10] rounded-lg transition-colors"
              >
                <Pencil size={13} />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-black/[0.07] dark:bg-white/[0.08] rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                isOver
                  ? "bg-gradient-to-r from-red-400 to-rose-500"
                  : "bg-gradient-to-r from-blue-400 to-violet-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 text-right mt-1.5">
            {Math.round(pct)}% von {effectiveBudget} kcal
            {burnedFromSteps > 0 && (
              <span className="text-teal-600 dark:text-teal-400 ml-1.5">
                (+{burnedFromSteps} {t.stepsBurnedKcal})
              </span>
            )}
          </p>

          {/* Macro totals */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.07]">
            {/* Protein tile — shows goal + progress bar when protein_goal is set */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Beef size={13} className="text-emerald-500 dark:text-emerald-400" />
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t.protein}</p>
                </div>
                {settings.protein_goal && (
                  <span className="text-[10px] font-semibold text-emerald-600/70 dark:text-emerald-400/60">
                    Ziel {settings.protein_goal}g
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                {totalProtein}
                <span className="text-xs font-normal ml-0.5 text-emerald-600 dark:text-emerald-500">
                  {settings.protein_goal ? `/ ${settings.protein_goal}g` : "g"}
                </span>
              </p>
              {settings.protein_goal && (
                <div className="w-full bg-emerald-500/20 rounded-full h-1 mt-1.5 overflow-hidden">
                  <div
                    className="h-1 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((totalProtein / settings.protein_goal) * 100, 100)}%`,
                      background: totalProtein >= settings.protein_goal
                        ? "linear-gradient(90deg,#10b981,#34d399)"
                        : "linear-gradient(90deg,#6ee7b7,#10b981)",
                    }}
                  />
                </div>
              )}
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Droplets size={13} className="text-orange-500 dark:text-orange-400" />
                <p className="text-xs font-medium text-orange-600 dark:text-orange-400">{t.fat}</p>
              </div>
              <p className="text-lg font-bold text-orange-700 dark:text-orange-300 tabular-nums">
                {totalFat}<span className="text-xs font-normal ml-0.5 text-orange-600 dark:text-orange-500">g</span>
              </p>
            </div>
          </div>

          {editingGoal && (
            <div className="mt-3 flex gap-2 items-center border-t border-black/[0.06] dark:border-white/[0.07] pt-3">
              <label className="text-xs text-slate-500 whitespace-nowrap">{t.dailyGoalLabel}</label>
              <input
                type="number"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="gi flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <button onClick={saveGoal} className="w-8 h-8 flex items-center justify-center bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                <Check size={14} />
              </button>
              <button onClick={() => setEditingGoal(false)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white">
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Steps card */}
        <div className={`${card} p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-teal-500/15 rounded-xl flex items-center justify-center shrink-0">
              <Activity size={16} className="text-teal-500 dark:text-teal-400" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.stepsToday}</p>
            {todaySteps > 0 && (
              <span className="ml-auto text-xs font-semibold text-teal-600 dark:text-teal-400">
                +{burnedFromSteps} kcal
              </span>
            )}
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

        {/* Weight goal card */}
        {hasGoal ? (
          <div className={`${card} p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{t.weightGoal}</span>
              <button onClick={onGoToKoerper} className="flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 font-medium transition-colors">
                {t.editGoal} <ChevronRight size={14} />
              </button>
            </div>
            <div className="w-full bg-black/[0.07] dark:bg-white/[0.08] rounded-full h-2 mb-2.5 overflow-hidden">
              <div className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-violet-500 transition-all duration-500" style={{ width: `${weightProgress}%` }} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">
                {currentW !== null ? `${t.currentWeightLabel}: ${currentW} kg` : `${t.startWeightLabel}: ${startW} kg`}
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {kgLeft > 0 ? `${t.kgRemaining} ${kgLeft.toFixed(1)} kg → ${goalW} kg` : t.goalReached}
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={onGoToKoerper}
            className={`w-full ${card} p-4 flex items-center justify-between text-sm text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-all`}
          >
            <span>{t.setWeightGoal}</span>
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* ── RIGHT COLUMN ── */}
      <div className="space-y-4">

        {/* Meal entry card */}
        <div className={`${card} p-5`}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
            {t.mealCapture}
          </p>
          <div className="space-y-2.5">
            <ProductSearch
              value={productName}
              onChange={handleProductNameChange}
              onSelect={(p) => { setSelectedProduct(p); setProductName(p.name); }}
              userId={userId}
            />

            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={selectedProduct?.unit === "ml" ? `${t.amount} (ml)` : `${t.amount} (g)`}
                  min="1"
                  disabled={!selectedProduct}
                  className="gi w-full rounded-xl px-3 py-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">{selectedProduct?.unit === "ml" ? "ml" : "g"}</span>
              </div>
              <button
                onClick={handleAdd}
                disabled={!productName.trim() || !amount || !selectedProduct || saving}
                className="flex items-center gap-1.5 text-white font-semibold rounded-xl px-3 py-3 text-sm transition-all disabled:opacity-30 whitespace-nowrap shrink-0"
                style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", boxShadow: "0 4px 16px rgba(59,130,246,0.30)" }}
              >
                <Plus size={15} /> {t.addMeal}
              </button>
            </div>

            {calcKcal !== null && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-300">{calcKcal} kcal</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400">{t.protein}: {calcProtein}g</span>
                <span className="text-xs text-orange-600 dark:text-orange-400">{t.fat}: {calcFat}g</span>
                <span className="text-xs text-slate-500">KH: {calcCarbs}g</span>
              </div>
            )}

            {!selectedProduct && productName.length >= 2 && (
              <p className="text-xs text-slate-500 px-1">{t.selectProductFirst}</p>
            )}
          </div>
        </div>

        {/* Entries */}
        {entries.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-slate-500">{t.noMealsToday}</p>
            <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">{t.noMealsSubtitle}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className={`${card} px-4 py-3.5 flex items-center justify-between`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{e.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {e.entry_time}
                    {(Number(e.protein) > 0 || Number(e.fat) > 0) && <span className="mx-1.5 text-slate-400">·</span>}
                    {Number(e.protein) > 0 && <span className="text-emerald-600 dark:text-emerald-400">E {Math.round(Number(e.protein) * 10) / 10}g</span>}
                    {Number(e.fat) > 0 && <span className="ml-1.5 text-orange-600 dark:text-orange-400">F {Math.round(Number(e.fat) * 10) / 10}g</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                    {e.calories} <span className="text-xs font-normal text-slate-500">kcal</span>
                  </span>
                  <button onClick={() => handleDelete(e.id)} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
