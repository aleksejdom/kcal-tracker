export interface Meal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timestamp: number;
  date: string; // YYYY-MM-DD
}

export interface DayData {
  date: string;
  meals: Meal[];
  goal: number;
}
