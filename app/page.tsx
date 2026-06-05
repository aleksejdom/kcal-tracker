"use client";

import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import AuthForm from "@/components/AuthForm";
import Dashboard from "@/components/Dashboard";

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
    return <div className="min-h-screen bg-[#f5f5f5]" />;
  }

  if (!session) return <AuthForm />;
  return <Dashboard session={session} />;
}
