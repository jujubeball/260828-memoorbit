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

export interface MemoDraft {
  title: string;
  content: string;
  richContent: string;
  tags: string;
  imageUrl?: string;
  images: AttachedImage[];
}

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
  isSaving = false,
  isOpen,
  editingMemo,
  onClose,
  onSubmit,
}: MemoModalProps): React.JSX.Element | null {
  // 💡 [편집기 DOM 참조 모음]
  // 화면에 그려진 본문, 파일 입력, 선택 범위, 표 셀을 React 코드에서 안전하게 찾아가기 위한 책갈피입니다.
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const selectedCellRef = useRef<HTMLTableCellElement | null>(null);
  // 💡 [초기 본문 한 번만 주입]
  // 태그·키보드 상태가 바뀌어도 React가 사용자가 편집한 DOM과 선택 범위를 다시 만들지 않게 합니다.
  const [initialHtml] = useState(() => createInitialHtml(editingMemo));
  const mountEditor = useCallback((element: HTMLDivElement | null): void => {
    editorRef.current = element;
    if (element) element.innerHTML = initialHtml;
  }, [initialHtml]);
  // 💡 [사용자가 바꾸는 편집 상태]
  // 입력할 때마다 화면을 다시 그려야 하는 값만 State로 보관하고, 실제 서식 HTML은 편집 DOM에서 저장 순간 읽습니다.
  const [plainText, setPlainText] = useState(
    editingMemo
      ? [editingMemo.title, editingMemo.content].filter(Boolean).join("\n")
      : "",
  );
  const [images, setImages] = useState<AttachedImage[]>(
    editingMemo?.images
      ?? (editingMemo?.imageUrl
        ? [{ url: editingMemo.imageUrl, name: "기존 첨부 이미지" }]
        : []),
  );
  const [tags, setTags] = useState(editingMemo?.tags.join(", ") ?? "");
  const [recommendedTags, setRecommendedTags] = useState(() => extractDynamicKeywords(plainText));
  const [isUsingLocalAnalysis, setIsUsingLocalAnalysis] = useState(false);
  const [isAnalyzingTags, setIsAnalyzingTags] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const formatSheet = useKeyboardFormatSheet(isOpen);
  const isFormatOpen = formatSheet.mode === "format";
  const [activeFormat, setActiveFormat] = useState(EMPTY_EDITOR_FORMAT);
  // 선택 위치의 서식이 달라진 경우에만 버튼 상태를 갱신해 드래그 중 불필요한 렌더링을 줄입니다.
  const updateFormatState = useCallback((range: Range | null): void => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = readEditorFormat(editor, range);
    setActiveFormat((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
  }, []);
  const viewport = useVisualViewport(isOpen);
  const [tableMenuPosition, setTableMenuPosition] =
    useState<TableMenuPosition | null>(null);

  usePageScrollLock(isOpen);

  // 💡 [모바일 선택 핸들 추적]
  // 손가락으로 선택 경계를 바꾸는 동안 Range를 복사하고, 태그 입력창의 선택은 본문 선택을 덮어쓰지 않습니다.
  useEffect(() => {
    if (!isOpen) return;
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
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !isOpen || isSaving) return;
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
  useEffect(() => {
    if (!isTagsOpen) return;
    const frameId = window.requestAnimationFrame(() => {
      tagInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isTagsOpen]);

  // 💡 [300ms Gemini 실시간 분석]
  // 사용자가 입력을 잠깐 멈추면 서버 Route에 최신 본문을 보내고, 실패할 때만 브라우저의 로컬 핵심어 분석기를 사용합니다.
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
  const selectedTags = useMemo(
    () =>
      tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tags],
  );
  // 본문이나 태그, 첨부 목록이 바뀔 때마다 같은 점수 함수를 다시 실행해 화면 미리보기의 대표 사진도 즉시 갱신합니다.
  const imageUrl = useMemo(
    () => selectRepresentativeImage(plainText, selectedTags, images),
    [images, plainText, selectedTags],
  );

  if (!isOpen) return null;

  // 사용자가 본문을 드래그하면 현재 선택 범위를 복사해 서식 버튼을 누른 뒤에도 잃지 않게 합니다.
  const rememberSelection = (): void => {
    if (!editorRef.current || formatSheet.mode !== "editor") return;
    const range = readEditorRange(editorRef.current);
    if (range) {
      savedRange.current = range;
      updateFormatState(range);
    }
  };
  // 저장해 둔 선택 범위를 본문에 다시 올리고 적용 가능한 Range를 서식 함수에 돌려줍니다.
  const restoreSelection = (focus = formatSheet.mode === "editor"): Range | null => editorRef.current
    ? restoreEditorRange(editorRef.current, savedRange.current, focus)
    : null;
  // 체크리스트나 표처럼 DOM이 직접 바뀐 뒤 현재 글자를 plainText State와 다시 맞춥니다.
  const syncText = (): void => setPlainText((editorRef.current?.innerText ?? "").replaceAll(CARET_PLACEHOLDER, ""));

  // 에디터의 여백을 눌렀을 때 마지막 글자 뒤에 새 커서를 만들어 바로 이어 쓸 수 있게 합니다.
  const focusEditorEnd = (): void => {
    const editor = editorRef.current;
    if (!editor) return;
    resumeEditor();
    editor.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    savedRange.current = range.cloneRange();
  };

  // 바깥 스크롤 영역의 패딩 자체가 눌린 경우에만 기존 본문 선택을 건드리지 않고 맨 끝으로 이동합니다.
  const handleEditorAreaClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) focusEditorEnd();
  };


  // 💡 [이미지·표 블록 삭제]
  // 선택 범위 안의 블록 또는 접힌 커서 바로 앞·뒤의 블록을 찾아 키보드 삭제 한 번으로 통째로 제거합니다.
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
  // 표 버튼은 선택 위치에 빈 표를 넣고 첫 셀에 커서를 두어 바로 입력할 수 있게 합니다.
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
    const block = start?.closest("p, h1, h2, h3, pre, div");
    if (block && block !== editor && editor.contains(block)) {
      // 문장 중간의 표는 문단을 앞뒤로 나눠 놓아 문단 안에 표가 잘못 중첩되지 않게 합니다.
      const tail = document.createRange();
      tail.selectNodeContents(block);
      tail.setStart(range.startContainer, range.startOffset);
      const suffix = tail.extractContents();
      block.after(table);
      const paragraph = document.createElement("p");
      paragraph.append(suffix.hasChildNodes() ? suffix : document.createElement("br"));
      table.after(paragraph);
      if (!block.textContent?.replaceAll(CARET_PLACEHOLDER, "").trim()) block.remove();
    } else range.insertNode(table);
    range.selectNodeContents(table.rows[0].cells[0]);
    range.collapse(true);
    savedRange.current = restoreEditorRange(editor, range);
    syncText();
  };
  // 완료 버튼으로 폼이 제출되면 브라우저 새로고침을 막고 공통 저장 함수로 연결합니다.
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    saveCurrentMemo();
  };
  // 💡 [이탈 자동 저장]
  // 본문에 한 글자라도 있으면 현재 DOM의 제목·본문·서식을 MemoDraft로 묶어 page.tsx의 공통 저장 함수로 전달합니다.
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
  const closeEditor = (): void => {
    if (saveCurrentMemo()) return;
    onClose();
  };
  // 💡 [여러 이미지 첨부]
  // 사용자가 고른 모든 이미지 파일을 Data URL로 읽고 원본 파일명과 함께 기존 첨부 배열 뒤에 불변 방식으로 추가합니다.
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
  // 시트와 키보드 닫힘 대기를 함께 취소해 늦은 예약이 화면을 덮지 않게 합니다.
  const closeFormatLayer = (): void => {
    formatSheet.close();
  };
  // 💡 [본문으로 돌아가기]
  // 사용자 터치 안에서 편집을 즉시 활성화한 뒤 포커스를 주어 iOS가 키보드를 다시 열 수 있게 합니다.
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
          <header className="z-20 flex h-14 w-full shrink-0 items-center justify-between border-b border-[#2a2e3d] bg-[#121318] px-4">
            <button
              type="button"
              onClick={closeEditor}
              className="ios-tap justify-self-start text-base font-semibold text-[#e5a93c]"
              aria-label="메모를 자동 저장하고 목록으로 돌아가기"
            >
              닫기
            </button>
            <h2
              id="memo-modal-title"
              className="max-w-[45vw] truncate text-sm font-semibold text-[#9ca3af]"
            >
              {editingMemo ? "메모 편집 중" : plainText.trim() ? "새 메모 작성 중" : "새 메모"}
            </h2>
            <button
              type="submit"
              disabled={isSaving || !plainText.trim()}
              className="ios-tap justify-self-end rounded-lg bg-[#e5a93c] px-3 py-1.5 text-sm font-bold text-[#121318] disabled:opacity-40"
            >
              {isSaving ? "저장 중…" : "저장"}
            </button>
          </header>

          <div
            className="box-border min-h-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto touch-pan-y overscroll-y-contain [-webkit-overflow-scrolling:touch] px-4 py-3"
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
                  포맷
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
                onClick={insertTable}
                className={bottomButton}
                aria-label="표 삽입"
              >
                <span aria-hidden="true">
                  ▦
                </span>
                <span>
                  표
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
