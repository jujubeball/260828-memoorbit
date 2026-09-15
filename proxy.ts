import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const settings = getSupabaseConfig();
  // 게스트 요청은 인증 서버를 기다리지 않고 바로 메모 화면으로 보냅니다.
  if (!settings || !request.cookies.getAll().some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name))) {
    return response;
  }
  response.headers.set("Cache-Control", "private, no-store");
  const supabase = createServerClient(settings.url, settings.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        // 갱신된 쿠키를 이번 서버 요청과 다음 브라우저 요청 양쪽에 전달합니다.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const previousCookies = response.cookies.getAll();
        response = NextResponse.next({ request });
        previousCookies.forEach((cookie) => response.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(3000) }) },
  });
  try {
    await supabase.auth.getClaims();
  } catch {
    // 인증 서버 장애가 발생해도 로컬 메모 페이지 진입을 막지 않습니다.
  }
  return response;
}

export const config = { matcher: ["/"] };
