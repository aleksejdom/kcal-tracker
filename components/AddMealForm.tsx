"use client";

import { useState } from "react";
import { Meal } from "@/types";

interface Props {
  onAdd: (meal: Omit<Meal, "id" | "timestamp" | "date">) => void;
}

const emptyForm = { name: "", calories: "", protein: "", carbs: "", fat: "" };

export default function AddMealForm({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Bitte Name eingeben");
      return;
    }
    const calories = Number(form.calories);
    if (!calories || calories < 0) {
      setError("Bitte gültige Kalorien eingeben");
      return;
    }
    onAdd({
      name: form.name.trim(),
      calories,
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
    });
    setForm(emptyForm);
    setError("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-emerald-400 hover:text-emerald-600 transition-colors font-medium"
      >
        + Mahlzeit hinzufügen
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4"
    >
      <h3 className="font-semibold text-gray-800">Neue Mahlzeit</h3>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <input
        type="text"
        placeholder="Name (z.B. Haferflocken)"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Kalorien *</label>
          <input
            type="number"
            min="0"
            placeholder="kcal"
            value={form.calories}
            onChange={(e) => setForm({ ...form, calories: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Protein</label>
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="g"
            value={form.protein}
            onChange={(e) => setForm({ ...form, protein: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Kohlenhydrate</label>
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="g"
            value={form.carbs}
            onChange={(e) => setForm({ ...form, carbs: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Fett</label>
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="g"
            value={form.fat}
            onChange={(e) => setForm({ ...form, fat: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
        >
          Hinzufügen
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setForm(emptyForm); setError(""); }}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl py-3 text-sm transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
