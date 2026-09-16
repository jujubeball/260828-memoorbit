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
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (error) {
      // 💡 [직접 연결한 클릭의 오류 처리]
      // SDK 생성·요청 실패는 콘솔에 기록해 직접 연결한 비동기 이벤트에 미처리 오류가 남지 않게 합니다.
      console.error("소셜 로그인 실패:", error);
    }
  };

  // 로그아웃은 이 브라우저의 인증만 해제하고 IndexedDB를 지우지 않습니다.
  const signOut = async () => {
    try {
      const supabase = createClient();
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
