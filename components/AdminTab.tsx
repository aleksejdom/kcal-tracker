"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Shield, ShieldOff, ShieldCheck, Trash2, RefreshCw, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

const SUPER_ADMIN_ID = "3945cd1d-242d-41c0-a633-d491ef26f999";

interface UserRow { id: string; email: string; created_at: string; role: "admin" | "user"; }
interface Props { currentUserId: string; }

export default function AdminTab({ currentUserId }: Props) {
  const { lang, t } = useLanguage();
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const isSuperAdmin = currentUserId === SUPER_ADMIN_ID;

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc("get_all_users");
    if (err) toast.error(err.message);
    else setUsers(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRoleChange(userId: string, newRole: "admin" | "user") {
    setSavingId(userId);
    const { error: err } = await supabase.rpc("set_user_role", { target_user_id: userId, new_role: newRole });
    if (err) toast.error(err.message);
    else {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(newRole === "admin" ? t.toastRolePromoted : t.toastRoleDemoted);
    }
    setSavingId(null);
  }

  async function executeDelete(userId: string, email: string) {
    const { error: err } = await supabase.rpc("delete_user_as_admin", { target_user_id: userId });
    if (err) toast.error(err.message);
    else {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success(t.toastUserDeleted, { description: email });
    }
  }

  function confirmDelete(user: UserRow) {
    toast.warning(t.confirmDeleteUser, {
      description: user.email,
      action: { label: t.confirmYesDelete, onClick: () => executeDelete(user.id, user.email) },
      cancel: { label: t.confirmCancel, onClick: () => {} },
      duration: 8000,
    });
  }

  const locale = lang === "ru" ? "ru-RU" : "de-DE";

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function getRoleBadge(user: UserRow) {
    if (user.id === SUPER_ADMIN_ID) return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium text-purple-600 dark:text-purple-300 bg-purple-500/15 border border-purple-500/30">
        <ShieldCheck size={11} /> Super-Admin
      </span>
    );
    if (user.role === "admin") return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium text-amber-600 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30">
        <Shield size={11} /> Admin
      </span>
    );
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium text-slate-500 dark:text-slate-400 bg-black/[0.05] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10]">
        <ShieldOff size={11} /> Nutzer
      </span>
    );
  }

  function getActions(user: UserRow) {
    if (user.id === currentUserId || user.id === SUPER_ADMIN_ID) return null;
    const isSaving = savingId === user.id;
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        {user.role === "user" ? (
          <button
            onClick={() => handleRoleChange(user.id, "admin")}
            disabled={isSaving}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 bg-black/[0.05] dark:bg-white/[0.07] border border-black/[0.08] dark:border-white/[0.09] hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-500/10 disabled:opacity-30 transition-colors"
          >
            {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <UserCheck size={12} />}
            {t.promoteAdmin}
          </button>
        ) : (
          isSuperAdmin && (
            <button
              onClick={() => handleRoleChange(user.id, "user")}
              disabled={isSaving}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 bg-black/[0.05] dark:bg-white/[0.07] border border-black/[0.08] dark:border-white/[0.09] hover:border-red-500/40 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-colors"
            >
              {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <ShieldOff size={12} />}
              {t.demoteUser}
            </button>
          )
        )}
        {isSuperAdmin && (
          <button
            onClick={() => confirmDelete(user)}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            title={t.confirmDeleteUser}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );
  }

  const card = "gc rounded-2xl";

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          {t.userManagementLabel} ({users.length})
        </p>
        <button onClick={load} disabled={loading}
          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          title={t.refresh}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {!isSuperAdmin && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-2.5 text-xs text-amber-600 dark:text-amber-400">
          {t.adminInfoText}
        </div>
      )}

      {loading && users.length === 0 ? (
        <div className={`${card} p-10 text-center`}>
          <RefreshCw size={20} className="animate-spin text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-500">{t.loadingUsers}</p>
        </div>
      ) : (
        <div className={`${card} overflow-hidden`}>
          {users.map((user, i) => {
            const isSelf = user.id === currentUserId;
            return (
              <div key={user.id}
                className={`px-5 py-4 ${i < users.length - 1 ? "border-b border-black/[0.05] dark:border-white/[0.06]" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user.email}</p>
                      {isSelf && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-full">{t.youLabel}</span>
                      )}
                      {getRoleBadge(user)}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{t.registered}: {fmtDate(user.created_at)}</p>
                  </div>
                  {getActions(user)}
                </div>
              </div>
            );
          })}
          {users.length === 0 && !loading && (
            <div className="p-8 text-center text-sm text-slate-500">{t.noUsers}</div>
          )}
        </div>
      )}
    </div>
  );
}
