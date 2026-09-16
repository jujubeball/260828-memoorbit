"use client";

import { createContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";

export interface AuthState {
  session: Session | null;
  user: User | null;
  isGuest: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps) {
  // 개발 모드에서 구독을 다시 연결해도 이미 읽은 로그인 오류를 보존합니다.
  const callbackFailureRef = useRef<string | null>(null);
  // 인증 상태는 화면의 계정 표시만 바꿉니다. 메모와 전송 큐는 기존 저장소가 관리합니다.
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    isGuest: true,
    isLoading: Boolean(getSupabaseConfig()),
    isConfigured: Boolean(getSupabaseConfig()),
    error: null,
  });

  // 💡 [인증 구독과 초기 복원]
  // 먼저 구독을 걸고 세션을 읽어, 늦게 도착한 초기 응답이 새 로그인 상태를 덮어쓰지 않게 합니다.
  useEffect(() => {
    let active = true;
    let eventReceived = false;
    const supabase = createClient();
    const url = new URL(window.location.href);
    const callbackError = url.searchParams.has("auth_error");
    if (callbackError) {
      callbackFailureRef.current = "로그인을 완료하지 못했습니다. 다시 시도해 주세요.";
      url.searchParams.delete("auth_error");
      window.history.replaceState(window.history.state, "", url);
    }
    const update = (session: Session | null, error: string | null = null) => {
      if (active) setState({
        session, user: session?.user ?? null, isGuest: !session?.user,
        isLoading: false, isConfigured: Boolean(supabase), error,
      });
    };
    if (!supabase) {
      // 외부 시스템의 초기 결과를 비동기로 반영하며 자식 화면은 항상 렌더링합니다.
      queueMicrotask(() => update(null, callbackFailureRef.current));
      return () => { active = false; };
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      eventReceived = true;
      if (session) callbackFailureRef.current = null;
      update(session, callbackFailureRef.current);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!eventReceived) {
        if (data.session) callbackFailureRef.current = null;
        update(data.session, error ? "로그인 상태를 확인하지 못했습니다." : callbackFailureRef.current);
      }
    }).catch(() => {
      if (!eventReceived) update(null, "로그인 상태를 확인하지 못했습니다.");
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  );
}
