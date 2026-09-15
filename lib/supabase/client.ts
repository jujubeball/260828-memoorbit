"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

export function createClient() {
  // 💡 [브라우저 인증 클라이언트 공유]
  // 서버 렌더에서는 생성하지 않고, 브라우저에서는 SDK의 싱글톤을 재사용해 세션과 구독이 중복되지 않게 합니다.
  if (typeof window === "undefined") return null;
  const config = getSupabaseConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.anonKey, { isSingleton: true });
}
