# Supabase 1단계 연결 안내

현재 코드는 Google/Apple OAuth와 계정별 notes 테이블 기반을 제공합니다. 메모는 계속 IndexedDB에 저장되며 로그인만으로 업로드되지는 않습니다. 로컬 저장소는 브라우저 단위로 공유되므로 같은 기기의 다른 로그인 계정에서도 기존 로컬 메모가 보입니다. 계정별 로컬 격리와 게스트 이관은 후속 작업입니다.

## 프로젝트 설정

1. Supabase 프로젝트의 URL과 공개 anon 키를 루트 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 입력합니다. `.env.example`을 참고하세요. 기존 다른 환경 변수는 유지합니다. 서버 전용 service_role 키는 공개 변수에 넣지 않습니다.
2. SQL Editor에서 `migrations/202609140001_create_notes.sql`을 한 번 실행하거나 연결된 Supabase CLI 프로젝트에서 마이그레이션을 적용합니다. 이 파일은 notes 테이블이 없는 상태를 전제로 합니다.
3. Authentication → Providers에서 Google과 Apple을 활성화하고 각 공급자의 OAuth 설정을 입력합니다. 공급자 콘솔의 리디렉션 URL은 Supabase가 표시하는 `https://<프로젝트>.supabase.co/auth/v1/callback`입니다.
4. Supabase Authentication → URL Configuration에서 Site URL을 실제 서비스 주소로, Redirect URLs를 `http://localhost:3000/auth/callback`과 `https://<배포 도메인>/auth/callback`으로 등록합니다. 실제 사용하는 포트·도메인을 정확히 맞춥니다.
5. Apple은 웹 로그인용 Services ID·도메인 설정 및 서명된 클라이언트 시크릿이 필요합니다. 시크릿 만료 전에 갱신합니다. Google/Apple 버튼은 OAuth 흐름을 시작하며 공급자 화면의 계정 선택·동의는 필요할 수 있습니다.
6. 배포 플랫폼에도 두 공개 변수를 등록한 뒤 다시 빌드·배포합니다. Next.js 공개 변수는 빌드 시 번들에 들어갑니다.

## 데이터 및 보안 계약

- `notes.content`는 TEXT입니다. 후속 이관에서는 `Memo.richContent`를 보존하고 기존 문자열 메모 ID를 UUID로 안정적으로 매핑해야 합니다. 태그·이미지·연관 링크·수정본·삭제 큐까지 잃지 않는 스키마 확장과 매핑이 필요합니다.
- `user_id`는 필수이고 `auth.users` 삭제 시 해당 메모도 삭제됩니다. 로그인 사용자는 본인 행만 조회·생성·수정·삭제할 수 있습니다. 다른 UUID로 소유권을 바꾸는 UPDATE도 차단됩니다.
- `updated_at`은 UPDATE 트리거로 서버 시각을 기록합니다. 현재 로컬 큐의 revision 확인 프로토콜을 대신하지 않습니다.
- 게스트에게 notes 권한을 부여하지 않습니다. 브라우저 user 정보는 UI 표시용이며, 데이터 접근 권한은 DB의 `auth.uid()`와 RLS가 판단합니다.
- 기존 `NEXT_PUBLIC_MEMO_SYNC_ENDPOINT`는 이번 작업에서 연결하지 않습니다. 해당 설정을 별도로 사용 중이라면 별도 API의 인증·소유권 검증이 필요합니다.
- Provider는 메모를 삭제·이관하거나 자동 로그인 창을 띄우지 않습니다. 로그아웃은 현재 브라우저 세션 범위입니다.

## 검수

- 자동: `npm test`, `npx eslint .`, `npx tsc --noEmit`, `npm run build`.
- 환경 변수 없이 접속해 메모 생성·수정·삭제·새로고침 복원, 로그인 버튼 비활성 안내를 확인합니다.
- 실제 프로젝트에서 Google/Apple 성공·취소·새로고침·로그아웃·다른 탭 상태 변경을 확인합니다.
- 두 테스트 계정으로 각각 로그인한 공개 클라이언트를 사용해 본인 CRUD가 성공하는지 확인합니다. 상대 user_id의 INSERT와 소유권 UPDATE는 거부되어야 하고 상대 메모 SELECT/UPDATE/DELETE는 접근 가능한 행이 없어야 합니다. SQL Editor의 관리자 역할만으로 RLS를 검증하지 않습니다.
- iPhone Safari에서 44px 헤더 버튼, 시트 열기·바깥 탭·Escape 닫기, 작성 중 키보드와 하단 툴바 유지 및 가로 넘침을 검수합니다. 팝오버 지원 브라우저가 필요합니다(iOS Safari 17 이상).
- 실제 Supabase 자격 정보와 연결 가능한 브라우저가 없는 상태에서는 실계정 OAuth·원격 SQL 적용·RLS 실행·모바일 시각 검수를 완료했다고 표시하지 않습니다.

구현 참고: [Supabase SSR 클라이언트](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [Google 로그인](https://supabase.com/docs/guides/auth/social-login/auth-google), [Apple 로그인](https://supabase.com/docs/guides/auth/social-login/auth-apple).
