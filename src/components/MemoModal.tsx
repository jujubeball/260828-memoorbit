"use client";

import {
  type CSSProperties,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { enterEditorChecklist, insertEditorChecklist } from "@/src/lib/editorChecklist";
import { IOSFormatSheet } from "@/src/components/iOSFormatSheet";
import { useVisualViewport } from "@/src/hooks/useVisualViewport";
import { useKeyboardFormatSheet } from "@/src/hooks/useKeyboardFormatSheet";
import { formatEditorList } from "@/src/lib/editorLists";
import { CARET_PLACEHOLDER, EMPTY_EDITOR_FORMAT, formatEditorRange, readEditorRange, readEditorFormat, restoreEditorRange } from "@/src/lib/editorSelection";
import type { Memo } from "@/types/memo";
import { requestRecommendedTags } from "@/src/lib/geminiClient";
import { extractDynamicKeywords } from "@/src/lib/textAnalysis";
import { usePageScrollLock } from "@/src/hooks/usePageScrollLock";
import {
  selectRepresentativeImage,
  type AttachedImage,
} from "@/src/utils/selectRepresentativeImage";

// 편집기가 부모 Home에 전달하는 저장 요청입니다. id·작성일·수정일·동기화 상태는 부모가 Memo로 조립할 때 붙입니다.
export interface MemoDraft {
  title: string;
  content: string;
  richContent: string;
  tags: string;
  imageUrl?: string;
  images: AttachedImage[];
}

// Home이 열림·저장 진행 상태와 편집 대상을 내려주고, 이 모달은 onSubmit 또는 onClose로 사용자 의도를 올려보냅니다.
interface MemoModalProps {
  isSaving?: boolean;
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
// richContent가 있으면 그대로 복원하고, 없으면 일반 제목과 본문을 HTML로 변환합니다. 이 함수 자체는 DOM에 쓰지 않습니다.
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

// 저장 직전 일부 실행 가능한 태그와 on으로 시작하는 이벤트 속성을 제거합니다.
// URL·모든 속성을 검사하는 완전한 정화기는 아니므로 외부 HTML 수용 범위를 넓힐 때 별도 검토가 필요한 경계입니다.
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
// 기존 메모는 updatedAt을 받고 새 메모는 호출 시각을 표시합니다. 표시용 문자열이며 저장 날짜를 변경하지 않습니다.
const formatDate = (iso?: string): string =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(iso ? new Date(iso) : new Date());

// 💡 [작성·편집의 공통 입구]
// 새 메모는 editingMemo가 null, 수정은 기존 Memo입니다. Home이 조건부로 마운트하여 한 번 열린 편집기의 초기값을 고정합니다.
// 본문 HTML은 editorRef의 DOM, 화면에 표시할 텍스트·태그·패널은 State가 담당하고 저장 시 두 내용을 MemoDraft로 합칩니다.
export function MemoModal({
  isSaving = false,
  isOpen,
  editingMemo,
  onClose,
  onSubmit,
}: MemoModalProps): React.JSX.Element | null {
  // 💡 [편집기 DOM 참조 모음]
  // 화면에 그려진 본문, 파일 입력, 선택 범위, 표 셀을 React 코드에서 안전하게 찾아가기 위한 책갈피입니다.
  const editorRef = useRef<HTMLDivElement>(null);
  // 숨겨진 파일 선택창은 첨부 버튼에서 click하고, 태그 입력창은 패널이 그려진 다음 프레임에 focus합니다.
  const imageInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  // Range는 글자의 시작·끝 위치를 가리킵니다. 버튼으로 포커스가 옮겨가도 원래 선택을 복원할 책갈피입니다.
  const savedRange = useRef<Range | null>(null);
  // 셀 메뉴 명령은 이 DOM 셀에 적용됩니다. 메뉴 좌표는 아래 tableMenuPosition State로 별도 관리합니다.
  const selectedCellRef = useRef<HTMLTableCellElement | null>(null);
  // 💡 [초기 본문 한 번만 주입]
  // 태그·키보드 상태가 바뀌어도 React가 사용자가 편집한 DOM과 선택 범위를 다시 만들지 않게 합니다.
  const [initialHtml] = useState(() => createInitialHtml(editingMemo));
  // 💡 [안정적인 초기 마운트 콜백]
  // initialHtml이 같으면 같은 함수 참조를 유지하여 태그·서식 State 변경 때 본문 HTML을 다시 주입하지 않습니다.
  const mountEditor = useCallback((element: HTMLDivElement | null): void => {
    editorRef.current = element;
    if (element) element.innerHTML = initialHtml;
  }, [initialHtml]);
  // 💡 [사용자가 바꾸는 편집 상태]
  // 입력할 때마다 화면을 다시 그려야 하는 값만 State로 보관하고, 실제 서식 HTML은 편집 DOM에서 저장 순간 읽습니다.
  // plainText는 onInput·syncText가 갱신하며 저장 버튼 활성화, 제목 상태 문구, 태그 추천 이펙트의 입력으로 이어집니다.
  const [plainText, setPlainText] = useState(
    editingMemo
      ? [editingMemo.title, editingMemo.content].filter(Boolean).join("\n")
      : "",
  );
  // 첨부 파일을 읽은 URL·이름 목록입니다. 제거 버튼도 새 배열로 갱신하며 대표 이미지 계산과 프리뷰가 이 값을 함께 사용합니다.
  const [images, setImages] = useState<AttachedImage[]>(
    editingMemo?.images
      ?? (editingMemo?.imageUrl
        ? [{ url: editingMemo.imageUrl, name: "기존 첨부 이미지" }]
        : []),
  );
  // 입력창은 쉼표 문자열을 사용합니다. 선택 칩 비교에는 selectedTags 배열을 만들고 최종 태그 배열 변환은 Home이 맡습니다.
  const [tags, setTags] = useState(editingMemo?.tags.join(", ") ?? "");
  // 추천은 확정 태그와 분리합니다. 처음에는 로컬 분석값, 이후에는 서버 응답 또는 실패 시 로컬 분석값을 표시합니다.
  const [recommendedTags, setRecommendedTags] = useState(() => extractDynamicKeywords(plainText));
  // 최근 분석이 서버 실패 후 로컬 대체인지 기록하여 추천 목록의 안내 문구를 바꿉니다.
  const [isUsingLocalAnalysis, setIsUsingLocalAnalysis] = useState(false);
  // 입력·요청 시작 때 켜고 완료 때 꺼서 분석 중 문구와 강조를 표시합니다. 네트워크 요청을 취소하는 값은 아닙니다.
  const [isAnalyzingTags, setIsAnalyzingTags] = useState(false);
  // 태그 버튼이 토글하며 패널 렌더링과 입력창 포커스 이펙트를 제어합니다. 본문 복귀·서식 열기에서는 닫습니다.
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  // 별도 훅이 editor → waiting → format 전환을 관리합니다. waiting 동안도 본문을 읽기 상태로 두어 키보드 재진입을 막습니다.
  const formatSheet = useKeyboardFormatSheet(isOpen);
  const isFormatOpen = formatSheet.mode === "format";
  // 선택 위치의 굵게·크기 등을 담아 IOSFormatSheet의 황금색 선택 표시와 aria-pressed로 전달합니다.
  const [activeFormat, setActiveFormat] = useState(EMPTY_EDITOR_FORMAT);
  // 선택 위치의 서식이 달라진 경우에만 버튼 상태를 갱신해 드래그 중 불필요한 렌더링을 줄입니다.
  const updateFormatState = useCallback((range: Range | null): void => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = readEditorFormat(editor, range);
    setActiveFormat((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
  }, []);
  // 보이는 높이가 CSS 변수로 이어져 내부 편집 래퍼의 크기를 정합니다. 바깥 불투명 배경은 계속 전체 화면을 덮습니다.
  const viewport = useVisualViewport(isOpen);
  // null이면 셀 메뉴를 숨기고 좌표가 있으면 해당 위치에 표시합니다. 실제 작업 대상은 selectedCellRef에 있습니다.
  const [tableMenuPosition, setTableMenuPosition] =
    useState<TableMenuPosition | null>(null);

  usePageScrollLock(isOpen);

  // 💡 [모바일 선택 핸들 추적]
  // 손가락으로 선택 경계를 바꾸는 동안 Range를 복사하고, 태그 입력창의 선택은 본문 선택을 덮어쓰지 않습니다.
  // isOpen·서식 모드가 바뀌면 구독을 교체하고 해제 시 같은 함수를 제거합니다. 읽기 모드에서는 보관한 선택을 유지합니다.
  useEffect(() => {
    if (!isOpen) return;
    // 문서 전체 선택 이벤트 중 현재 편집기 안의 선택만 받아 savedRange와 서식 버튼 상태를 함께 갱신합니다.
    const trackSelection = (): void => {
      const editor = editorRef.current;
      if (!editor || formatSheet.mode !== "editor" || !editor.contains(document.activeElement)) return;
      const range = readEditorRange(editor);
      if (range) {
        savedRange.current = range;
        updateFormatState(range);
      }
    };
    document.addEventListener("selectionchange", trackSelection);
    return () => document.removeEventListener("selectionchange", trackSelection);
  }, [isOpen, updateFormatState, formatSheet.mode]);

  // 💡 [모바일 키보드의 문단 삽입]
  // keydown 없이 전달되는 모바일 Enter도 처리하며 한글 조합 확정은 브라우저에 맡깁니다.
  // 열림·저장 상태가 바뀔 때 리스너를 다시 구성하고 이전 리스너를 제거해 한 번의 Enter가 두 번 처리되지 않게 합니다.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !isOpen || isSaving) return;
    // 취소 가능한 문단 삽입만 처리합니다. 체크리스트 유틸리티가 새 Range를 반환한 경우에만 기본 Enter를 막습니다.
    const beforeInput = (event: InputEvent): void => {
      if (event.inputType !== "insertParagraph" || event.isComposing || !event.cancelable) return;
      const range = readEditorRange(editor);
      if (!range) return;
      const next = enterEditorChecklist(editor, range);
      if (!next) return;
      event.preventDefault();
      savedRange.current = next;
      updateFormatState(next);
      setPlainText(editor.innerText.replaceAll(CARET_PLACEHOLDER, ""));
    };
    editor.addEventListener("beforeinput", beforeInput);
    return () => editor.removeEventListener("beforeinput", beforeInput);
  }, [isOpen, isSaving, updateFormatState]);

  // 태그 입력 도구를 열면 새로 나타난 입력창으로 포커스를 옮겨 모바일 키보드가 자연스럽게 이어지게 합니다.
  // 💡 [태그 패널 렌더링 다음 프레임]
  // isTagsOpen 변경 직후에는 입력 DOM이 준비되는 시점이므로 한 프레임 기다립니다. 다시 닫히면 대기 프레임도 취소합니다.
  useEffect(() => {
    if (!isTagsOpen) return;
    const frameId = window.requestAnimationFrame(() => {
      tagInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isTagsOpen]);

  // 💡 [300ms Gemini 실시간 분석]
  // 사용자가 입력을 잠깐 멈추면 서버 Route에 최신 본문을 보내고, 실패할 때만 브라우저의 로컬 핵심어 분석기를 사용합니다.
  // plainText가 바뀔 때 이전 300ms 예약과 요청을 취소합니다. 빈 본문이면 추천을 비우고, 취소된 실패에는 로컬 추천을 덮어쓰지 않습니다.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const text = plainText.trim();
      if (!text) {
        setRecommendedTags([]);
        setIsUsingLocalAnalysis(false);
        setIsAnalyzingTags(false);
        return;
      }

      setIsAnalyzingTags(true);
      try {
        const nextTags = await requestRecommendedTags(text, controller.signal);
        setRecommendedTags(nextTags);
        setIsUsingLocalAnalysis(false);
      } catch {
        if (controller.signal.aborted) return;
        setRecommendedTags(extractDynamicKeywords(text));
        setIsUsingLocalAnalysis(true);
      } finally {
        if (!controller.signal.aborted) setIsAnalyzingTags(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [plainText]);
  // 사용자가 쉼표로 입력한 태그 문자열을 선택 여부 비교에 쓰기 쉬운 배열로 바꿉니다.
  // 💡 [선택 태그 계산 재사용]
  // tags가 바뀔 때만 분리·공백 제거·빈 항목 제거를 다시 하며 원본 문자열은 직접 바꾸지 않습니다.
  const selectedTags = useMemo(
    () =>
      tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tags],
  );
  // 본문이나 태그, 첨부 목록이 바뀔 때마다 같은 점수 함수를 다시 실행해 화면 미리보기의 대표 사진도 즉시 갱신합니다.
  // 💡 [대표 이미지 계산 재사용]
  // 관련 입력 세 가지가 같으면 이전 URL을 재사용합니다. 대표 URL과 전체 images 배열은 저장 요청에도 함께 들어갑니다.
  const imageUrl = useMemo(
    () => selectRepresentativeImage(plainText, selectedTags, images),
    [images, plainText, selectedTags],
  );

  if (!isOpen) return null;

  // 사용자가 본문을 드래그하면 현재 선택 범위를 복사해 서식 버튼을 누른 뒤에도 잃지 않게 합니다.
  // 포인터 누름·선택·키 입력에서 호출하며 편집 모드에서만 savedRange와 activeFormat을 갱신합니다.
  const rememberSelection = (): void => {
    if (!editorRef.current || formatSheet.mode !== "editor") return;
    const range = readEditorRange(editorRef.current);
    if (range) {
      savedRange.current = range;
      updateFormatState(range);
    }
  };
  // 저장해 둔 선택 범위를 본문에 다시 올리고 적용 가능한 Range를 서식 함수에 돌려줍니다.
  // 서식 시트에서는 focus=false가 되어 선택만 복원합니다. 편집 도구가 true를 전달하면 키보드 입력도 재개합니다.
  const restoreSelection = (focus = formatSheet.mode === "editor"): Range | null => editorRef.current
    ? restoreEditorRange(editorRef.current, savedRange.current, focus)
    : null;
  // 체크리스트나 표처럼 DOM이 직접 바뀐 뒤 현재 글자를 plainText State와 다시 맞춥니다.
  // 프로그램으로 DOM을 수정해도 브라우저 input 이벤트는 자동 발생하지 않으므로 직접 호출합니다. 임시 커서 문자는 분석에서 제외합니다.
  const syncText = (): void => setPlainText((editorRef.current?.innerText ?? "").replaceAll(CARET_PLACEHOLDER, ""));

  // 에디터의 여백을 눌렀을 때 마지막 글자 뒤에 새 커서를 만들어 바로 이어 쓸 수 있게 합니다.
  // 저장 중이면 동작하지 않으며 resumeEditor로 읽기 모드부터 풀고, 표 밖 마지막 문단을 선택하여 savedRange에 보관합니다.
  const focusEditorEnd = (): void => {
    const editor = editorRef.current;
    if (!editor || isSaving) return;
    resumeEditor();
    // 마지막 블록이 표나 목록이면 그 바깥에 빈 문단을 만들어 셀 안으로 커서가 되돌아가지 않게 합니다.
    let paragraph = editor.lastElementChild;
    if (!paragraph?.matches("p") || editor.lastChild !== paragraph) {
      paragraph = document.createElement("p");
      paragraph.append(document.createElement("br"));
      editor.append(paragraph);
    }
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.collapse(!paragraph.textContent);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    savedRange.current = range.cloneRange();
    updateFormatState(range);
    // 💡 [본문 안에서만 커서 드러내기]
    // 하단 여백을 누른 위치와 마지막 문단이 멀면 본문 스크롤만 조정해 헤더·툴바는 그대로 둡니다.
    const scroller = editor.parentElement;
    if (scroller) {
      const bounds = scroller.getBoundingClientRect();
      const caretBounds = paragraph.getBoundingClientRect();
      if (caretBounds.bottom > bounds.bottom - 28) {
        scroller.scrollTop += caretBounds.bottom - bounds.bottom + 28;
      } else if (caretBounds.top < bounds.top) {
        scroller.scrollTop += caretBounds.top - bounds.top;
      }
    }
  };

  // 바깥 스크롤 영역의 패딩 자체가 눌린 경우에만 기존 본문 선택을 건드리지 않고 맨 끝으로 이동합니다.
  // 자식 문단·이미지 클릭은 제외합니다. pointerdown에서 실행하지 않아 스크롤 시작만으로 커서가 이동하지 않습니다.
  const handleEditorAreaClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) focusEditorEnd();
  };


  // 💡 [이미지·표 블록 삭제]
  // 선택 범위 안의 블록 또는 접힌 커서 바로 앞·뒤의 블록을 찾아 키보드 삭제 한 번으로 통째로 제거합니다.
  // Enter는 먼저 체크리스트 유틸리티에 맡기고, 일반 입력은 기본 동작을 유지합니다. 한글 조합 중에는 모든 가로채기를 건너뜁니다.
  const handleEditorKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isComposing || isSaving) return;
    if (event.key === "Enter" && !event.shiftKey) {
      const range = readEditorRange(event.currentTarget);
      const next = range ? enterEditorChecklist(event.currentTarget, range) : null;
      if (next) {
        event.preventDefault();
        savedRange.current = next;
        updateFormatState(next);
        syncText();
        return;
      }
    }
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    const selection = window.getSelection();
    if (!selection?.rangeCount || !selection.isCollapsed) {
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const fragment = range?.cloneContents();
      if (!fragment?.querySelector("img, table")) return;
      event.preventDefault();
      range?.deleteContents();
      syncText();
      return;
    }

    const range = selection.getRangeAt(0);
    let candidate: Node | null = null;
    if (range.startContainer instanceof Text) {
      if (event.key === "Backspace" && range.startOffset === 0) {
        candidate = range.startContainer.parentElement?.previousSibling ?? null;
      }
      if (
        event.key === "Delete"
        && range.startOffset === range.startContainer.length
      ) {
        candidate = range.startContainer.parentElement?.nextSibling ?? null;
      }
    } else {
      const container = range.startContainer;
      candidate = event.key === "Backspace"
        ? container.childNodes.item(range.startOffset - 1)
        : container.childNodes.item(range.startOffset);
    }

    const block = candidate instanceof Element
      ? candidate.matches("img, table")
        ? candidate
        : candidate.querySelector("img, table")
      : null;
    if (!block || !event.currentTarget.contains(block)) return;
    event.preventDefault();
    block.remove();
    syncText();
  };

  // 복원한 텍스트 범위에는 부분 서식을 적용하고, 목록·들여쓰기만 문단 명령으로 처리합니다.
  // IOSFormatSheet에서 command·value를 받습니다. 적용 후 새 Range와 activeFormat을 갱신하고 syncText로 분석 입력을 맞춥니다.
  const applyFormat = (command: string, value?: string): void => {
    const editor = editorRef.current;
    if (!editor || isSaving) return;
    const range = restoreSelection();
    if (!range) return;
    const formatted = formatEditorRange(editor, range, command, value)
      ?? formatEditorList(editor, range, command);
    if (formatted) {
      savedRange.current = formatted;
      updateFormatState(formatted);
    }
    syncText();
  };
  // 서식 버튼을 누르는 포인터 이벤트가 본문의 드래그 선택을 빼앗지 못하게 기본 포커스 이동을 막습니다.
  // 명령을 실행하는 함수는 아니며, 먼저 책갈피를 보관한 뒤 다음 onClick이 그 선택을 사용할 수 있도록 준비합니다.
  const keepSelection = (
    event:
      | ReactMouseEvent<HTMLButtonElement>
      | ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    rememberSelection();
    event.preventDefault();
  };
  // 💡 [체크리스트 삽입]
  // 체크 원과 글자 영역을 나눠 만든 뒤 커서를 새 항목의 글자 시작 위치로 옮깁니다.
  // 실제 DOM 구성은 editorChecklist.ts가 맡고 이 함수는 편집 모드 복귀·선택 복원·화면 상태 갱신을 연결합니다.
  const insertChecklist = (): void => {
    const editor = editorRef.current;
    if (!editor || isSaving) return;
    resumeEditor();
    const range = restoreSelection(true);
    if (!editor || !range || isSaving) return;
    savedRange.current = insertEditorChecklist(editor, range);
    rememberSelection();
    syncText();
  };
  // 💡 [표와 다음 입력 문단 삽입]
  // 선택 위치에 독립 표와 빈 문단을 함께 넣고 첫 셀로 이동합니다. 표 안에서 다시 눌러도 중첩하지 않습니다.
  // 본문 루트·일반 문단·기존 표의 세 경로를 처리합니다. 문단 중간이면 뒷부분을 보존하고 표 뒤 입력 문단을 항상 남깁니다.
  const insertTable = (): void => {
    const editor = editorRef.current;
    if (!editor || isSaving) return;
    resumeEditor();
    const range = restoreSelection(true);
    if (!range) return;
    const table = document.createElement("table");
    table.innerHTML = "<tbody><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr></tbody>";
    range.deleteContents();
    const start = range.startContainer.nodeType === 1 ? range.startContainer as Element : range.startContainer.parentElement;
    let block = start;
    while (block && block !== editor && block.parentElement !== editor) {
      block = block.parentElement;
    }
    const paragraph = document.createElement("p");
    paragraph.append(document.createElement("br"));
    if (block?.matches("table") && editor.contains(block)) {
      // 기존 표의 다음 줄도 남겨 두어 두 표 사이와 마지막 표 아래를 각각 터치할 수 있게 합니다.
      let spacer = block.nextElementSibling;
      if (!spacer?.matches("p") || spacer.textContent?.trim() || spacer.querySelector("img, table")) {
        spacer = document.createElement("p");
        spacer.append(document.createElement("br"));
        block.after(spacer);
      }
      spacer.after(table, paragraph);
    } else if (block && block !== editor && editor.contains(block)) {
      // 문장 중간의 표는 문단을 앞뒤로 나눠 놓아 문단 안에 표가 잘못 중첩되지 않게 합니다.
      const tail = document.createRange();
      tail.selectNodeContents(block);
      tail.setStart(range.startContainer, range.startOffset);
      const suffix = tail.extractContents();
      block.after(table, paragraph);
      if (suffix.hasChildNodes()) {
        const remainder = block.cloneNode(false);
        remainder.appendChild(suffix);
        paragraph.after(remainder);
      }
      if (!block.textContent?.replaceAll(CARET_PLACEHOLDER, "").trim() && !block.querySelector("img, table")) {
        if (block.matches("p") && block.previousElementSibling?.matches("table")) {
          block.replaceChildren(document.createElement("br"));
        } else {
          block.remove();
        }
      }
    } else {
      const fragment = document.createDocumentFragment();
      fragment.append(table, paragraph);
      range.insertNode(fragment);
    }
    range.selectNodeContents(table.rows[0].cells[0]);
    range.collapse(true);
    savedRange.current = restoreEditorRange(editor, range);
    syncText();
  };
  // 완료 버튼으로 폼이 제출되면 브라우저 새로고침을 막고 공통 저장 함수로 연결합니다.
  // 버튼 저장과 닫기 자동 저장이 같은 MemoDraft 생성 규칙을 쓰도록 saveCurrentMemo를 공유합니다.
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    saveCurrentMemo();
  };
  // 💡 [이탈 자동 저장]
  // 본문에 한 글자라도 있으면 현재 DOM의 제목·본문·서식을 MemoDraft로 묶어 page.tsx의 공통 저장 함수로 전달합니다.
  // 첫 줄은 title, 나머지는 content입니다. 반환값 true는 저장 요청을 맡겼거나 저장 중이라는 뜻이지 DB 저장 성공 확인이 아닙니다.
  // 실제 로컬 저장 완료와 모달 닫힘은 부모 submitMemo가 책임집니다. 현재 조건상 글자 없는 표·이미지만 있는 메모는 저장하지 않습니다.
  const saveCurrentMemo = (): boolean => {
    if (isSaving) return true;
    const editor = editorRef.current;
    const text = editor?.innerText.replaceAll(CARET_PLACEHOLDER, "");
    if (!editor || !text?.trim()) return false;
    const [title, ...body] = text.split("\n");
    onSubmit({
      title: title.trim(),
      content: body.join("\n").trim(),
      richContent: sanitizeEditorHtml(editor.innerHTML.replaceAll(CARET_PLACEHOLDER, "")),
      tags,
      imageUrl,
      images,
    });
    return true;
  };
  // 뒤로가기나 딤드를 누르면 내용이 있으면 먼저 자동 저장하고, 빈 메모라면 저장 없이 닫습니다.
  // 저장을 맡긴 경우 여기서 onClose를 호출하지 않아 부모가 저장 실패 시 편집기를 유지할 수 있습니다.
  const closeEditor = (): void => {
    if (saveCurrentMemo()) return;
    onClose();
  };
  // 💡 [여러 이미지 첨부]
  // 사용자가 고른 모든 이미지 파일을 Data URL로 읽고 원본 파일명과 함께 기존 첨부 배열 뒤에 불변 방식으로 추가합니다.
  // MIME 타입이 image/인 파일만 병렬로 읽으며 Promise.all 결과 순서는 선택 순서입니다. 외부 업로드 API는 호출하지 않습니다.
  const attachImages = async (files: File[]): Promise<void> => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    const attachedImages = await Promise.all(
      imageFiles.map(
        (file) => new Promise<AttachedImage>((resolve, reject) => {
          const reader = new FileReader();
          reader.addEventListener("load", () => {
            if (typeof reader.result === "string") {
              resolve({ url: reader.result, name: file.name });
              return;
            }
            reject(new Error("이미지 파일을 읽지 못했습니다."));
          });
          reader.addEventListener("error", () => reject(reader.error));
          reader.readAsDataURL(file);
        }),
      ),
    );
    setImages((current) => [...current, ...attachedImages]);
  };
  // 추천 태그를 누르면 기존 쉼표 문자열을 배열로 바꿔 추가·삭제한 뒤 다시 입력창 형식으로 합칩니다.
  // recommendedTags는 그대로 두고 확정값인 tags만 바꾸므로 추천 목록과 사용자가 선택한 목록을 따로 유지합니다.
  const toggleTag = (tag: string): void => {
    const nextTags = selectedTags.includes(tag)
      ? selectedTags.filter((item) => item !== tag)
      : [...selectedTags, tag];
    setTags(nextTags.join(", "));
  };
  // 표 셀을 누르면 선택 표시를 옮기고 셀 작업 메뉴가 나타날 화면 좌표를 계산합니다.
  // DOM 속성 data-selected는 셀 강조, selectedCellRef는 작업 대상, tableMenuPosition은 팝업 렌더링을 각각 담당합니다.
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
  // 본문 클릭 대상이 체크박스인지 표 셀인지 판별해 체크 속성 또는 표 메뉴로 연결합니다.
  // 체크박스의 checked 속성을 HTML에 기록해야 richContent 저장 후에도 체크 상태가 복원됩니다. 체크 전용 React State는 없습니다.
  const handleEditorClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (formatSheet.mode !== "editor" || isTagsOpen) resumeEditor();
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
  // 최소 한 행·한 열은 남기며, 열 추가·삭제는 모든 행의 같은 인덱스에 적용합니다. 처리 후 선택과 메뉴를 비웁니다.
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
  // 💡 [클립보드 복사 완료 후 삭제]
  // writeText가 성공한 다음에만 셀을 비웁니다. 현재 함수는 권한·접근 실패를 직접 복구하지 않고 호출 Promise로 전달합니다.
  const copyCell = async (cut: boolean): Promise<void> => {
    const selectedCell = selectedCellRef.current;
    if (!selectedCell) return;
    await navigator.clipboard.writeText(selectedCell.innerText);
    if (cut) selectedCell.innerHTML = "<br>";
    syncText();
  };
  // 클립보드의 글자를 마지막으로 선택한 표 셀에 붙여 넣고 본문 State를 동기화합니다.
  // 💡 [텍스트만 붙여 넣기]
  // readText 결과를 innerText에 넣어 외부 HTML을 실행하지 않습니다. 선택 셀이 없으면 요청하지 않습니다.
  const pasteCell = async (): Promise<void> => {
    const selectedCell = selectedCellRef.current;
    if (!selectedCell) return;
    selectedCell.innerText = await navigator.clipboard.readText();
    syncText();
  };
  // 시트와 키보드 닫힘 대기를 함께 취소해 늦은 예약이 화면을 덮지 않게 합니다.
  // formatSheet.close가 모드를 editor로 바꾸면 훅의 정리 함수가 시트 표시 타이머를 해제합니다.
  const closeFormatLayer = (): void => {
    formatSheet.close();
  };
  // 💡 [본문으로 돌아가기]
  // 사용자 터치 안에서 편집을 즉시 활성화한 뒤 포커스를 주어 iOS가 키보드를 다시 열 수 있게 합니다.
  // State 반영을 기다리기 전에 contentEditable을 직접 켜는 이유는 사용자 입력 이벤트 안에서 포커스를 요청해야 하기 때문입니다.
  const resumeEditor = (): void => {
    if (isSaving) return;
    closeFormatLayer();
    setIsTagsOpen(false);
    const editor = editorRef.current;
    if (!editor) return;
    editor.contentEditable = "true";
    editor.focus({ preventScroll: true });
  };
  // 💡 [가가 버튼의 키보드 교체]
  // 선택 범위를 먼저 복사하고 현재 입력창을 흐리게 한 뒤 높이가 복원될 때까지 시트 표시를 기다립니다.
  // 이미 대기·표시 중이면 close로 취소합니다. 새로 열 때에는 태그 패널을 닫아 서로 다른 입력 패널이 겹치지 않게 합니다.
  const toggleFormatLayer = (): void => {
    if (formatSheet.mode !== "editor") {
      closeFormatLayer();
      return;
    }
    rememberSelection();
    setIsTagsOpen(false);
    formatSheet.open();
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  };

  // 태그 버튼 하나가 직접 입력과 추천 칩을 함께 열고 서식 패널은 접습니다.
  // 본문 선택을 먼저 보관하므로 태그 입력창으로 이동한 뒤에도 이후 서식 명령에서 원래 선택을 사용할 수 있습니다.
  const toggleTags = (): void => {
    rememberSelection();
    closeFormatLayer();
    setIsTagsOpen((current) => !current);
  };
  // 다섯 도구의 내용 너비를 유지해 좁은 화면에서는 버튼을 줄이지 않고 가로로 넘깁니다.
  const bottomButton =
    "ios-tap flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#1e2029] px-4 text-sm font-semibold text-[#e5a93c]";
  return (
    <div
      className="fixed inset-0 z-[100] box-border flex h-[100dvh] w-full max-w-full flex-col overflow-hidden touch-none overscroll-none bg-[#121318] text-[#f3f4f6] xl:items-center xl:justify-center xl:bg-black/70 xl:p-6"
      style={{
        "--viewport-height": viewport.height === null ? "100dvh" : `${viewport.height}px`,
        "--viewport-top": `${viewport.offsetTop}px`,
      } as CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-labelledby="memo-modal-title"
      onClick={closeEditor}
      onTouchMove={(event) => event.stopPropagation()}
      onScrollCapture={(event) => {
        // 모달 외곽과 폼만 원점으로 되돌리고 본문·툴바의 정상적인 스크롤은 유지합니다.
        const target = event.target;
        if (target instanceof HTMLElement && target.hasAttribute("data-scroll-locked") && target.scrollTop !== 0) target.scrollTop = 0;
      }}
      data-scroll-locked
    >
      {/* 💡 [전체 화면 배경과 편집 영역 분리]
          바깥 배경은 화면 전체를 가리고, 안쪽 높이만 키보드를 따라 줄어들어 남는 공간에 목록이 비치지 않게 합니다. */}
      <div
        data-scroll-locked
        className="fixed inset-x-0 top-[var(--viewport-top)] flex h-[var(--viewport-height)] min-h-0 w-full flex-col overflow-hidden bg-[#121318] xl:static xl:h-full xl:items-center xl:justify-center xl:bg-transparent"
      >
        <form
          data-scroll-locked
          id="memo-form"
          onSubmit={submit}
          onClick={(event) => event.stopPropagation()}
          className="box-border flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#121318] xl:mx-auto xl:h-[75vh] xl:max-h-[80vh] xl:max-w-2xl xl:flex-none xl:rounded-3xl xl:border xl:border-[#2a2e3d] xl:shadow-2xl"
        >
          <header className="z-20 grid h-14 w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-[#2a2e3d] bg-[#121318] px-4">
            <button
              type="submit"
              disabled={isSaving || !plainText.trim()}
              className="ios-tap min-h-11 justify-self-start text-base font-semibold text-[#e5a93c] disabled:opacity-40"
            >
              {isSaving ? "저장 중…" : "저장"}
            </button>
            <h2
              id="memo-modal-title"
              className="max-w-[45vw] truncate text-sm font-semibold text-[#9ca3af]"
            >
              {editingMemo ? "메모 편집 중" : plainText.trim() ? "새 메모 작성 중" : "새 메모"}
            </h2>
            <button
              type="button"
              onClick={closeEditor}
              disabled={isSaving}
              className="ios-tap min-h-11 justify-self-end text-base font-semibold text-[#e5a93c] disabled:opacity-40"
              aria-label="메모를 자동 저장하고 목록으로 돌아가기"
            >
              닫기
            </button>
          </header>

          <div
            className="box-border min-h-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto touch-pan-y overscroll-y-contain [-webkit-overflow-scrolling:touch] px-4 pt-3 pb-60"
            onClick={handleEditorAreaClick}
          >
            <p className="pb-4 text-center text-xs text-[#8e8e93]">
              {formatDate(editingMemo?.updatedAt)}
            </p>
            {/* 사용자가 직접 첨부한 이미지가 있을 때만 미리보기 영역을 만들며, 이미지가 없으면 곧바로 작성 캔버스를 보여 줍니다. */}
            {images.length > 0 && (
              <div className="mb-4 flex w-full max-w-full flex-col gap-3">
                {images.map((image, index) => (
                  <figure
                    key={`${image.name}-${index}`}
                    className={`relative w-full max-w-full overflow-hidden rounded-xl bg-[#1c1c1e] ${image.url === imageUrl ? "ring-2 ring-[#e5a93c]" : ""}`}
                  >
                    {/* 브라우저가 읽은 로컬 사진을 첨부 순서대로 미리 보여 줍니다. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={`${image.name} 첨부 이미지`}
                      className="w-full max-w-full h-auto max-h-[300px] object-cover rounded-xl border border-[#2a2e3d]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setImages((current) =>
                          current.filter((_, imageIndex) => imageIndex !== index),
                        )
                      }
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/75 px-2 py-1 text-[10px]"
                    >
                      제거
                    </button>
                  </figure>
                ))}
              </div>
            )}
            <div
              ref={mountEditor}
              contentEditable={!isSaving && formatSheet.mode === "editor"}
              data-memo-editor
              onPointerDown={() => {
                if (formatSheet.mode !== "editor" || isTagsOpen) resumeEditor();
              }}
              onFocus={() => {
                if (formatSheet.mode !== "editor") closeFormatLayer();
              }}
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
                setPlainText(event.currentTarget.innerText.replaceAll(CARET_PLACEHOLDER, ""));
                rememberSelection();
                setIsAnalyzingTags(true);
              }}
              onSelect={rememberSelection}
              onKeyUp={rememberSelection}
              onKeyDown={handleEditorKeyDown}
              className="rich-editor box-border min-h-[70%] w-full max-w-full select-text break-words text-[17px] leading-7 text-white outline-none"
              data-placeholder="메모를 입력하세요"

            />
          </div>

          {/* 💡 [키보드 도킹 툴바]
              도구는 가로 스크롤 한 줄에 두고 키보드가 내려간 뒤 서식 패널을 펼칩니다. */}
          <div
            className="z-20 box-border w-full max-w-full shrink-0 touch-none overscroll-none border-t border-[#2a2e3d] bg-[#161922] pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          >
            {isFormatOpen && (
              <IOSFormatSheet
                activeFormat={activeFormat}
                disabled={isSaving}
                onKeepSelection={keepSelection}
                onFormat={applyFormat}
              />
            )}
            {isTagsOpen && (
              <section
                className={`animate-[fade-in_180ms_ease-out] motion-reduce:animate-none border-b border-[#2a2e3d] px-3 py-2 ${isAnalyzingTags ? "bg-[#e5a93c]/5" : ""}`}
                id="memo-tag-panel"
                aria-label="태그 관리 패널"
              >
                <h3 className="mb-2 text-xs font-semibold text-[#9ca3af]">
                  🏷️ 태그 관리
                </h3>
                <input
                  ref={tagInputRef}
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  className="w-full rounded-lg border border-[#2a2e3d] bg-[#121318] px-3 py-2 text-base text-white outline-none placeholder:text-[#636366] focus:border-[#e5a93c]"
                  placeholder="태그 직접 추가: 쉼표로 구분"
                  aria-label="태그 직접 추가"
                />
                <div className="scrollbar-hidden mt-2 flex min-h-8 w-full items-center gap-2 overflow-x-auto touch-pan-x overscroll-x-contain" aria-label="AI 추천 태그" aria-live="polite">
                  <span
                    className={`shrink-0 text-xs text-[#8e8e93] ${isAnalyzingTags ? "animate-pulse text-[#ffc86b] motion-reduce:animate-none" : ""}`}
                  >
                    {isAnalyzingTags
                      ? "Gemini 분석 중…"
                      : isUsingLocalAnalysis
                        ? "로컬 추천"
                        : "✨ 추천"}
                  </span>
                  {recommendedTags.length > 0 ? (
                    recommendedTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onPointerDown={keepSelection}
                          onClick={() => toggleTag(tag)}
                          aria-pressed={isSelected}
                          className={`ios-tap shrink-0 animate-[fade-in_180ms_ease-out] rounded-full border px-3 py-1.5 text-xs font-semibold motion-reduce:animate-none ${isSelected ? "border-[#e5a93c] bg-[#e5a93c] text-black" : "border-[#636366] text-white"}`}
                        >
                          #{tag}
                        </button>
                      );
                    })
                  ) : (
                    <p className="shrink-0 text-xs text-[#636366]">
                      본문을 입력하면 관련 태그가 표시됩니다.
                    </p>
                  )}
                </div>
              </section>
            )}
            <div
              className="scrollbar-hidden flex w-full items-center gap-2 overflow-x-auto overscroll-x-contain touch-pan-x whitespace-nowrap border-t border-[#2a2e3d] bg-[#161922] px-4 py-2"
              role="toolbar"
              aria-label="메모 작성 도구"
            >
              <button
                type="button"
                onPointerDown={keepSelection}
                onClick={toggleFormatLayer}
                className={bottomButton}
                aria-expanded={isFormatOpen}
                aria-busy={formatSheet.mode === "waiting"}
                aria-controls="memo-format-sheet"
                aria-label="텍스트 서식"
              >
                <span
                  className="flex items-baseline font-semibold"
                  aria-hidden="true"
                >
                  <span className="text-lg">
                    가
                  </span>
                  <span className="text-xs">
                    가
                  </span>
                </span>
                <span>
                  서식
                </span>
              </button>
              <button
                type="button"
                onPointerDown={keepSelection}
                onClick={insertChecklist}
                className={bottomButton}
                aria-label="체크리스트"
              >
                <span className="text-lg" aria-hidden="true">
                  ☑️
                </span>
                <span>
                  체크리스트
                </span>
              </button>
              <button
                type="button"
                onPointerDown={keepSelection}
                onClick={insertTable}
                className={bottomButton}
                aria-label="표 삽입"
              >
                <span className="text-lg" aria-hidden="true">
                  ▦
                </span>
                <span>
                  표
                </span>
              </button>
              <button
                type="button"
                onPointerDown={keepSelection}
                onClick={() => imageInputRef.current?.click()}
                className={bottomButton}
                aria-label="사진 또는 파일 첨부"
              >
                <span className="text-lg" aria-hidden="true">
                  📷
                </span>
                <span>
                  첨부
                </span>
              </button>
              <button
                type="button"
                onPointerDown={keepSelection}
                onClick={toggleTags}
                className={bottomButton}
                aria-expanded={isTagsOpen}
                aria-controls="memo-tag-panel"
                aria-label="태그 관리"
              >
                <span className="text-lg" aria-hidden="true">
                  🏷️
                </span>
                <span>
                  태그
                </span>
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  void attachImages(Array.from(event.target.files ?? []));
                  event.currentTarget.value = "";
                }}
                className="hidden"
              />
            </div>
          </div>
        </form>

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
    </div>
  );
}
