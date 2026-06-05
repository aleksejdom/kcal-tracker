"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Product {
  id: string;
  name: string;
  calories: number;
  protein: number;
  user_id: string | null;
}

interface Props {
  userId: string;
}

export default function ProdukteTab({ userId }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", calories: "", protein: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("products")
      .select("id,name,calories,protein,user_id")
      .order("name");
    setProducts(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.calories) return;
    setError("");
    setSaving(true);

    const { error: err } = await supabase.from("products").insert({
      name: form.name.trim(),
      calories: parseInt(form.calories),
      protein: parseFloat(form.protein) || 0,
      user_id: userId,
      source: "manual",
    });

    setSaving(false);
    if (err) {
      if (err.code === "23505") {
        setError("Dieses Produkt existiert bereits in der Datenbank.");
      } else {
        setError(err.message);
      }
    } else {
      setForm({ name: "", calories: "", protein: "" });
      setShowForm(false);
      await load();
    }
  }

  async function handleDelete(id: string) {
    await supabase.from("products").delete().eq("id", id);
    await load();
  }

  return (
    <div className="space-y-3">
      {/* Header + add button */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Produkte ({products.length})
        </p>
        <button
          onClick={() => { setShowForm(!showForm); setError(""); }}
          className="text-xs bg-gray-700 hover:bg-gray-800 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          {showForm ? "✕ Abbrechen" : "+ Produkt anlegen"}
        </button>
      </div>

      {/* Add product form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Neues Produkt</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Produktname *"
            required
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">kcal / 100g *</label>
              <input
                type="number"
                min="0"
                value={form.calories}
                onChange={(e) => setForm({ ...form, calories: e.target.value })}
                placeholder="z.B. 350"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Eiweiß / 100g</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.protein}
                onChange={(e) => setForm({ ...form, protein: e.target.value })}
                placeholder="z.B. 12"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            {saving ? "Speichern…" : "✓ Produkt speichern"}
          </button>
        </form>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Produkte durchsuchen…"
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4"
        />

        {filtered.length === 0 ? (
          <p className="text-center text-sm text-indigo-400 py-4">
            {search ? "Kein Produkt gefunden." : "Noch keine Produkte gespeichert."}
          </p>
        ) : (
          <div className="space-y-1">
            {filtered.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.calories} kcal · Eiweiß: {p.protein}g (pro 100g)
                  </p>
                </div>
                {p.user_id === userId && (
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-gray-300 hover:text-red-400 text-lg transition-colors ml-4"
                    title="Löschen"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
