"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthForm() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    if (tab === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      // Use the current origin so the confirmation email links back to this app, not localhost
      const redirectTo = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) setError(error.message);
      else setInfo("Bestätigungs-E-Mail gesendet. Bitte prüfe dein Postfach.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Kalorien-Tracker</h1>
          <p className="text-sm text-indigo-500 mt-1">Verfolge deine Ernährung und dein Gewichtsziel.</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => { setTab("login"); setError(""); setInfo(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === "login" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              Anmelden
            </button>
            <button
              type="button"
              onClick={() => { setTab("register"); setError(""); setInfo(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === "register" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              Registrieren
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deine@email.de"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Passwort {tab === "register" && <span className="font-normal text-gray-400">(min. 6 Zeichen)</span>}
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {info && <p className="text-sm text-green-600">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors mt-2"
            >
              {loading ? "…" : tab === "login" ? "Anmelden" : "Konto erstellen"}
            </button>

            {tab === "register" && (
              <p className="text-center text-xs text-gray-400">
                Daten werden sicher auf diesem Gerät gespeichert.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
