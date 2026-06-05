"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import ProductSearch from "@/components/ProductSearch";

interface FoodEntry {
  id: string;
  name: string;
  calories: number;
  entry_time: string;
}

interface Settings {
  budget: number;
  deficit: number;
}

interface BodyProfile {
  start_weight: number | null;
  goal_weight: number | null;
  current_weight: number | null;
}

interface Props {
  userId: string;
  settings: Settings;
  onGoToKoerper: () => void;
  onSettingsChange: (s: Settings) => void;
  refreshKey?: number;
}

function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

export default function TodayTab({ userId, settings, onGoToKoerper, onSettingsChange, refreshKey }: Props) {
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [bodyProfile, setBodyProfile] = useState<BodyProfile | null>(null);
  const [productName, setProductName] = useState("");
  const [kcal, setKcal] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(settings.budget));
  const [saving, setSaving] = useState(false);

  const today = getTodayKey();
  const consumed = entries.reduce((s, e) => s + e.calories, 0);
  const remaining = settings.budget - consumed;
  const pct = Math.min((consumed / settings.budget) * 100, 100);

  const loadEntries = useCallback(async () => {
    const { data } = await supabase
      .from("food_entries")
      .select("id,name,calories,entry_time")
      .eq("user_id", userId)
      .eq("entry_date", today)
      .order("created_at", { ascending: false });
    setEntries(data ?? []);
  }, [userId, today]);

  const loadBodyProfile = useCallback(async () => {
    const { data } = await supabase
      .from("body_profile")
      .select("start_weight,goal_weight,current_weight")
      .eq("user_id", userId)
      .maybeSingle();
    setBodyProfile(data ?? null);
  }, [userId]);

  useEffect(() => {
    loadEntries();
    loadBodyProfile();
  }, [loadEntries, loadBodyProfile]);

  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) loadBodyProfile();
  }, [refreshKey, loadBodyProfile]);

  async function handleAdd() {
    if (!productName.trim() || !kcal) return;
    setSaving(true);
    await supabase.from("food_entries").insert({
      user_id: userId,
      entry_date: today,
      name: productName.trim(),
      calories: Number(kcal),
      entry_time: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
    });
    setProductName("");
    setKcal("");
    await loadEntries();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("food_entries").delete().eq("id", id);
    await loadEntries();
  }

  async function saveGoal() {
    const val = parseInt(goalInput, 10);
    if (!val || val < 1) return;
    await supabase.from("user_settings").upsert(
      { user_id: userId, budget: val, deficit: settings.deficit },
      { onConflict: "user_id" }
    );
    onSettingsChange({ ...settings, budget: val });
    setEditingGoal(false);
  }

  const startW = bodyProfile?.start_weight ?? null;
  const goalW = bodyProfile?.goal_weight ?? null;
  const currentW = bodyProfile?.current_weight ?? startW;
  const hasGoal = startW !== null && goalW !== null;

  let weightProgress = 0;
  let kgLeft = 0;
  if (hasGoal && currentW !== null && startW !== goalW) {
    const totalDiff = startW! - goalW!;
    const achieved = startW! - currentW;
    weightProgress = Math.max(0, Math.min(100, (achieved / totalDiff) * 100));
    kgLeft = Math.max(0, currentW - goalW!);
  }

  return (
    <div className="space-y-3">
      {/* Calorie card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold text-gray-900">{consumed}</span>
            <span className="text-base text-gray-400 font-medium">kcal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium px-3 py-1 rounded-full border ${
              remaining < 0
                ? "border-red-300 text-red-600 bg-red-50"
                : "border-green-300 text-green-700 bg-green-50"
            }`}>
              {remaining < 0 ? `${Math.abs(remaining)} kcal über` : `${remaining} kcal übrig`}
            </span>
            <button
              onClick={() => { setGoalInput(String(settings.budget)); setEditingGoal(true); }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✏️
            </button>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${pct >= 100 ? "bg-red-500" : "bg-gray-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 text-right mt-1.5">
          {Math.round(pct)}% von {settings.budget} kcal
        </p>
        {editingGoal && (
          <div className="mt-3 flex gap-2 items-center border-t border-gray-100 pt-3">
            <label className="text-xs text-gray-500 whitespace-nowrap">Tagesziel (kcal):</label>
            <input
              type="number"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button onClick={saveGoal} className="text-xs bg-gray-700 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800">✓</button>
            <button onClick={() => setEditingGoal(false)} className="text-xs text-gray-400">✕</button>
          </div>
        )}
      </div>

      {/* Weight goal card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-gray-800 text-sm">Gewichtsziel</span>
          <button onClick={onGoToKoerper} className="text-sm text-indigo-500 hover:text-indigo-700">
            {hasGoal ? "Bearbeiten →" : "Ziel festlegen →"}
          </button>
        </div>
        {hasGoal ? (
          <>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
              <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${weightProgress}%` }} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">
                {currentW !== null ? `Aktuell: ${currentW} kg` : `Start: ${startW} kg`}
              </span>
              <span className="text-xs font-medium text-gray-500">
                {kgLeft > 0 ? `Noch ${kgLeft.toFixed(1)} kg bis ${goalW} kg` : "Ziel erreicht! 🎉"}
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-300">{startW} kg</span>
              <span className="text-xs text-gray-300">Ziel: {goalW} kg</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-400">Kein Ziel gesetzt</p>
        )}
      </div>

      {/* Meal entry */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Mahlzeit erfassen
        </p>

        <div className="space-y-2">
          <ProductSearch
            value={productName}
            onChange={setProductName}
            onSelect={(p) => {
              setProductName(p.name);
              setKcal(String(p.calories));
            }}
            userId={userId}
          />

          <div className="flex gap-2">
            <input
              type="number"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              placeholder="kcal"
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={handleAdd}
              disabled={!productName.trim() || !kcal || saving}
              className="bg-gray-600 hover:bg-gray-700 disabled:opacity-40 text-white font-semibold rounded-xl px-5 py-3 text-sm transition-colors whitespace-nowrap"
            >
              + Hinzufügen
            </button>
          </div>
        </div>
      </div>

      {/* Today's entries */}
      {entries.length === 0 ? (
        <p className="text-center text-sm text-indigo-400 py-6">Noch keine Einträge heute</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="bg-white rounded-2xl px-5 py-3.5 shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">{e.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{e.entry_time}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-800">{e.calories} <span className="text-xs font-normal text-gray-400">kcal</span></span>
                <button onClick={() => handleDelete(e.id)} className="text-gray-300 hover:text-red-400 text-lg transition-colors">×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
