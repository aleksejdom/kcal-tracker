import { Meal, DayData } from "@/types";

const STORAGE_KEY = "kcal-tracker-data";
const GOAL_KEY = "kcal-tracker-goal";
const DEFAULT_GOAL = 2000;

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function loadAll(): Record<string, DayData> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, DayData>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getGoal(): number {
  if (typeof window === "undefined") return DEFAULT_GOAL;
  const raw = localStorage.getItem(GOAL_KEY);
  return raw ? parseInt(raw, 10) : DEFAULT_GOAL;
}

export function setGoal(goal: number): void {
  localStorage.setItem(GOAL_KEY, String(goal));
}

export function getDayData(date: string): DayData {
  const all = loadAll();
  return all[date] ?? { date, meals: [], goal: getGoal() };
}

export function getTodayData(): DayData {
  return getDayData(getTodayKey());
}

export function addMeal(meal: Omit<Meal, "id" | "timestamp" | "date">): Meal {
  const all = loadAll();
  const date = getTodayKey();
  const day = all[date] ?? { date, meals: [], goal: getGoal() };

  const newMeal: Meal = {
    ...meal,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    date,
  };

  day.meals.push(newMeal);
  all[date] = day;
  saveAll(all);
  return newMeal;
}

export function deleteMeal(mealId: string, date: string): void {
  const all = loadAll();
  if (!all[date]) return;
  all[date].meals = all[date].meals.filter((m) => m.id !== mealId);
  saveAll(all);
}

export function getHistory(days = 7): DayData[] {
  const all = loadAll();
  const result: DayData[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    result.push(all[key] ?? { date: key, meals: [], goal: getGoal() });
  }
  return result;
}
