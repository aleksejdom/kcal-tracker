"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, X, Trash2, Pencil, Check, Search, Globe } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

const SUPER_ADMIN_ID = "3945cd1d-242d-41c0-a633-d491ef26f999";

interface Product {
  id: string; name: string; calories: number;
  protein: number; fat: number; carbs: number; user_id: string | null;
}
type EditForm = { name: string; calories: string; protein: string; fat: string; carbs: string };
interface Props { userId: string; isAdmin: boolean; }

export default function ProdukteTab({ userId, isAdmin }: Props) {
  const { t } = useLanguage();
  const isSuperAdmin = userId === SUPER_ADMIN_ID;

  const [products, setProducts]   = useState<Product[]>([]);
  const [search, setSearch]       = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState<EditForm>({ name: "", calories: "", protein: "", fat: "", carbs: "" });
  const [isGlobal, setIsGlobal]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm]   = useState<EditForm>({ name: "", calories: "", protein: "", fat: "", carbs: "" });
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("products")
      .select("id,name,calories,protein,fat,carbs,user_id")
      .order("name");
    setProducts(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.calories) return;
    setSaving(true);
    const { error: err } = await supabase.from("products").insert({
      name: form.name.trim(), calories: parseInt(form.calories),
      protein: parseFloat(form.protein) || 0, fat: parseFloat(form.fat) || 0,
      carbs: parseFloat(form.carbs) || 0,
      user_id: isSuperAdmin && isGlobal ? null : userId,
      source: "manual",
    });
    setSaving(false);
    if (err) toast.error(err.code === "23505" ? "Dieses Produkt existiert bereits." : err.message);
    else {
      toast.success(t.toastProductSaved, { description: form.name.trim() });
      setForm({ name: "", calories: "", protein: "", fat: "", carbs: "" });
      setIsGlobal(false);
      setShowForm(false);
      await load();
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editForm.name.trim() || !editForm.calories) { toast.error(t.toastRequiredFields); return; }
    setEditSaving(true);
    const { error: err } = await supabase.from("products").update({
      name: editForm.name.trim(), calories: parseInt(editForm.calories),
      protein: parseFloat(editForm.protein) || 0, fat: parseFloat(editForm.fat) || 0,
      carbs: parseFloat(editForm.carbs) || 0, updated_at: new Date().toISOString(),
    }).eq("id", id);
    setEditSaving(false);
    if (err) toast.error(err.message);
    else { toast.success(t.toastChangesSaved, { description: editForm.name.trim() }); setEditingId(null); await load(); }
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setEditForm({ name: p.name, calories: String(p.calories), protein: String(p.protein), fat: String(p.fat), carbs: String(p.carbs) });
  }

  function confirmDelete(p: Product) {
    toast.warning(`"${p.name}" ${t.confirmDeleteProduct}`, {
      description: t.confirmCannotUndo,
      action: { label: t.confirmYesDelete, onClick: () => executeDelete(p.id) },
      cancel: { label: t.confirmCancel, onClick: () => {} },
      duration: 8000,
    });
  }

  async function executeDelete(id: string) {
    await supabase.from("products").delete().eq("id", id);
    await load();
    toast.success(t.toastProductDeleted);
  }

  function canEdit(p: Product) {
    if (isSuperAdmin) return true;
    return p.user_id === userId;
  }

  const macroFields: { key: keyof EditForm; label: string; placeholder: string }[] = [
    { key: "calories", label: "kcal *",           placeholder: "350" },
    { key: "protein",  label: `${t.protein} (g)`, placeholder: "12" },
    { key: "fat",      label: `${t.fat} (g)`,     placeholder: "8" },
    { key: "carbs",    label: "KH (g)",            placeholder: "45" },
  ];

  const card  = "gc rounded-2xl";
  const inp   = "gi w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50";
  const inpSm = "gi w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50";

  return (
    <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-6 space-y-4 lg:space-y-0">

      {/* ── LEFT: Add form (all users) ── */}
      <div className="space-y-3">
        {/* Mobile toggle */}
        <div className="flex items-center justify-between lg:hidden">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{t.productsLabel} ({products.length})</p>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-colors"
            style={{ background: "rgba(59,130,246,0.20)", border: "1px solid rgba(59,130,246,0.30)" }}
          >
            {showForm ? <><X size={13} /> {t.cancel}</> : <><Plus size={13} /> {t.addProductBtn}</>}
          </button>
        </div>

        {/* Form — always on desktop, toggled on mobile */}
        <div className={`${card} p-5 ${showForm ? "block" : "hidden lg:block"}`}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 hidden lg:block">
            {t.newProductTitle}
          </p>
          <form onSubmit={handleAdd} className="space-y-3">
            <input type="text" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t.productNamePlaceholder} required className={inp}
            />
            <p className="text-xs text-slate-500">{t.per100g}</p>
            <div className="grid grid-cols-2 gap-2">
              {macroFields.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-slate-500 mb-1 block">{label}</label>
                  <input type="number" min="0" step={key === "calories" ? "1" : "0.1"}
                    value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder} required={key === "calories"}
                    className={inpSm}
                  />
                </div>
              ))}
            </div>

            {isSuperAdmin && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setIsGlobal(!isGlobal)}
                  className={`w-9 h-5 rounded-full flex items-center transition-colors ${isGlobal ? "bg-blue-500" : "bg-black/[0.12] dark:bg-white/[0.15]"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mx-0.5 ${isGlobal ? "translate-x-4" : "translate-x-0"}`} />
                </div>
                <span className="text-xs text-slate-500">{t.markAsGlobal}</span>
              </label>
            )}

            <button type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 font-semibold rounded-xl py-3 text-sm text-white disabled:opacity-30 transition-all"
              style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", boxShadow: "0 4px 16px rgba(59,130,246,0.25)" }}
            >
              <Check size={15} />
              {saving ? t.saving : t.saveProductBtn}
            </button>
          </form>
        </div>
      </div>

      {/* ── RIGHT: Search + list ── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest hidden lg:block">{t.productsLabel} ({products.length})</p>

        <div className={`${card} p-5`}>
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchProducts}
              className="gi w-full rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-4">
              {search ? t.noProductFound : t.noProductsYet}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((p) =>
                editingId === p.id ? (
                  <div key={p.id} className="py-3 border-b border-black/[0.05] dark:border-white/[0.06] last:border-0 space-y-3">
                    <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder={t.productNamePlaceholder}
                      className="gi w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      style={{ borderColor: "rgba(59,130,246,0.40)" }}
                    />
                    <p className="text-xs text-slate-500">{t.per100g}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {macroFields.map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label className="text-xs text-slate-500 mb-1 block">{label}</label>
                          <input type="number" min="0" step={key === "calories" ? "1" : "0.1"}
                            value={editForm[key]} onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                            placeholder={placeholder} className={inpSm}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveEdit(p.id)} disabled={editSaving}
                        className="flex-1 flex items-center justify-center gap-1.5 text-white text-xs font-semibold rounded-lg py-2 transition-colors disabled:opacity-30"
                        style={{ background: "rgba(59,130,246,0.25)", border: "1px solid rgba(59,130,246,0.40)" }}
                      >
                        <Check size={13} />
                        {editSaving ? t.saving : t.save}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.05]"
                      >
                        <X size={13} /> {t.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={p.id} className="flex items-center justify-between py-3 border-b border-black/[0.05] dark:border-white/[0.06] last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{p.name}</p>
                        {p.user_id === null && (
                          <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20">
                            <Globe size={9} /> {t.globalBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {p.calories} kcal ·
                        <span className="text-emerald-600 dark:text-emerald-500 ml-1">E {p.protein}g</span> ·
                        <span className="text-orange-600 dark:text-orange-500 ml-1">F {p.fat}g</span> ·
                        <span className="text-slate-500 ml-1">KH {p.carbs}g</span>
                        <span className="text-slate-400 dark:text-slate-700 ml-1">/ 100g</span>
                      </p>
                    </div>
                    {canEdit(p) && (
                      <div className="flex items-center gap-1 ml-3 shrink-0">
                        <button onClick={() => startEdit(p)}
                          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors rounded-lg"
                        >
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => confirmDelete(p)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
