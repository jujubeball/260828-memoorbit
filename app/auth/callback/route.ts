import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";

// 💡 [소셜 로그인 귀환]
// 공급자가 돌려준 일회용 코드를 세션 쿠키로 교환한 뒤 항상 같은 출처의 홈으로 돌아갑니다.
export async function GET(request: NextRequest) {
  const destination = new URL("/", request.url);
  const code = request.nextUrl.searchParams.get("code");
  const response = NextResponse.redirect(destination);
  try {
    const config = getSupabaseConfig();
    if (!code || !config || request.nextUrl.searchParams.has("error")) {
      destination.searchParams.set("auth_error", "login_failed");
    } else {
      const supabase = createServerClient(config.url, config.anonKey, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          // 💡 [리디렉션 응답에 세션 저장]
          // 교환된 쿠키와 캐시 방지 헤더를 실제 반환할 응답에 기록해야 메인에서도 로그인이 유지됩니다.
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
            Object.entries(headers).forEach(([name, value]) => {
              response.headers.set(name, value);
            });
          },
        },
      });
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) destination.searchParams.set("auth_error", "login_failed");
    }
  } catch {
    destination.searchParams.set("auth_error", "login_failed");
  }
  response.headers.set("Location", destination.toString());
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
