import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

// 💡 [서버 쿠키 연결]
// 요청별 쿠키를 읽습니다. 서버 컴포넌트가 쓸 수 없는 갱신 쿠키는 Proxy에서 전달합니다.
export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 서버 컴포넌트 렌더링 중에는 쿠키 쓰기를 허용하지 않습니다.
        }
      },
    },
  });
}
