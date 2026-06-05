"use client";

import { useState, useEffect, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import TodayTab from "@/components/TodayTab";
import KoerperTab from "@/components/KoerperTab";
import ProdukteTab from "@/components/ProdukteTab";
import VerlaufTab from "@/components/VerlaufTab";

type Tab = "heute" | "koerper" | "produkte" | "verlauf";

interface Settings {
  budget: number;
  deficit: number;
}

interface Props {
  session: Session;
}

const DEFAULT_SETTINGS: Settings = { budget: 2000, deficit: 0 };

export default function Dashboard({ session }: Props) {
  const [tab, setTab] = useState<Tab>("heute");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const userId = session.user.id;
  const email = session.user.email ?? "";

  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from("user_settings")
      .select("budget,deficit")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      setSettings({ budget: data.budget ?? 2000, deficit: data.deficit ?? 0 });
    } else {
      await supabase.from("user_settings").insert({
        user_id: userId, budget: 2000, deficit: 0,
      });
    }
  }, [userId]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "heute", label: "Heute" },
    { id: "koerper", label: "Körper" },
    { id: "produkte", label: "Produkte" },
    { id: "verlauf", label: "Verlauf" },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="max-w-md mx-auto px-4 pb-10">
        {/* Header */}
        <div className="pt-6 pb-3 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Kalorien-Tracker</h1>
            <p className="text-xs text-indigo-500 mt-0.5">
              Tagesziel: {settings.budget} kcal
              {settings.deficit > 0 && ` · Defizit: ${settings.deficit} kcal`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 truncate max-w-[120px]">{email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-gray-400 hover:text-gray-700 transition-colors"
              title="Abmelden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "heute" && (
          <TodayTab
            userId={userId}
            settings={settings}
            onSettingsChange={setSettings}
            onGoToKoerper={() => setTab("koerper")}
          />
        )}
        {tab === "koerper" && <KoerperTab userId={userId} />}
        {tab === "produkte" && <ProdukteTab userId={userId} />}
        {tab === "verlauf" && <VerlaufTab userId={userId} budget={settings.budget} />}
      </div>
    </div>
  );
}
