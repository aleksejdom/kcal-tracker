"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface DayEntry {
  date: string;
  total: number;
  count: number;
}

interface Props {
  userId: string;
  budget: number;
}

export default function VerlaufTab({ userId, budget }: Props) {
  const [history, setHistory] = useState<DayEntry[]>([]);

  const load = useCallback(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const from = thirtyDaysAgo.toISOString().split("T")[0];

    const { data } = await supabase
      .from("food_entries")
      .select("entry_date,calories")
      .eq("user_id", userId)
      .gte("entry_date", from)
      .order("entry_date", { ascending: false });

    const grouped: Record<string, DayEntry> = {};
    for (const row of data ?? []) {
      if (!grouped[row.entry_date]) {
        grouped[row.entry_date] = { date: row.entry_date, total: 0, count: 0 };
      }
      grouped[row.entry_date].total += row.calories;
      grouped[row.entry_date].count += 1;
    }
    setHistory(Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  function fmtDate(d: string) {
    const today = new Date().toISOString().split("T")[0];
    if (d === today) return "Heute";
    return new Date(d + "T00:00:00").toLocaleDateString("de-DE", {
      weekday: "short", day: "numeric", month: "short",
    });
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
        Verlauf (30 Tage)
      </p>

      {history.length === 0 ? (
        <p className="text-center text-sm text-indigo-400 py-6">Noch kein Verlauf vorhanden</p>
      ) : (
        <div className="space-y-3">
          {history.map((day) => {
            const pct = Math.min((day.total / budget) * 100, 100);
            const over = day.total > budget;
            const isToday = day.date === new Date().toISOString().split("T")[0];
            return (
              <div key={day.date}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-sm ${isToday ? "font-semibold text-gray-900" : "text-gray-600"}`}>
                    {fmtDate(day.date)}
                  </span>
                  <span className={`text-sm font-medium ${over ? "text-red-500" : "text-gray-700"}`}>
                    {day.total} kcal
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${over ? "bg-red-400" : "bg-gray-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
