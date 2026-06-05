"use client";

interface Props {
  protein: number;
  carbs: number;
  fat: number;
}

function MacroBar({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${color}`} />
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-800">
        {value.toFixed(1)} {unit}
      </span>
    </div>
  );
}

export default function MacroSummary({ protein, carbs, fat }: Props) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Makros</h3>
      <MacroBar label="Protein" value={protein} unit="g" color="bg-blue-500" />
      <MacroBar label="Kohlenhydrate" value={carbs} unit="g" color="bg-amber-400" />
      <MacroBar label="Fett" value={fat} unit="g" color="bg-rose-400" />
    </div>
  );
}
