"use client";

import { DayData } from "@/types";

interface Props {
  history: DayData[];
}

function fmt(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
}

function totalCals(day: DayData): number {
  return day.meals.reduce((s, m) => s + m.calories, 0);
}

export default function WeekHistory({ history }: Props) {
  const max = Math.max(...history.map(totalCals), 1);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Letzte 7 Tage</h3>
      <div className="space-y-2">
        {history.map((day, i) => {
          const cals = totalCals(day);
          const pct = (cals / max) * 100;
          const isToday = i === 0;
          return (
            <div key={day.date} className="flex items-center gap-3">
              <span className={`text-xs w-20 shrink-0 ${isToday ? "font-semibold text-emerald-600" : "text-gray-500"}`}>
                {isToday ? "Heute" : fmt(day.date)}
              </span>
              <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full ${isToday ? "bg-emerald-500" : "bg-gray-300"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-16 text-right">
                {cals > 0 ? `${cals} kcal` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
