"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  userId: string;
}

interface BodyProfile {
  start_weight: string;
  goal_weight: string;
  height_cm: string;
  age: string;
  current_weight: string;
}

export default function KoerperTab({ userId }: Props) {
  const [weightInput, setWeightInput] = useState("");
  const [profile, setProfile] = useState<BodyProfile>({
    start_weight: "", goal_weight: "", height_cm: "", age: "", current_weight: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadProfile = useCallback(async () => {
    const { data } = await supabase
      .from("body_profile")
      .select("start_weight,goal_weight,current_weight,height_cm,age")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      setProfile({
        start_weight: data.start_weight?.toString() ?? "",
        goal_weight: data.goal_weight?.toString() ?? "",
        current_weight: data.current_weight?.toString() ?? "",
        height_cm: data.height_cm?.toString() ?? "",
        age: data.age?.toString() ?? "",
      });
    }
  }, [userId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  async function handleWeightEntry() {
    if (!weightInput) return;
    setSaving(true);
    const w = parseFloat(weightInput);
    const today = new Date().toISOString().split("T")[0];

    await supabase.from("weight_log").upsert(
      { user_id: userId, weight: w, logged_at: today },
      { onConflict: "user_id,logged_at" }
    );
    await supabase
      .from("body_profile")
      .upsert({ user_id: userId, current_weight: w }, { onConflict: "user_id" });

    setProfile((p) => ({ ...p, current_weight: weightInput }));
    setWeightInput("");
    setSaving(false);
  }

  async function handleSaveProfile() {
    setSaving(true);
    await supabase.from("body_profile").upsert(
      {
        user_id: userId,
        start_weight: profile.start_weight ? parseFloat(profile.start_weight) : null,
        goal_weight: profile.goal_weight ? parseFloat(profile.goal_weight) : null,
        height_cm: profile.height_cm ? parseInt(profile.height_cm) : null,
        age: profile.age ? parseInt(profile.age) : null,
      },
      { onConflict: "user_id" }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-3">
      {/* Weight entry */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Gewicht eintragen
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              step="0.1"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="z.B. 84.5"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">kg</span>
          </div>
          <button
            onClick={handleWeightEntry}
            disabled={!weightInput || saving}
            className="bg-gray-700 hover:bg-gray-800 disabled:opacity-40 text-white font-semibold rounded-xl px-5 py-3 text-sm transition-colors"
          >
            ✓ Eintragen
          </button>
        </div>
      </div>

      {/* Body profile */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Körperdaten
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: "Startgewicht (kg)", key: "start_weight", placeholder: "z.B. 92" },
            { label: "Zielgewicht (kg)", key: "goal_weight", placeholder: "z.B. 78" },
            { label: "Größe (cm)", key: "height_cm", placeholder: "z.B. 178" },
            { label: "Alter", key: "age", placeholder: "z.B. 30" },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1.5">{label}</label>
              <input
                type="number"
                value={profile[key as keyof BodyProfile]}
                onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
        >
          {saved ? "✓ Gespeichert!" : "✓ Profil speichern"}
        </button>
      </div>
    </div>
  );
}
