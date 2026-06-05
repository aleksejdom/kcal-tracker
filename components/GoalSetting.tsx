"use client";

import { useState } from "react";

interface Props {
  goal: number;
  onSave: (goal: number) => void;
}

export default function GoalSetting({ goal, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(goal));

  function handleSave() {
    const n = parseInt(value, 10);
    if (n > 0) {
      onSave(n);
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => { setValue(String(goal)); setOpen(true); }}
        className="text-xs text-gray-400 hover:text-emerald-600 transition-colors"
      >
        Ziel ändern
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
      />
      <span className="text-xs text-gray-500">kcal</span>
      <button
        onClick={handleSave}
        className="text-xs bg-emerald-500 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors"
      >
        Speichern
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
    </div>
  );
}
