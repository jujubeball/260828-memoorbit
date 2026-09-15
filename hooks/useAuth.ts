"use client";

import { useContext } from "react";
import { AuthContext } from "@/components/providers/AuthProvider";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth는 AuthProvider 안에서 사용해야 합니다.");

  // 사용자가 로그인 버튼을 누른 시점에만 공급자로 이동합니다.
  const signIn = async (provider: "google" | "apple") => {
    console.info("소셜 로그인 요청 시작:", provider);
    if (!isSupabaseConfigured) {
      console.warn("Supabase 환경 변수가 설정되지 않아 임시 테스트 로그인 모드로 동작합니다.");
      // 💡 [화면 전용 테스트 세션]
      // 인증 토큰은 비워 두고 SDK에 저장하지 않습니다. 공급자 버튼에서 만든 사용자는 전역 화면에만 반영됩니다.
      state.setTestSession({
        access_token: "", refresh_token: "", token_type: "bearer", expires_in: 0,
        user: {
          id: `test-${provider}`, aud: "test", created_at: new Date().toISOString(),
          email: `${provider}@example.test`,
          app_metadata: { provider, is_test: true },
          user_metadata: { full_name: "임시 테스트 사용자" },
        },
      });
      return;
    }
    const supabase = createClient();
    if (!supabase) throw new Error("클라우드 연결을 준비 중입니다. 메모는 이 기기에 저장됩니다.");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch {
      // 네트워크 예외와 공급자 응답 오류 모두 한글 안내로 바꾸고 메모 상태에는 접근하지 않습니다.
      throw new Error("로그인 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  // 로그아웃은 이 브라우저의 인증만 해제하고 IndexedDB를 지우지 않습니다.
  const signOut = async () => {
    if (!isSupabaseConfigured) {
      state.setTestSession(null);
      return;
    }
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
