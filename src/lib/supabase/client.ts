"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // 💡 [브라우저 인증 클라이언트 공유]
  // 공개 환경 값을 SDK에 직접 전달하고 싱글톤을 재사용해 세션과 구독이 중복되지 않게 합니다.
  // 💡 [서버에서 인증 코드 교환]
  // 검증값은 쿠키로 공유하고, 돌아온 코드는 서버 콜백에서만 세션으로 교환합니다.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: true,
      auth: { flowType: "pkce", detectSessionInUrl: false },
    },
  );
}
