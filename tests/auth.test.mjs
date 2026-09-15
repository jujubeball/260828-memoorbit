import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
function load(file, mocks) {
  const compiled = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", code)((name) => mocks[name] ?? require(name), compiled, compiled.exports);
  return compiled.exports;
}

test("인증 초기 응답이 새 로그인 이벤트를 덮어쓰지 않고 로그아웃에도 편집 DOM을 유지한다", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let callback;
  let resolveSession;
  let unsubscribed = false;
  const oauthCalls = [];
  const auth = {
    onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } }; },
    getSession: () => new Promise((resolve) => { resolveSession = resolve; }),
    signInWithOAuth: async (options) => { oauthCalls.push(options); return { error: null }; },
    signOut: async (options) => { assert.equal(options.scope, "local"); callback("SIGNED_OUT", null); return { error: null }; },
  };
  const mocks = {
    "@/lib/supabase/client": { createClient: () => ({ auth }) },
    "@/lib/supabase/config": { getSupabaseConfig: () => ({ url: "http://localhost" }) },
  };
  const provider = load("components/providers/AuthProvider.tsx", mocks);
  const { useAuth } = load("hooks/useAuth.ts", { ...mocks, "@/components/providers/AuthProvider": provider });
  let current;
  function Editor() {
    current = useAuth();
    return React.createElement("textarea", { defaultValue: "게스트 작성 중" });
  }
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  try {
    await act(async () => root.render(React.createElement(provider.AuthProvider, null, React.createElement(Editor))));
    const editor = document.querySelector("textarea");
    assert.equal(oauthCalls.length, 0);
    assert.equal(current.isLoading, true);
    const session = { user: { id: "member-1" } };
    await act(async () => callback("SIGNED_IN", session));
    await act(async () => resolveSession({ data: { session: null }, error: null }));
    assert.equal(current.user.id, "member-1");
    assert.equal(current.isGuest, false);
    assert.equal(document.querySelector("textarea"), editor);
    await act(async () => current.signOut());
    assert.equal(current.isGuest, true);
    assert.equal(editor.value, "게스트 작성 중");
    assert.equal(document.querySelector("textarea"), editor);
    await current.signInWithGoogle();
    await current.signInWithApple();
    assert.deepEqual(oauthCalls.map((call) => call.provider), ["google", "apple"]);
    assert(oauthCalls.every((call) => call.options.redirectTo === "http://localhost:3000/auth/callback"));
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
  assert.equal(unsubscribed, true);
});

test("Supabase 미설정과 OAuth 취소에도 게스트 화면이 렌더링되고 오류 쿼리를 제거한다", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/?auth_error=login_failed&keep=1" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { AuthProvider, AuthContext } = load("components/providers/AuthProvider.tsx", {
    "@/lib/supabase/client": { createClient: () => null },
    "@/lib/supabase/config": { getSupabaseConfig: () => null },
  });
  let state;
  function Guest() {
    state = React.useContext(AuthContext);
    return React.createElement("p", null, "메모 작성 가능");
  }
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  try {
    await act(async () => root.render(React.createElement(React.StrictMode, null,
      React.createElement(AuthProvider, null, React.createElement(Guest)))));
    assert.equal(state.isLoading, false);
    assert.equal(state.isConfigured, false);
    assert.equal(state.user, null);
    assert.match(state.error, /다시 시도/);
    assert.equal(document.querySelector("p").textContent, "메모 작성 가능");
    assert.equal(window.location.search, "?keep=1");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test("OAuth 콜백은 성공·실패·취소를 처리하고 외부 리디렉션을 허용하지 않는다", async () => {
  const { NextRequest } = require("next/server");
  for (const scenario of ["success", "failure", "cancel", "missing", "unconfigured", "throw"]) {
    let exchanges = 0;
    const { GET } = load("app/auth/callback/route.ts", {
      "@/lib/supabase/server": {
        createClient: async () => scenario === "unconfigured" ? null : ({ auth: {
          exchangeCodeForSession: async (code) => {
            exchanges++;
            assert.equal(code, "test-code");
            if (scenario === "throw") throw new Error("offline");
            return { error: scenario === "failure" ? new Error("invalid") : null };
          },
        } }),
      },
    });
    const url = new URL("http://localhost:3000/auth/callback?next=https://evil.example");
    if (scenario !== "missing") url.searchParams.set("code", "test-code");
    if (scenario === "cancel") url.searchParams.set("error", "access_denied");
    const response = await GET(new NextRequest(url));
    const destination = new URL(response.headers.get("location"));
    assert.equal(destination.origin, "http://localhost:3000");
    assert.equal(destination.pathname, "/");
    assert.equal(destination.searchParams.has("auth_error"), scenario !== "success");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(exchanges, ["cancel", "missing", "unconfigured"].includes(scenario) ? 0 : 1);
  }
});
