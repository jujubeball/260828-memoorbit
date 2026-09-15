"use client";

import { useContext } from "react";
import { AuthContext } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";

export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth는 AuthProvider 안에서 사용해야 합니다.");

  // 사용자가 로그인 버튼을 누른 시점에만 공급자로 이동합니다.
  const signIn = async (provider: "google" | "apple") => {
    const supabase = createClient();
    if (!supabase) throw new Error("클라우드 연결을 준비 중입니다. 메모는 이 기기에 저장됩니다.");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: new URL("/auth/callback", window.location.origin).href },
    });
    if (error) throw new Error("로그인 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  };

  // 로그아웃은 이 브라우저의 인증만 해제하고 IndexedDB를 지우지 않습니다.
  const signOut = async () => {
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw new Error("로그아웃하지 못했습니다. 다시 시도해 주세요.");
  };

  return {
    ...state,
    isGuest: !state.user,
    signInWithGoogle: () => signIn("google"),
    signInWithApple: () => signIn("apple"),
    signOut,
  };
}
