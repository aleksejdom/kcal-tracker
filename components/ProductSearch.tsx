"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus, X, Check, Search } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

export interface Product {
  id?: string; name: string; calories: number;
  protein: number; fat: number; carbs: number;
}

interface Props {
  value: string; onChange: (value: string) => void;
  onSelect: (product: Product) => void;
  userId: string;
}

export default function ProductSearch({ value, onChange, onSelect, userId }: Props) {
  const { t } = useLanguage();
  const [results, setResults]       = useState<Product[]>([]);
  const [loading, setLoading]       = useState(false);
  const [open, setOpen]             = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addKcal, setAddKcal]       = useState("");
  const [addProtein, setAddProtein] = useState("");
  const [addFat, setAddFat]         = useState("");
  const [addCarbs, setAddCarbs]     = useState("");
  const [addSaving, setAddSaving]   = useState(false);
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) { setResults([]); setOpen(false); setShowAddForm(false); return; }
    setLoading(true);
    const { data } = await supabase.from("products")
      .select("id,name,calories,protein,fat,carbs")
      .ilike("name", `%${query}%`).order("name").limit(8);
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
        setOpen(false); setShowAddForm(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleAddProduct() {
    if (!value.trim() || !addKcal) { toast.error(t.toastRequiredFields); return; }
    setAddSaving(true);
    const { data, error } = await supabase.from("products")
      .insert({
        name: value.trim(), calories: parseInt(addKcal),
        protein: parseFloat(addProtein) || 0, fat: parseFloat(addFat) || 0,
        carbs: parseFloat(addCarbs) || 0, user_id: userId, source: "manual",
      })
      .select("id,name,calories,protein,fat,carbs").single();

    if (error) {
      const { data: existing } = await supabase.from("products")
        .select("id,name,calories,protein,fat,carbs").ilike("name", value.trim()).maybeSingle();
      if (existing) {
        onSelect(existing); setOpen(false); setShowAddForm(false);
        toast(t.toastExistingSelected, { description: existing.name });
      } else {
        toast.error("Fehler beim Speichern: " + error.message);
      }
    } else if (data) {
      onSelect(data); setOpen(false); setShowAddForm(false);
      toast.success(t.toastProductSaved, { description: data.name });
    }
    setAddKcal(""); setAddProtein(""); setAddFat(""); setAddCarbs("");
    setAddSaving(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={t.searchProductPlaceholder}
          className="gi w-full rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
      </div>

      {open && (
        <div className="gd absolute z-50 w-full rounded-xl shadow-2xl shadow-black/20 mt-1 overflow-hidden">
          {results.length > 0 ? (
            <>
              {results.map((p) => (
                <button key={p.id ?? p.name} type="button"
                  onMouseDown={() => { onSelect(p); setOpen(false); setShowAddForm(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-black/[0.04] dark:hover:bg-white/[0.07] border-b border-black/[0.05] dark:border-white/[0.06] last:border-0 transition-colors"
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{p.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {p.calories} kcal ·
                    <span className="text-emerald-600 dark:text-emerald-400 ml-1">E {p.protein}g</span> ·
                    <span className="text-orange-600 dark:text-orange-400 ml-1">F {p.fat}g</span> ·
                    <span className="text-slate-500 ml-1">KH {p.carbs}g</span>
                    <span className="text-slate-400 dark:text-slate-600 ml-1">/ 100g</span>
                  </div>
                </button>
              ))}
              <button type="button" onMouseDown={() => setShowAddForm(true)}
                className="w-full flex items-center gap-1.5 px-4 py-3 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 font-medium transition-colors"
              >
                <Plus size={13} /> {t.createNewProduct}
              </button>
            </>
          ) : (
            !loading && value.length >= 2 && (
              <div className="px-4 py-3">
                <p className="text-xs text-slate-500 mb-2">{t.noProductFound}</p>
                <button type="button" onMouseDown={() => setShowAddForm(true)}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  <Plus size={13} /> „{value}" {t.createProductLabel}
                </button>
              </div>
            )
          )}
        </div>
      )}

      {showAddForm && (
        <div className="mt-2 gc rounded-xl p-4 space-y-3" style={{ borderColor: "rgba(59,130,246,0.25)" }}>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-300">
            {t.newProductLabel}: <span className="font-bold text-slate-900 dark:text-white">{value}</span>
          </p>
          <p className="text-xs text-slate-500">{t.per100g}</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "kcal *", state: addKcal, set: setAddKcal, step: "1", ph: "350" },
              { label: `${t.protein} (g)`, state: addProtein, set: setAddProtein, step: "0.1", ph: "12" },
              { label: `${t.fat} (g)`,     state: addFat,     set: setAddFat,     step: "0.1", ph: "8" },
              { label: "KH (g)",           state: addCarbs,   set: setAddCarbs,   step: "0.1", ph: "45" },
            ].map(({ label, state, set, step, ph }) => (
              <div key={label}>
                <label className="text-xs text-slate-500 mb-1 block">{label}</label>
                <input type="number" min="0" step={step} value={state}
                  onChange={(e) => set(e.target.value)} placeholder={ph}
                  className="gi w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAddProduct} disabled={addSaving || !addKcal}
              className="flex-1 flex items-center justify-center gap-1.5 text-white text-xs font-semibold rounded-lg py-2 transition-colors disabled:opacity-30"
              style={{ background: "rgba(59,130,246,0.25)", border: "1px solid rgba(59,130,246,0.40)" }}
            >
              {addSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {addSaving ? `${t.saving}` : t.saveAndSelect}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white px-2"
            >
              <X size={13} /> {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
