"use client";

interface Props {
  consumed: number;
  goal: number;
}

export default function CalorieProgress({ consumed, goal }: Props) {
  const pct = Math.min((consumed / goal) * 100, 100);
  const remaining = goal - consumed;
  const over = consumed > goal;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex justify-between items-end mb-3">
        <div>
          <p className="text-sm text-gray-500">Heute gegessen</p>
          <p className="text-4xl font-bold text-gray-900">{consumed}</p>
          <p className="text-sm text-gray-400">kcal</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Tagesziel</p>
          <p className="text-2xl font-semibold text-gray-700">{goal}</p>
          <p className="text-sm text-gray-400">kcal</p>
        </div>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
        <div
          className={`h-4 rounded-full transition-all duration-500 ${
            over ? "bg-red-500" : pct > 80 ? "bg-orange-400" : "bg-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className={`mt-2 text-sm font-medium ${over ? "text-red-500" : "text-gray-600"}`}>
        {over
          ? `${Math.abs(remaining)} kcal über dem Ziel`
          : `Noch ${remaining} kcal übrig`}
      </p>
    </div>
  );
}
