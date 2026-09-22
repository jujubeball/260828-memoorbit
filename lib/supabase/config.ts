interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// 공개 설정이 없으면 인증만 쉬고, 브라우저의 메모 금고는 계속 사용합니다.
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return { url, anonKey };
  } catch {
    return null;
  }
}
