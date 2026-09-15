import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 💡 [소셜 로그인 귀환]
// 공급자가 돌려준 일회용 코드를 세션 쿠키로 교환한 뒤 항상 같은 출처의 홈으로 돌아갑니다.
export async function GET(request: NextRequest) {
  const destination = new URL("/", request.url);
  const code = request.nextUrl.searchParams.get("code");
  try {
    const supabase = await createClient();
    if (!code || !supabase || request.nextUrl.searchParams.has("error")) {
      destination.searchParams.set("auth_error", "login_failed");
    } else {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) destination.searchParams.set("auth_error", "login_failed");
    }
  } catch {
    destination.searchParams.set("auth_error", "login_failed");
  }
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
