"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface Product {
  id?: string;
  name: string;
  calories: number;
  protein: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (product: Product) => void;
  userId: string;
}

export default function ProductSearch({ value, onChange, onSelect, userId }: Props) {
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addKcal, setAddKcal] = useState("");
  const [addProtein, setAddProtein] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) { setResults([]); setOpen(false); setShowAddForm(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id,name,calories,protein")
      .ilike("name", `%${query}%`)
      .order("name")
      .limit(8);
    setResults(data ?? []);
    setOpen(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setShowAddForm(false);
    timer.current = setTimeout(() => searchProducts(value), 350);
  }, [value, searchProducts]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAddForm(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleAddProduct() {
    if (!value.trim() || !addKcal) { setAddError("Name und kcal sind erforderlich"); return; }
    setAddError("");
    setAddSaving(true);
    const { data, error } = await supabase
      .from("products")
      .insert({
        name: value.trim(),
        calories: parseInt(addKcal),
        protein: parseFloat(addProtein) || 0,
        user_id: userId,
        source: "manual",
      })
      .select("id,name,calories,protein")
      .single();

    if (error) {
      // If duplicate, just search and select
      const { data: existing } = await supabase
        .from("products")
        .select("id,name,calories,protein")
        .ilike("name", value.trim())
        .maybeSingle();
      if (existing) {
        onSelect(existing);
        setOpen(false);
        setShowAddForm(false);
      } else {
        setAddError("Fehler beim Speichern: " + error.message);
      }
    } else if (data) {
      onSelect(data);
      setOpen(false);
      setShowAddForm(false);
    }
    setAddKcal("");
    setAddProtein("");
    setAddSaving(false);
  }

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
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-pulse">suche…</span>
        )}
      </div>

      {open && (
        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
          {results.length > 0 ? (
            <>
              {results.map((p) => (
                <button
                  key={p.id ?? p.name}
                  type="button"
                  onMouseDown={() => { onSelect(p); setOpen(false); setShowAddForm(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {p.calories} kcal · Eiweiß: {p.protein}g (pro 100g)
                  </div>
                </button>
              ))}
              <button
                type="button"
                onMouseDown={() => setShowAddForm(true)}
                className="w-full text-left px-4 py-3 text-xs text-indigo-500 hover:bg-indigo-50 transition-colors"
              >
                + Neues Produkt anlegen
              </button>
            </>
          ) : (
            !loading && value.length >= 2 && (
              <div className="px-4 py-3">
                <p className="text-xs text-gray-400 mb-2">Kein Produkt gefunden.</p>
                <button
                  type="button"
                  onMouseDown={() => setShowAddForm(true)}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                >
                  + „{value}" als neues Produkt anlegen
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* Inline add-product form */}
      {showAddForm && (
        <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-indigo-700">Neues Produkt: <span className="font-bold">{value}</span></p>
          {addError && <p className="text-xs text-red-500">{addError}</p>}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">kcal / 100g *</label>
              <input
                type="number"
                min="0"
                value={addKcal}
                onChange={(e) => setAddKcal(e.target.value)}
                placeholder="z.B. 350"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Eiweiß / 100g</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={addProtein}
                onChange={(e) => setAddProtein(e.target.value)}
                placeholder="z.B. 12"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddProduct}
              disabled={addSaving || !addKcal}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-2 transition-colors"
            >
              {addSaving ? "Speichern…" : "Speichern & auswählen"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-gray-400 hover:text-gray-600 px-2"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
