"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Product {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Props {
  userId: string;
}

export default function ProdukteTab({ userId }: Props) {
  const [products, setProducts] = useState<Product[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("products")
      .select("id,name,calories,protein,carbs,fat")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setProducts(data ?? []);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    await supabase.from("products").delete().eq("id", id);
    await load();
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
        Gespeicherte Produkte ({products.length})
      </p>

      {products.length === 0 ? (
        <p className="text-center text-sm text-indigo-400 py-6">Noch keine Produkte gespeichert.</p>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{p.name}</p>
                <p className="text-xs text-gray-400">
                  {p.calories} kcal · P: {p.protein}g · K: {p.carbs}g · F: {p.fat}g
                </p>
              </div>
              <button onClick={() => handleDelete(p.id)} className="text-gray-300 hover:text-red-400 text-lg transition-colors ml-4">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
