"use client";

import { useContext } from "react";
import { AuthContext } from "@/components/providers/AuthProvider";
import { createClient } from "@/src/lib/supabase/client";

export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth는 AuthProvider 안에서 사용해야 합니다.");

  // 💡 [실제 소셜 인증 시작]
  // 모달 클릭을 SDK에 전달해 공급자로 이동하고, 인증 후 서버 콜백에서 세션 쿠키를 받습니다.
  const signIn = async (provider: "google" | "apple") => {
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
      const message = error instanceof Error ? error.message : "로그인 요청을 완료하지 못했습니다.";
      console.error(provider === "google" ? "구글 로그인 실패:" : "애플 로그인 실패:", message);
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
