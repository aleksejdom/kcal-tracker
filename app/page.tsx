"use client";

import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import AuthForm from "@/components/AuthForm";
import Dashboard from "@/components/Dashboard";
import { Flame } from "lucide-react";

export default function Page() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, sess) => {
      setSession(sess);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="blob blob-1" /><div className="blob blob-2" />
          <div className="blob blob-3" /><div className="blob blob-4" />
        </div>
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl"
            style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
          >
            <Flame size={26} className="text-white" strokeWidth={1.8} />
          </div>
          <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!session) return <AuthForm />;
  return <Dashboard session={session} />;
}
