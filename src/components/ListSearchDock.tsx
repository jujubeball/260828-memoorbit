"use client";

import { useEffect, useRef, useState } from "react";
import { EditorIcon } from "@/src/components/EditorIcon";

interface SpeechResultEvent extends Event {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface SpeechRecognitionSession extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
interface SpeechWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionSession;
  webkitSpeechRecognition?: new () => SpeechRecognitionSession;
}
interface ListSearchDockProps {
  keyword: string;
  onOpenSearch: (keyword?: string) => void;
  onCreate: () => void;
}

export function ListSearchDock({ keyword, onOpenSearch, onCreate }: ListSearchDockProps): React.JSX.Element {
  const recognitionRef = useRef<SpeechRecognitionSession | null>(null);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  // 💡 [음성 입력 수명]
  // 화면을 떠나면 마이크 요청과 콜백을 정리하여 닫힌 검색창에 결과가 들어오지 않게 합니다.
  useEffect(() => () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    }
  }, []);

  // 마이크 버튼을 누른 경우에만 음성 인식을 요청하고 최종 인식 문장을 기존 검색 상태로 전달합니다.
  const toggleVoice = (): void => {
    if (listening) { recognitionRef.current?.stop(); return; }
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice("이 브라우저에서는 음성 검색을 지원하지 않습니다. 키보드의 받아쓰기를 이용해 주세요.");
      return;
    }
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      recognition.stop();
      onOpenSearch(event.results[0]?.[0]?.transcript ?? "");
    };
    recognition.onerror = () => { setListening(false); setNotice("음성을 인식하지 못했습니다. 마이크 권한을 확인해 주세요."); };
    recognition.onend = () => setListening(false);
    try {
      recognition.start();
      setListening(true);
      setNotice("");
    } catch {
      setListening(false);
      setNotice("음성 검색을 시작하지 못했습니다. 다시 시도해 주세요.");
    }
  };
  return (
    <div
      aria-label="목록 검색 및 작성"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-900/90 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md md:hidden"
    >
      {notice && (
        <p role="status" className="mb-2 text-xs text-amber-300">{notice}</p>
      )}
      <div className="flex items-center gap-3">
        <div className="flex h-11 min-w-0 flex-1 items-center rounded-full bg-slate-800 px-3">
          <EditorIcon name="search" className="h-5 w-5 shrink-0 text-slate-400" />
          <label className="min-w-0 flex-1">
            <span className="sr-only">목록 검색어</span>
            <input
              type="search"
              readOnly
              value={keyword}
              onFocus={() => onOpenSearch()}
              onClick={() => onOpenSearch()}
              placeholder="검색..."
              className="h-11 w-full min-w-0 cursor-text bg-transparent px-2 text-base text-white outline-none"
            />
          </label>
          <button type="button" onClick={toggleVoice} aria-label={listening ? "음성 검색 중지" : "음성 검색"} aria-pressed={listening} className={`flex h-11 w-11 shrink-0 items-center justify-center ${listening ? "text-red-400" : "text-slate-400"}`}>
            <EditorIcon name="mic" className="h-5 w-5" />
          </button>
        </div>
        <button type="button" onClick={onCreate} aria-label="새 메모 작성" className="flex h-11 w-11 shrink-0 items-center justify-center text-amber-400">
          <EditorIcon name="compose" />
        </button>
      </div>
    </div>
  );
}
