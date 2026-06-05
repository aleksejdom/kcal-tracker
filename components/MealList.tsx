"use client";

import { Meal } from "@/types";

interface Props {
  meals: Meal[];
  onDelete: (id: string) => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default function MealList({ meals, onDelete }: Props) {
  if (meals.length === 0) {
    return (
      <p className="text-center text-gray-400 py-8 text-sm">
        Noch keine Mahlzeiten eingetragen
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {meals.map((meal) => (
        <div
          key={meal.id}
          className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100 flex items-center justify-between"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div>
                <p className="font-medium text-gray-800 truncate">{meal.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatTime(meal.timestamp)}
                  {meal.protein > 0 && ` · P: ${meal.protein}g`}
                  {meal.carbs > 0 && ` · K: ${meal.carbs}g`}
                  {meal.fat > 0 && ` · F: ${meal.fat}g`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 ml-4">
            <span className="font-bold text-gray-800 whitespace-nowrap">
              {meal.calories} <span className="text-xs font-normal text-gray-400">kcal</span>
            </span>
            <button
              onClick={() => onDelete(meal.id)}
              className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
              aria-label="Löschen"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
