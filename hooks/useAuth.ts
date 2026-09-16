"use client";

import { useContext } from "react";
import { AuthContext } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";

export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth는 AuthProvider 안에서 사용해야 합니다.");

  // 사용자가 로그인 버튼을 누른 시점에만 공급자로 이동합니다.
  const signIn = async (provider: "google" | "apple") => {
    console.info("소셜 로그인 요청 시작:", provider);
    const supabase = createClient();
    if (!supabase) throw new Error("로그인 연결이 설정되지 않았습니다. 메모는 이 기기에 저장됩니다.");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch {
      // 네트워크 예외와 공급자 응답 오류 모두 한글 안내로 바꾸고 메모 상태에는 접근하지 않습니다.
      throw new Error("로그인 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  // 로그아웃은 이 브라우저의 인증만 해제하고 IndexedDB를 지우지 않습니다.
  const signOut = async () => {
    const supabase = createClient();
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch {
      throw new Error("로그아웃하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  return {
    ...state,
    signInWithGoogle: () => signIn("google"),
    signInWithApple: () => signIn("apple"),
    signOut,
  };
}
