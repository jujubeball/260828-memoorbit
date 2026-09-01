"use client";

import {
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ImageMood, Memo } from "@/types/memo";
import { extractDynamicKeywords } from "@/src/lib/textAnalysis";

export interface MemoDraft {
  title: string;
  content: string;
  richContent: string;
  tags: string;
  imageUrl?: string;
  aiImageMood: ImageMood;
}

interface MemoModalProps {
  isOpen: boolean;
  editingMemo: Memo | null;
  onClose: () => void;
  onSubmit: (draft: MemoDraft) => void;
}

interface TableMenuPosition {
  left: number;
  top: number;
}

// 저장된 일반 문자열을 HTML로 옮길 때 태그로 오해될 수 있는 특수 문자를 안전한 문자로 바꿉니다.
const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

// 새 편집기를 열거나 기존 메모를 수정할 때 contentEditable 캔버스에 처음 표시할 HTML을 만듭니다.
const createInitialHtml = (memo: Memo | null): string => {
  if (memo?.richContent) return memo.richContent;
  if (!memo) return "";
  // 일반 본문의 각 줄을 편집 가능한 문단으로 감싼 초기 본문 HTML입니다.
  const body = memo.content
    .split("\n")
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
  return `<h1>${escapeHtml(memo.title)}</h1>${body}`;
};

// 사용자가 저장할 때 위험한 태그와 이벤트 속성을 제거해 안전한 서식 HTML만 MemoDraft에 담습니다.
const sanitizeEditorHtml = (html: string): string => {
  // 전달받은 HTML을 실제 DOM 규칙으로 검사하기 위한 임시 상자입니다.
  const container = document.createElement("div");
  container.innerHTML = html;
  container
    .querySelectorAll("script, style, iframe, object, embed")
    .forEach((element) => element.remove());
  container.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      if (attribute.name.startsWith("on"))
        element.removeAttribute(attribute.name);
    });
  });
  return container.innerHTML;
};

// 편집기 위쪽에 표시할 저장 시각을 한국어 연월일과 24시간 형식으로 변환합니다.
const formatDate = (iso?: string): string =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(iso ? new Date(iso) : new Date());

export function MemoModal({
  isOpen,
  editingMemo,
  onClose,
  onSubmit,
}: MemoModalProps): React.JSX.Element | null {
  // 💡 [편집기 DOM 참조 모음]
  // 화면에 그려진 본문, 파일 입력, 선택 범위, 표 셀을 React 코드에서 안전하게 찾아가기 위한 책갈피입니다.
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const selectedCellRef = useRef<HTMLTableCellElement | null>(null);
  // 💡 [사용자가 바꾸는 편집 상태]
  // 입력할 때마다 화면을 다시 그려야 하는 값만 State로 보관하고, 실제 서식 HTML은 편집 DOM에서 저장 순간 읽습니다.
  const [plainText, setPlainText] = useState(
    editingMemo
      ? [editingMemo.title, editingMemo.content].filter(Boolean).join("\n")
      : "",
  );
  const [imageUrl, setImageUrl] = useState(editingMemo?.imageUrl);
  const [tags, setTags] = useState(editingMemo?.tags.join(", ") ?? "");
  const [aiImageMood, setAiImageMood] = useState<ImageMood>(
    editingMemo?.aiImageMood ?? "수채화",
  );
  const [analyzedText, setAnalyzedText] = useState(plainText);
  const [isAnalyzingTags, setIsAnalyzingTags] = useState(false);
  const [isFormatOpen, setIsFormatOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [tableMenuPosition, setTableMenuPosition] =
    useState<TableMenuPosition | null>(null);

  // 💡 [메모 편집기 바디 스크롤 잠금]
  // 편집기가 열리면 뒤쪽 메모 목록이 손가락이나 휠에 따라 움직이지 않게 막고, 편집기를 닫을 때 기존 스크롤 설정을 되돌립니다.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow || "unset";
    };
  }, [isOpen]);

  // 💡 [200ms 실시간 분석]
  // 매 글자마다 무거운 계산을 반복하지 않고, 사용자가 잠깐 입력을 멈춘 뒤 최신 본문만 분석합니다.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAnalyzedText(plainText);
      setIsAnalyzingTags(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [plainText]);

  // 💡 [추천 태그 메모이제이션]
  // 200ms 분석이 끝난 본문이 바뀔 때만 핵심어를 다시 추출해 추천 태그 버튼으로 그립니다.
  const recommendedTags = useMemo(
    () => extractDynamicKeywords(analyzedText),
    [analyzedText],
  );
  // 사용자가 쉼표로 입력한 태그 문자열을 선택 여부 비교에 쓰기 쉬운 배열로 바꿉니다.
  const selectedTags = useMemo(
    () =>
      tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tags],
  );

  if (!isOpen) return null;

  // 사용자가 본문을 드래그하면 현재 선택 범위를 복사해 서식 버튼을 누른 뒤에도 잃지 않게 합니다.
  const rememberSelection = (): void => {
    const selection = window.getSelection();
    if (
      !selection?.rangeCount ||
      !editorRef.current?.contains(selection.anchorNode)
    )
      return;
    savedRange.current = selection.getRangeAt(0).cloneRange();
  };
  // 저장해 둔 선택 범위를 본문에 다시 올리고 적용 가능한 Range를 서식 함수에 돌려줍니다.
  const restoreSelection = (): Range | null => {
    const selection = window.getSelection();
    const range = savedRange.current;
    if (
      !selection ||
      !range ||
      !editorRef.current?.contains(range.commonAncestorContainer)
    )
      return null;
    selection.removeAllRanges();
    selection.addRange(range);
    return range;
  };
  // 체크리스트나 표처럼 DOM이 직접 바뀐 뒤 현재 글자를 plainText State와 다시 맞춥니다.
  const syncText = (): void => setPlainText(editorRef.current?.innerText ?? "");

  // 선택 범위가 있을 때만 브라우저 서식 명령을 실행하고 최신 글자 상태를 저장합니다.
  const applyFormat = (command: string, value?: string): void => {
    const range = restoreSelection();
    if (!range || range.collapsed) return;
    document.execCommand(command, false, value);
    rememberSelection();
    syncText();
  };
  // 마지막 커서 위치에 체크리스트·표·목록 HTML을 삽입하고 캔버스 내용을 State에 반영합니다.
  const insertAtCaret = (html: string): void => {
    editorRef.current?.focus({ preventScroll: true });
    restoreSelection();
    document.execCommand("insertHTML", false, html);
    syncText();
  };
  // 서식 버튼을 누르는 포인터 이벤트가 본문의 드래그 선택을 빼앗지 못하게 기본 포커스 이동을 막습니다.
  const keepSelection = (
    event:
      | ReactMouseEvent<HTMLButtonElement>
      | ReactPointerEvent<HTMLButtonElement>,
  ): void => event.preventDefault();
  // 💡 [체크리스트 삽입]
  // 체크 원과 글자 영역을 나눠 만든 뒤 커서를 새 항목의 글자 시작 위치로 옮깁니다.
  const insertChecklist = (): void => {
    insertAtCaret(
      '<div class="memo-check-item" data-new-check="true"><input type="checkbox" contenteditable="false" aria-label="체크리스트 완료"><span class="memo-check-text"><br></span></div><div><br></div>',
    );
    const item = editorRef.current?.querySelector<HTMLElement>(
      '[data-new-check="true"]',
    );
    const text = item?.querySelector<HTMLElement>(".memo-check-text");
    item?.removeAttribute("data-new-check");
    if (!text) return;
    const range = document.createRange();
    range.selectNodeContents(text);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    savedRange.current = range.cloneRange();
  };
  // 사용자가 표 버튼을 누르면 더미 글자가 없는 빈 2×2 표를 현재 커서 위치에 넣습니다.
  const insertTable = (): void =>
    insertAtCaret(
      "<table><tbody><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr></tbody></table><div><br></div>",
    );

  // 완료 버튼으로 폼이 제출되면 브라우저 새로고침을 막고 공통 저장 함수로 연결합니다.
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    saveCurrentMemo();
  };
  // 💡 [이탈 자동 저장]
  // 본문에 한 글자라도 있으면 현재 DOM의 제목·본문·서식을 MemoDraft로 묶어 page.tsx의 공통 저장 함수로 전달합니다.
  const saveCurrentMemo = (): boolean => {
    const editor = editorRef.current;
    if (!editor?.innerText.trim()) return false;
    const [title, ...body] = editor.innerText.split("\n");
    onSubmit({
      title: title.trim(),
      content: body.join("\n").trim(),
      richContent: sanitizeEditorHtml(editor.innerHTML),
      tags,
      imageUrl,
      aiImageMood,
    });
    return true;
  };
  // 뒤로가기나 딤드를 누르면 내용이 있으면 먼저 자동 저장하고, 빈 메모라면 저장 없이 닫습니다.
  const closeEditor = (): void => {
    if (saveCurrentMemo()) return;
    onClose();
  };
  // 사용자가 고른 이미지 파일을 브라우저에서 미리 볼 수 있는 데이터 주소로 읽어 imageUrl State에 저장합니다.
  const attachImage = (file: File | undefined): void => {
    if (!file?.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") setImageUrl(reader.result);
    });
    reader.readAsDataURL(file);
  };
  // 추천 태그를 누르면 기존 쉼표 문자열을 배열로 바꿔 추가·삭제한 뒤 다시 입력창 형식으로 합칩니다.
  const toggleTag = (tag: string): void => {
    const nextTags = selectedTags.includes(tag)
      ? selectedTags.filter((item) => item !== tag)
      : [...selectedTags, tag];
    setTags(nextTags.join(", "));
  };
  // 표 셀을 누르면 선택 표시를 옮기고 셀 작업 메뉴가 나타날 화면 좌표를 계산합니다.
  const selectTableCell = (cell: HTMLTableCellElement): void => {
    selectedCellRef.current?.removeAttribute("data-selected");
    cell.setAttribute("data-selected", "true");
    selectedCellRef.current = cell;
    const rect = cell.getBoundingClientRect();
    setTableMenuPosition({
      left: Math.min(window.innerWidth - 244, Math.max(8, rect.left)),
      top: Math.min(window.innerHeight - 310, rect.bottom + 8),
    });
  };
  // 본문 클릭 대상이 체크박스인지 표 셀인지 판별해 각각 완료 State 또는 표 메뉴로 연결합니다.
  const handleEditorClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      if (target.checked) target.setAttribute("checked", "");
      else target.removeAttribute("checked");
      syncText();
      return;
    }
    const cell = target instanceof Element ? target.closest("td") : null;
    if (cell instanceof HTMLTableCellElement) selectTableCell(cell);
    else {
      selectedCellRef.current?.removeAttribute("data-selected");
      selectedCellRef.current = null;
      setTableMenuPosition(null);
    }
  };
  // 💡 [표 구조 변경]
  // 사용자가 마지막으로 선택한 셀을 기준으로 행 또는 열을 추가·삭제하고 편집 본문을 다시 동기화합니다.
  const mutateTable = (
    action: "addRow" | "deleteRow" | "addColumn" | "deleteColumn",
  ): void => {
    const selectedCell = selectedCellRef.current;
    if (!selectedCell) return;
    const row = selectedCell.parentElement;
    const table = selectedCell.closest("table");
    if (
      !(row instanceof HTMLTableRowElement) ||
      !(table instanceof HTMLTableElement)
    )
      return;
    if (action === "addRow") {
      const nextRow = row.cloneNode(true) as HTMLTableRowElement;
      [...nextRow.cells].forEach((cell) => {
        cell.innerHTML = "<br>";
        cell.removeAttribute("data-selected");
      });
      row.after(nextRow);
    }
    if (action === "deleteRow" && table.rows.length > 1) row.remove();
    if (action === "addColumn") {
      const index = selectedCell.cellIndex;
      [...table.rows].forEach((tableRow) => {
        const cell = tableRow.insertCell(index + 1);
        cell.innerHTML = "<br>";
      });
    }
    if (action === "deleteColumn" && row.cells.length > 1) {
      const index = selectedCell.cellIndex;
      [...table.rows].forEach((tableRow) => tableRow.deleteCell(index));
    }
    selectedCellRef.current = null;
    setTableMenuPosition(null);
    syncText();
  };
  // 선택한 표 셀 글자를 클립보드에 복사하고, 오려두기라면 원래 셀을 빈칸으로 만듭니다.
  const copyCell = async (cut: boolean): Promise<void> => {
    const selectedCell = selectedCellRef.current;
    if (!selectedCell) return;
    await navigator.clipboard.writeText(selectedCell.innerText);
    if (cut) selectedCell.innerHTML = "<br>";
    syncText();
  };
  // 클립보드의 글자를 마지막으로 선택한 표 셀에 붙여 넣고 본문 State를 동기화합니다.
  const pasteCell = async (): Promise<void> => {
    const selectedCell = selectedCellRef.current;
    if (!selectedCell) return;
    selectedCell.innerText = await navigator.clipboard.readText();
    syncText();
  };
  // 서식 패널을 닫을 때 내부 포커스와 하위 색상 팔레트도 함께 정리합니다.
  const closeFormatLayer = (): void => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    setIsFormatOpen(false);
    setIsPaletteOpen(false);
  };
  // 사용자가 하단의 가가 버튼을 누를 때 서식 패널을 현재 상태의 반대로 전환합니다.
  const toggleFormatLayer = (): void => {
    if (isFormatOpen) {
      closeFormatLayer();
      return;
    }
    setIsFormatOpen(true);
  };
  // 여러 서식 버튼이 동일한 터치 크기와 글자 모양을 공유하도록 모은 Tailwind 클래스입니다.
  const formatButton =
    "ios-tap flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-[15px] font-semibold text-white";

  // 편집기 맨 아래의 네 가지 빠른 실행 버튼이 같은 너비와 색상을 사용하도록 모은 클래스입니다.
  const bottomButton =
    "ios-tap flex h-11 min-w-11 flex-1 items-center justify-center text-[#e5a93c]";

  return (
    <div
      className="fixed inset-0 z-50 box-border flex h-dvh w-full max-w-full flex-col overflow-x-hidden overflow-y-hidden bg-black text-white xl:items-center xl:justify-center xl:bg-black/70 xl:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="memo-modal-title"
      onClick={closeEditor}
    >
      <form
        id="memo-form"
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className="box-border flex min-h-0 w-full max-w-full flex-1 flex-col overflow-x-hidden xl:mx-auto xl:h-[75vh] xl:max-h-[80vh] xl:max-w-2xl xl:flex-none xl:overflow-hidden xl:rounded-3xl xl:border xl:border-[#2a2e3d] xl:bg-[#0f1117] xl:shadow-2xl"
      >
        <header className="box-border flex w-full max-w-full shrink-0 items-center justify-between overflow-x-hidden px-4 pb-2 pt-3">
          <button
            type="button"
            onClick={closeEditor}
            className="ios-tap flex h-11 items-center gap-1 px-1 text-[17px] text-[#e5a93c]"
            aria-label="메모를 자동 저장하고 목록으로 돌아가기"
          >
            <span className="text-3xl font-light" aria-hidden="true">
              ‹
            </span>
            <span className="hidden sm:inline">메모</span>
          </button>
          <h2 id="memo-modal-title" className="sr-only">
            {editingMemo ? "메모 수정" : "새 메모"}
          </h2>
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => document.execCommand("undo")}
              className="ios-tap h-11 w-10 text-xl text-[#e5a93c]"
              aria-label="실행 취소"
            >
              ↶
            </button>
            <button
              type="button"
              className="ios-tap h-11 w-10 text-xl text-[#e5a93c]"
              aria-label="공유"
            >
              ⇧
            </button>
            <button
              type="button"
              className="ios-tap h-11 w-10 text-xl font-bold text-[#e5a93c]"
              aria-label="더 보기"
            >
              •••
            </button>
            <button
              type="submit"
              disabled={!plainText.trim()}
              className="ios-tap ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#e5a93c] text-lg font-bold text-black disabled:opacity-40"
              aria-label="완료"
            >
              ✓
            </button>
          </div>
        </header>

        <div className="box-border min-h-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 pb-6">
          <p className="pb-4 text-center text-xs text-[#8e8e93]">
            {formatDate(editingMemo?.updatedAt)}
          </p>
          {imageUrl && (
            <figure className="relative mb-4 overflow-hidden rounded-xl bg-[#1c1c1e]">
              {/* 로컬 파일 미리보기는 운영 저장소 URL로 교체될 예정이다. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="첨부한 메모 이미지 미리보기"
                className="max-h-72 w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setImageUrl(undefined)}
                className="absolute right-2 top-2 rounded-full bg-black/75 px-3 py-1.5 text-xs"
              >
                사진 제거
              </button>
            </figure>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="메모 내용"
            aria-multiline="true"
            onClick={handleEditorClick}
            onContextMenu={(event) => {
              const cell =
                event.target instanceof Element
                  ? event.target.closest("td")
                  : null;
              if (!(cell instanceof HTMLTableCellElement)) return;
              event.preventDefault();
              selectTableCell(cell);
            }}
            onInput={(event) => {
              setPlainText(event.currentTarget.innerText);
              setIsAnalyzingTags(true);
            }}
            onSelect={rememberSelection}
            onKeyUp={rememberSelection}
            className="rich-editor box-border min-h-[60%] w-full max-w-full select-text overflow-x-hidden break-words text-[17px] leading-7 text-white outline-none"
            data-placeholder="메모를 입력하세요"
            dangerouslySetInnerHTML={{ __html: createInitialHtml(editingMemo) }}
          />
          <section
            className={`box-border mt-8 w-full max-w-full overflow-x-hidden border-t border-[#38383a] pt-4 transition-colors duration-200 ${isAnalyzingTags ? "border-[#e5a93c]/70 bg-[#e5a93c]/5" : ""}`}
            aria-labelledby="recommended-tags-title"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3
                id="recommended-tags-title"
                className="text-sm font-semibold text-[#e5a93c]"
              >
                AI 추천 태그
              </h3>
              <span
                className={`text-xs text-[#8e8e93] ${isAnalyzingTags ? "animate-pulse text-[#ffc86b] motion-reduce:animate-none" : ""}`}
              >
                {isAnalyzingTags
                  ? "키워드를 분석하고 있습니다…"
                  : "선택하지 않아도 저장할 수 있습니다"}
              </span>
            </div>
            <div
              id="recommended-tags-options"
              className="grid w-full max-w-full gap-4 overflow-x-hidden pb-2 pt-4"
            >
              <div className="flex min-h-8 flex-wrap gap-2">
                {recommendedTags.length > 0 ? (
                  recommendedTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        aria-pressed={isSelected}
                        className={`ios-tap animate-[fade-in_180ms_ease-out] rounded-full border px-3 py-2 text-xs font-semibold motion-reduce:animate-none ${isSelected ? "border-[#e5a93c] bg-[#e5a93c] text-black" : "border-[#636366] text-white"}`}
                      >
                        #{tag}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-[#636366]">
                    본문을 입력하면 관련 태그가 표시됩니다.
                  </p>
                )}
              </div>
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className="w-full rounded-xl border border-[#48484a] bg-[#1c1c1e] px-4 py-2 text-sm text-white outline-none focus:border-[#e5a93c]"
                placeholder="태그 직접 추가: 쉼표로 구분"
                aria-label="태그 직접 추가"
              />
              <div className="w-full max-w-full overflow-x-hidden">
                <p className="mb-2 text-xs font-semibold text-[#8e8e93]">
                  AI 이미지 무드
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["수채화", "네온", "흑백", "빈티지"] as ImageMood[]).map(
                    (mood) => (
                      <button
                        key={mood}
                        type="button"
                        onClick={() => setAiImageMood(mood)}
                        aria-pressed={aiImageMood === mood}
                        className={`ios-tap rounded-full border px-4 py-2 text-xs font-semibold ${aiImageMood === mood ? "border-[#e5a93c] bg-[#e5a93c] text-black" : "border-[#636366] text-white"}`}
                      >
                        {mood}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="box-border w-full max-w-full shrink-0 overflow-x-hidden border-t border-[#38383a] bg-[#1c1c1e]/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-xl flex-wrap items-center justify-around gap-2 px-2 py-1">
            <button
              type="button"
              onPointerDown={keepSelection}
              onClick={toggleFormatLayer}
              className={bottomButton}
              aria-expanded={isFormatOpen}
              aria-label="텍스트 서식"
            >
              <span className="text-base font-semibold" aria-hidden="true">
                가가
              </span>
            </button>
            <button
              type="button"
              onPointerDown={keepSelection}
              onClick={insertChecklist}
              className={bottomButton}
              aria-label="체크리스트"
            >
              <span className="text-2xl" aria-hidden="true">
                ✓⃝
              </span>
            </button>
            <button
              type="button"
              onPointerDown={keepSelection}
              onClick={insertTable}
              className={bottomButton}
              aria-label="표"
            >
              <span className="text-xl" aria-hidden="true">
                ▦
              </span>
            </button>
            <button
              type="button"
              onPointerDown={keepSelection}
              onClick={() => imageInputRef.current?.click()}
              className={bottomButton}
              aria-label="사진 또는 파일 첨부"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                <path
                  d="M8.4 12.7 14.8 6.3a3.1 3.1 0 0 1 4.4 4.4l-8.1 8.1a5 5 0 0 1-7.1-7.1l8-8"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => attachImage(event.target.files?.[0])}
              className="hidden"
            />
          </div>
        </div>
      </form>

      <section
        className={`absolute inset-x-0 bottom-0 z-40 box-border w-full max-w-full overflow-x-hidden rounded-t-3xl bg-[#2c2c2e] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_35px_rgb(0_0_0/0.45)] transition-transform duration-300 ${isFormatOpen ? "translate-y-0" : "translate-y-full"}`}
        aria-label="서식 도구"
        aria-hidden={!isFormatOpen}
        inert={!isFormatOpen}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto w-full max-w-xl overflow-x-hidden">
          <div className="mb-2 flex items-center justify-between">
            <span className="h-1 w-9 rounded-full bg-[#636366]" />
            <button
              type="button"
              onClick={closeFormatLayer}
              className="ios-tap h-9 w-9 rounded-full bg-[#48484a] text-lg"
              aria-label="서식 도구 닫기"
            >
              ×
            </button>
          </div>
          <div
            className="grid grid-cols-5 rounded-xl bg-[#3a3a3c] p-1"
            aria-label="문단 스타일"
          >
            {[
              ["제목", "h1"],
              ["머리말", "h2"],
              ["부머리말", "h3"],
              ["본문", "p"],
              ["모노", "pre"],
            ].map(([label, value]) => (
              <button
                key={value}
                type="button"
                onPointerDown={keepSelection}
                onClick={() => applyFormat("formatBlock", value)}
                className={formatButton}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="mt-2 flex items-center justify-between rounded-xl bg-[#3a3a3c] p-1"
            aria-label="글자 서식"
          >
            {[
              ["B", "bold", "굵게"],
              ["I", "italic", "기울임"],
              ["U", "underline", "밑줄"],
              ["S", "strikeThrough", "취소선"],
            ].map(([label, command, ariaLabel]) => (
              <button
                key={command}
                type="button"
                onPointerDown={keepSelection}
                onClick={() => applyFormat(command)}
                className={formatButton}
                aria-label={ariaLabel}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onPointerDown={keepSelection}
              onClick={() => setIsPaletteOpen((current) => !current)}
              className={formatButton}
              aria-expanded={isPaletteOpen}
              aria-label="글자 색상"
            >
              ✎
            </button>
          </div>
          {isPaletteOpen && (
            <div className="mt-2 flex justify-center gap-4 rounded-xl bg-[#3a3a3c] p-3">
              {["#ffffff", "#e5a93c", "#ff453a", "#0a84ff", "#30d158"].map(
                (color) => (
                  <button
                    key={color}
                    type="button"
                    onPointerDown={keepSelection}
                    onClick={() => applyFormat("foreColor", color)}
                    className="format-color-button h-7 w-7 rounded-full border-2 border-white/50"
                    data-color={color}
                    aria-label={`${color} 글자 색상`}
                  />
                ),
              )}
            </div>
          )}
          <div
            className="mt-2 grid grid-cols-6 rounded-xl bg-[#3a3a3c] p-1"
            aria-label="목록과 들여쓰기"
          >
            <button
              type="button"
              onPointerDown={keepSelection}
              onClick={() => applyFormat("insertUnorderedList")}
              className={formatButton}
              aria-label="순서 없는 목록"
            >
              • ≡
            </button>
            <button
              type="button"
              onPointerDown={keepSelection}
              onClick={() =>
                insertAtCaret('<ul class="dashed-list"><li><br></li></ul>')
              }
              className={formatButton}
              aria-label="대시 목록"
            >
              – ≡
            </button>
            <button
              type="button"
              onPointerDown={keepSelection}
              onClick={() => applyFormat("insertOrderedList")}
              className={formatButton}
              aria-label="숫자 목록"
            >
              1. ≡
            </button>
            <button
              type="button"
              onPointerDown={keepSelection}
              onClick={() => applyFormat("outdent")}
              className={formatButton}
              aria-label="내어쓰기"
            >
              ⇤
            </button>
            <button
              type="button"
              onPointerDown={keepSelection}
              onClick={() => applyFormat("indent")}
              className={formatButton}
              aria-label="들여쓰기"
            >
              ⇥
            </button>
            <button
              type="button"
              onPointerDown={keepSelection}
              onClick={insertTable}
              className={formatButton}
              aria-label="표"
            >
              ▦
            </button>
          </div>
        </div>
      </section>

      {tableMenuPosition && (
        <div
          className="fixed z-40 w-60 overflow-hidden rounded-xl border border-[#2a2e3d] bg-[#2c2c2e]/95 py-1 text-sm text-white shadow-2xl backdrop-blur-md"
          style={{ left: tableMenuPosition.left, top: tableMenuPosition.top }}
          role="menu"
          aria-label="표 셀 메뉴"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="grid grid-cols-2">
            <button
              type="button"
              onClick={() => mutateTable("addRow")}
              className="table-menu-item"
              role="menuitem"
            >
              아래 행 추가
            </button>
            <button
              type="button"
              onClick={() => mutateTable("deleteRow")}
              className="table-menu-item text-[#ff6961]"
              role="menuitem"
            >
              행 삭제
            </button>
            <button
              type="button"
              onClick={() => mutateTable("addColumn")}
              className="table-menu-item"
              role="menuitem"
            >
              오른쪽 열 추가
            </button>
            <button
              type="button"
              onClick={() => mutateTable("deleteColumn")}
              className="table-menu-item text-[#ff6961]"
              role="menuitem"
            >
              열 삭제
            </button>
          </div>
          <div className="grid grid-cols-3 border-t border-[#545458]">
            <button
              type="button"
              onClick={() => void copyCell(false)}
              className="table-menu-item"
              role="menuitem"
            >
              복사
            </button>
            <button
              type="button"
              onClick={() => void copyCell(true)}
              className="table-menu-item"
              role="menuitem"
            >
              오려두기
            </button>
            <button
              type="button"
              onClick={() => void pasteCell()}
              className="table-menu-item"
              role="menuitem"
            >
              붙여넣기
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              selectedCellRef.current?.toggleAttribute("data-highlight");
              setTableMenuPosition(null);
            }}
            className="table-menu-item w-full border-t border-[#545458] text-left"
            role="menuitem"
          >
            셀 포맷 강조 전환
          </button>
        </div>
      )}
    </div>
  );
}
