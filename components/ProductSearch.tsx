"use client";

import { useState, useEffect, useRef } from "react";

interface Product {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (product: Product) => void;
}

export default function ProductSearch({ value, onChange, onSelect }: Props) {
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (value.length < 2) { setResults([]); setOpen(false); return; }

    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/food-search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setResults(data.products ?? []);
        setOpen(data.products?.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Produkt suchen oder eingeben..."
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">...</span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
          {results.map((p, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => {
                onSelect(p);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
            >
              <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {p.calories} kcal / 100g · P: {p.protein}g · K: {p.carbs}g · F: {p.fat}g
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
