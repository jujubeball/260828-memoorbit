"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

export const isSupabaseConfigured = Boolean(getSupabaseConfig());

export function createClient() {
  // 💡 [브라우저 인증 클라이언트 공유]
  // 서버 렌더에서는 생성하지 않고, 브라우저에서는 SDK의 싱글톤을 재사용해 세션과 구독이 중복되지 않게 합니다.
  if (typeof window === "undefined") return null;
  const config = getSupabaseConfig();
  if (!config) return null;
  // 💡 [서버에서 인증 코드 교환]
  // 검증값은 쿠키로 공유하고, 돌아온 코드는 서버 콜백에서만 세션으로 교환합니다.
  return createBrowserClient(config.url, config.anonKey, {
    isSingleton: true,
    auth: { flowType: "pkce", detectSessionInUrl: false },
  });
}
