"use client";

import { useEffect, useState, useCallback } from "react";
import { Meal, DayData } from "@/types";
import {
  getTodayData,
  addMeal,
  deleteMeal,
  getGoal,
  setGoal as saveGoal,
  getHistory,
} from "@/lib/storage";
import CalorieProgress from "@/components/CalorieProgress";
import MacroSummary from "@/components/MacroSummary";
import AddMealForm from "@/components/AddMealForm";
import MealList from "@/components/MealList";
import GoalSetting from "@/components/GoalSetting";
import WeekHistory from "@/components/WeekHistory";

export default function Home() {
  const [day, setDay] = useState<DayData | null>(null);
  const [goal, setGoalState] = useState(2000);
  const [history, setHistory] = useState<DayData[]>([]);
  const [tab, setTab] = useState<"today" | "history">("today");

  const refresh = useCallback(() => {
    setDay(getTodayData());
    setGoalState(getGoal());
    setHistory(getHistory(7));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleAdd(meal: Omit<Meal, "id" | "timestamp" | "date">) {
    addMeal(meal);
    refresh();
  }

  function handleDelete(id: string) {
    if (!day) return;
    deleteMeal(id, day.date);
    refresh();
  }

  function handleGoal(g: number) {
    saveGoal(g);
    refresh();
  }

  if (!day) return null;

  const consumed = day.meals.reduce((s, m) => s + m.calories, 0);
  const protein = day.meals.reduce((s, m) => s + m.protein, 0);
  const carbs = day.meals.reduce((s, m) => s + m.carbs, 0);
  const fat = day.meals.reduce((s, m) => s + m.fat, 0);

  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 pb-10">
        {/* Header */}
        <div className="pt-10 pb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kalorien-Tracker</h1>
            <p className="text-sm text-gray-400 capitalize mt-0.5">{today}</p>
          </div>
          <GoalSetting goal={goal} onSave={handleGoal} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
          <button
            onClick={() => setTab("today")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "today"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Heute
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "history"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Verlauf
          </button>
        </div>

        {tab === "today" ? (
          <div className="space-y-4">
            <CalorieProgress consumed={consumed} goal={goal} />
            <MacroSummary protein={protein} carbs={carbs} fat={fat} />
            <AddMealForm onAdd={handleAdd} />
            <MealList meals={[...day.meals].reverse()} onDelete={handleDelete} />
          </div>
        ) : (
          <WeekHistory history={history} />
        )}
      </div>
    </div>
  );
}
