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
    "@/src/lib/supabase/client": { createClient: () => ({ auth }) },
    "@/lib/supabase/config": { getSupabaseConfig: () => ({ url: "http://localhost" }) },
  };
  const provider = load("components/providers/AuthProvider.tsx", mocks);
  const { useAuth } = load("hooks/useAuth.ts", { ...mocks, "@/components/providers/AuthProvider": provider });
  const { AuthButton } = load("src/components/AuthButton.tsx", {
    "@/hooks/useAuth": { useAuth },
    "@/components/auth/SocialAuthModal": { SocialAuthModal: () => null },
  });
  let current;
  function Editor() {
    current = useAuth();
    return React.createElement(React.Fragment, null,
      React.createElement("textarea", { defaultValue: "게스트 작성 중" }), React.createElement(AuthButton));
  }
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  try {
    await act(async () => root.render(React.createElement(provider.AuthProvider, null, React.createElement(Editor))));
    const editor = document.querySelector("textarea");
    assert.equal(oauthCalls.length, 0);
    assert.equal(current.isLoading, true);
    const session = { user: { id: "member-1", email: "member@example.test" } };
    await act(async () => callback("SIGNED_IN", session));
    await act(async () => resolveSession({ data: { session: null }, error: null }));
    assert.equal(current.user.id, "member-1");
    assert.equal(current.isGuest, false);
    assert(document.getElementById("root").textContent.includes("member@example.test"));
    assert.equal(document.querySelector("textarea"), editor);
    await act(async () => document.querySelector("button").click());
    assert.equal(current.isGuest, true);
    assert.equal(document.querySelector("button").getAttribute("aria-label"), "클라우드 동기화 로그인");
    assert.equal(editor.value, "게스트 작성 중");
    assert.equal(document.querySelector("textarea"), editor);
    await current.signInWithGoogle();
    await current.signInWithApple();
    assert.deepEqual(oauthCalls.map((call) => call.provider), ["google", "apple"]);
    assert(oauthCalls.every((call) => call.options.redirectTo === "http://localhost:3000/auth/callback"));
    dom.reconfigure({ url: "https://memoorbit-test.vercel.app/" });
    await current.signInWithGoogle();
    assert.equal(oauthCalls.at(-1).options.redirectTo, "https://memoorbit-test.vercel.app/auth/callback");
    // SDK가 영문 네트워크 예외를 던져도 화면으로는 한글 안내만 전달합니다.
    auth.signInWithOAuth = async () => { throw new Error("Failed to fetch"); };
    await assert.doesNotReject(current.signInWithGoogle());
    auth.signOut = async () => ({ error: new Error("Network unavailable") });
    await assert.rejects(current.signOut(), /로그아웃하지 못했습니다/);
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
    "@/src/lib/supabase/client": { createClient: () => null },
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
    assert.equal(state.isGuest, true);
    assert.match(state.error, /다시 시도/);
    assert.equal(document.querySelector("p").textContent, "메모 작성 가능");
    assert.equal(window.location.search, "?keep=1");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test("소셜 모달은 경고 없이 매 클릭마다 공급자를 호출하고 닫기·포커스를 복원한다", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000", pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.scrollTo = () => {};
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
    this.querySelector("button")?.focus();
  };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  let googleCalls = 0;
  let appleCalls = 0;
  const authState = {
    user: null, isLoading: false, isConfigured: false, error: null,
    signInWithGoogle: () => {
      googleCalls += 1;
      return new Promise(() => {});
    },
    signInWithApple: async () => { appleCalls += 1; },
    signOut: async () => { authState.user = null; },
  };
  const mocks = {
    "@/hooks/useAuth": { useAuth: () => authState },
    "@/src/hooks/usePageScrollLock": load("src/hooks/usePageScrollLock.ts", {}),
  };
  const modal = load("components/auth/SocialAuthModal.tsx", mocks);
  const { AuthButton } = load("src/components/AuthButton.tsx", { ...mocks, "@/components/auth/SocialAuthModal": modal });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  const render = () => root.render(React.createElement(React.Fragment, null,
    React.createElement("textarea", { defaultValue: "게스트 메모 보존" }), React.createElement(AuthButton)));
  const trigger = () => document.querySelector('[aria-haspopup="dialog"]');
  const open = () => act(async () => { trigger().focus(); trigger().click(); });
  try {
    await act(async () => render());
    const editor = document.querySelector("textarea");
    assert.equal(document.querySelector("dialog"), null);
    assert.equal(googleCalls + appleCalls, 0);
    await act(async () => {
      trigger().focus();
      trigger().querySelector("span").click();
    });
    assert.equal(document.querySelectorAll("dialog input, dialog textarea").length, 0);
    let buttons = [...document.querySelectorAll("dialog button")];
    assert.deepEqual(buttons.slice(1).map((button) => button.textContent), ["Google 로그인", "Apple 로그인"]);
    assert(buttons.slice(1).every((button) => !button.disabled));
    authState.isLoading = true;
    await act(async () => render());
    buttons = [...document.querySelectorAll("dialog button")];
    await act(async () => { buttons[1].click(); buttons[1].click(); });
    assert.equal(googleCalls, 2);
    assert(buttons.slice(1).every((button) => !button.hasAttribute("disabled")));
    assert.equal(document.querySelector('[role="alert"]'), null);
    assert.equal(document.querySelector('[role="status"]'), null);
    assert(!document.querySelector("dialog").textContent.includes("설정되지"));
    await act(async () => buttons[2].click());
    assert.equal(appleCalls, 1);
    await act(async () => document.querySelector("dialog").dispatchEvent(new dom.window.Event("cancel", { cancelable: true })));
    assert.equal(document.querySelector("dialog"), null);
    assert.equal(document.activeElement, trigger());
    assert.equal(document.querySelector("textarea"), editor);
    assert.equal(editor.value, "게스트 메모 보존");
    assert.equal(document.body.style.position, "");
    await open();
    await act(async () => document.querySelector("dialog").click());
    assert.equal(document.querySelector("dialog"), null);
    authState.user = { id: "member", email: "member@example.test" };
    await act(async () => render());
    assert(document.getElementById("root").textContent.includes("member@example.test"));
    assert.equal(trigger(), null);
    await act(async () => [...document.querySelectorAll("button")].find((button) => button.textContent === "로그아웃").click());
    assert(trigger());
    assert.equal(document.querySelector("dialog"), null);
    assert.equal(editor.value, "게스트 메모 보존");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test("Header 로그아웃은 중복 요청을 막고 실패 후 재시도하며 외부 로그아웃에 모달을 다시 열지 않는다", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let rejectSignOut;
  let calls = 0;
  const authState = {
    user: { email: "member@example.test" },
    signOut: () => { calls++; return new Promise((_resolve, reject) => { rejectSignOut = reject; }); },
  };
  const { AuthButton } = load("src/components/AuthButton.tsx", {
    "@/hooks/useAuth": { useAuth: () => authState },
    "@/components/auth/SocialAuthModal": {
      SocialAuthModal: () => React.createElement("div", { role: "dialog" }, "로그인"),
    },
  });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  const render = () => root.render(React.createElement(AuthButton));
  try {
    await act(async () => render());
    await act(async () => { document.querySelector("button").click(); document.querySelector("button").click(); });
    assert.equal(calls, 1);
    assert.equal(document.querySelector("button").disabled, true);
    await act(async () => rejectSignOut(new Error("offline")));
    assert.match(document.querySelector('[role="alert"]').textContent, /다시 시도/);
    assert(document.getElementById("root").textContent.includes("member@example.test"));
    authState.signOut = async () => { calls++; authState.user = null; };
    await act(async () => render());
    await act(async () => document.querySelector("button").click());
    await act(async () => render());
    assert.equal(calls, 2);
    assert.equal(document.querySelector('[role="alert"]'), null);
    await act(async () => document.querySelector("button").click());
    assert(document.querySelector('[role="dialog"]'));
    authState.user = { email: "member@example.test" };
    await act(async () => render());
    assert.equal(document.querySelector('[role="dialog"]'), null);
    authState.user = null;
    await act(async () => render());
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(document.querySelector("button").getAttribute("aria-expanded"), "false");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test("OAuth 콜백은 성공·실패·취소를 처리하고 외부 리디렉션을 허용하지 않는다", async () => {
  const { NextRequest } = require("next/server");
  for (const origin of ["http://localhost:3000", "https://memoorbit-test.vercel.app"]) {
  for (const scenario of ["success", "failure", "cancel", "missing", "unconfigured", "throw"]) {
    let exchanges = 0;
    const { GET } = load("app/auth/callback/route.ts", {
      "@/lib/supabase/config": {
        getSupabaseConfig: () => scenario === "unconfigured" ? null : { url: "https://example.supabase.co", anonKey: "public-key" },
      },
      "@supabase/ssr": {
        createServerClient: (_url, _key, { cookies }) => ({ auth: {
          exchangeCodeForSession: async (code) => {
            exchanges++;
            assert.equal(code, "test-code");
            if (scenario === "throw") throw new Error("offline");
            assert.equal(cookies.getAll().find((cookie) => cookie.name === "verifier")?.value, "pkce-value");
            if (scenario === "success") cookies.setAll([
              { name: "session", value: "session-value", options: { path: "/", sameSite: "lax", secure: true } },
            ], { Pragma: "no-cache" });
            return { error: scenario === "failure" ? new Error("invalid") : null };
          },
        } }),
      },
    });
    const url = new URL(`${origin}/auth/callback?next=https://evil.example`);
    if (scenario !== "missing") url.searchParams.set("code", "test-code");
    if (scenario === "cancel") url.searchParams.set("error", "access_denied");
    const response = await GET(new NextRequest(url, { headers: { Cookie: "verifier=pkce-value" } }));
    assert.equal(response.cookies.get("session")?.value, scenario === "success" ? "session-value" : undefined);
    if (scenario === "success") {
      assert.match(response.headers.get("set-cookie"), /Secure/);
      assert.equal(response.headers.get("pragma"), "no-cache");
    }
    const destination = new URL(response.headers.get("location"));
    assert.equal(destination.origin, origin);
    assert.equal(destination.pathname, "/");
    assert.equal(destination.searchParams.has("auth_error"), scenario !== "success");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(exchanges, ["cancel", "missing", "unconfigured"].includes(scenario) ? 0 : 1);
  }
  }
});


test("SDK 생성 실패에도 매 클릭마다 연결을 시도하고 게스트 메모를 보존한다", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let clientCalls = 0;
  const mocks = {
    "@/src/lib/supabase/client": { createClient: () => { clientCalls++; throw new Error("SDK configuration error"); } },
    "@/lib/supabase/config": { getSupabaseConfig: () => null },
  };
  const provider = load("components/providers/AuthProvider.tsx", mocks);
  const { useAuth } = load("hooks/useAuth.ts", { ...mocks, "@/components/providers/AuthProvider": provider });
  let current;
  function Editor() {
    current = useAuth();
    return React.createElement("textarea", { defaultValue: "로컬 메모 보존" });
  }
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  try {
    await act(async () => root.render(React.createElement(provider.AuthProvider, null, React.createElement(Editor))));
    const editor = document.querySelector("textarea");
    const initialClientCalls = clientCalls;
    for (const action of ["signInWithGoogle", "signInWithApple"]) {
      await act(async () => assert.doesNotReject(current[action]()));
      assert.equal(current.isGuest, true);
      assert.equal(current.user, null);
      assert.equal(current.session, null);
      assert.equal(current.isConfigured, false);
      await act(async () => assert.rejects(current.signOut(), /로그아웃하지 못했습니다/));
      assert.equal(current.session, null);
      assert.equal(current.isGuest, true);
      assert.equal(document.querySelector("textarea"), editor);
      assert.equal(editor.value, "로컬 메모 보존");
    }
    assert.equal(clientCalls, initialClientCalls + 4);
    assert.equal(document.cookie, "");
    assert.equal(window.localStorage.length, 0);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test("계정 팝오버는 전체 이메일·아바타 대체·Escape·바깥 클릭·로그아웃을 처리한다", async () => {
  const dom = new JSDOM('<div id="root"></div><button id="outside">외부</button>', { url: "http://localhost:3000" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const email = `${"long.account".repeat(8)}@example.test`;
  const authState = {
    user: { email, user_metadata: { avatar_url: "https://example.test/avatar.png" } },
    signOut: async () => { authState.user = null; },
  };
  const { AuthButton } = load("src/components/AuthButton.tsx", {
    "@/hooks/useAuth": { useAuth: () => authState },
    "@/components/auth/SocialAuthModal": { SocialAuthModal: () => null },
  });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  const render = () => root.render(React.createElement(AuthButton));
  const trigger = () => document.querySelector('[aria-label="내 계정 정보"]');
  const panel = () => document.querySelector('[aria-label="계정 정보"]');
  try {
    await act(async () => render());
    assert.equal(document.querySelector("img").getAttribute("src"), authState.user.user_metadata.avatar_url);
    await act(async () => document.querySelector("img").dispatchEvent(new dom.window.Event("error")));
    assert.equal(document.querySelector("img"), null);
    assert.match(trigger().textContent, /L/);
    await act(async () => trigger().click());
    assert.equal(panel().querySelectorAll("p")[1].textContent, email);
    assert.equal(trigger().getAttribute("aria-expanded"), "true");
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape" })));
    assert.equal(panel(), null);
    assert.equal(document.activeElement, trigger());
    await act(async () => trigger().click());
    await act(async () => document.getElementById("outside").dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true })));
    assert.equal(panel(), null);
    await act(async () => trigger().click());
    await act(async () => panel().querySelector("button").click());
    await act(async () => render());
    assert.equal(panel(), null);
    assert(document.querySelector('[aria-label="클라우드 동기화 로그인"]'));
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test("공개 설정 값은 사전 검사 없이 그대로 SDK 생성 함수에 전달한다", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    for (const [url, key] of [["", ""], ["  ", "key"], ["invalid", "key"], ["https://example.supabase.co", " "]]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key;
      const expected = {};
      const client = load("src/lib/supabase/client.ts", {
        "@supabase/ssr": { createBrowserClient(actualUrl, actualKey, options) {
          assert.equal(actualUrl, url);
          assert.equal(actualKey, key);
          assert.equal(options.isSingleton, true);
          assert.equal(options.auth.flowType, "pkce");
          assert.equal(options.auth.detectSessionInUrl, false);
          return expected;
        } },
      });
      assert.equal(client.createClient(), expected);
    }
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});
