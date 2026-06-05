"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import ProductSearch from "@/components/ProductSearch";

interface FoodEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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
}

function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

export default function TodayTab({ userId, settings, onGoToKoerper, onSettingsChange }: Props) {
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
      .select("id,name,calories,protein,carbs,fat,entry_time")
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
    setBodyProfile(data);
  }, [userId]);

  useEffect(() => {
    loadEntries();
    loadBodyProfile();
  }, [loadEntries, loadBodyProfile]);

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

  const hasWeightGoal = bodyProfile?.start_weight && bodyProfile?.goal_weight;
  const weightProgress = hasWeightGoal && bodyProfile?.current_weight
    ? Math.max(0, Math.min(100,
        ((bodyProfile.start_weight! - bodyProfile.current_weight) /
         (bodyProfile.start_weight! - bodyProfile.goal_weight!)) * 100
      ))
    : 0;

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
            <button onClick={saveGoal} className="text-xs bg-gray-700 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800">
              ✓
            </button>
            <button onClick={() => setEditingGoal(false)} className="text-xs text-gray-400">✕</button>
          </div>
        )}
      </div>

      {/* Weight goal card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-gray-800 text-sm">Gewichtsziel</span>
          <button onClick={onGoToKoerper} className="text-sm text-indigo-500 hover:text-indigo-700">
            Ziel festlegen →
          </button>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-gray-400 transition-all"
            style={{ width: `${weightProgress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 text-right mt-1.5">
          {hasWeightGoal
            ? `${bodyProfile!.current_weight ?? bodyProfile!.start_weight} kg → ${bodyProfile!.goal_weight} kg`
            : "Kein Ziel gesetzt"}
        </p>
      </div>

      {/* Meal entry */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Mahlzeit erfassen
        </p>

        <div className="border-2 border-dashed border-purple-200 rounded-xl py-4 flex items-center justify-center gap-2 text-purple-600 cursor-pointer hover:border-purple-300 transition-colors mb-3">
          <span>📷</span>
          <span className="text-sm font-medium">Foto aufnehmen oder Galerie</span>
        </div>

        <div className="flex items-center gap-2 my-3">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">oder Text</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <div className="space-y-2">
          <ProductSearch
            value={productName}
            onChange={setProductName}
            onSelect={(p) => {
              setProductName(p.name);
              setKcal(String(p.calories));
            }}
          />

          <button className="w-full text-xs text-gray-400 bg-gray-50 hover:bg-gray-100 rounded-xl py-2.5 transition-colors">
            ✦ KI schätzen + speichern
          </button>

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
