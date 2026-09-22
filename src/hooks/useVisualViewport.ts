"use client";

import { useEffect, useState } from "react";

interface VisualViewportState {
  // 첫 렌더의 null은 MemoModal이 CSS의 100dvh를 쓰라는 뜻이며, 측정 후에는 보이는 높이의 픽셀값입니다.
  height: number | null;
  // 현재 모달은 문서 원점을 잠그므로 0을 유지합니다. 키보드 패닝 값을 누적하는 좌표가 아닙니다.
  offsetTop: number;
}

// 💡 [모바일 가시 높이를 화면 상태로 전달]
// MemoModal이 열림 여부를 active로 전달하면 창의 가시 높이를 돌려줍니다. 키보드 열림 여부를 직접 판정하는 훅은 아닙니다.
// 반환값은 모달의 CSS 변수로 이어져 헤더·본문·툴바가 들어갈 높이를 정하며, 시트 표시 판단은 useKeyboardFormatSheet가 맡습니다.
export function useVisualViewport(active = true): VisualViewportState {
  // 서버에서는 창 크기를 알 수 없으므로 기본 CSS 높이를 사용합니다.
  const [viewport, setViewport] = useState<VisualViewportState>({ height: null, offsetTop: 0 });

  // 💡 [가시 영역 추적]
  // 키보드와 화면 크기 변경만 한 프레임으로 묶습니다. 스크롤마다 위치를 바꾸면 iOS의 화면 보정과 서로 반복되어 모달이 떨릴 수 있습니다.
  // active가 바뀌면 이전 구독을 해제하고 다시 판단합니다. 닫힌 동안에는 측정을 멈추지만 마지막 상태값은 유지합니다.
  useEffect(() => {
    if (!active) return;
    const visualViewport = window.visualViewport;
    // 예약 번호는 화면에 표시하지 않으므로 State가 아닌 이 이펙트의 지역 변수로 보관합니다.
    let frame = 0;
    // 실제 브라우저 값을 읽는 단계입니다. VisualViewport 미지원 시 innerHeight로 대체하지만 모든 키보드 높이를 보장하지는 않습니다.
    const measure = (): void => {
      // 키보드 경계의 소수점 흔들림은 정수 픽셀로 정규화하고 실제 크기 변화만 전달합니다.
      const height = Math.round(visualViewport?.height ?? window.innerHeight);
      // 문서 스크롤은 원점으로 잠그므로 일시적인 키보드 패닝을 모달의 위치로 저장하지 않습니다.
      const offsetTop = 0;
      // 같은 값을 가진 새 객체를 만들지 않아 불필요한 React 렌더링을 막습니다.
      setViewport((current) => current.height === height && current.offsetTop === offsetTop
        ? current
        : { height, offsetTop });
    };
    // resize가 연달아 와도 앞선 예약을 취소하고 다음 화면 프레임에 최신 크기를 한 번 측정합니다.
    const schedule = (): void => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    schedule();
    visualViewport?.addEventListener("resize", schedule);
    window.addEventListener("resize", schedule);
    // 모달 종료·구독 교체 시 이벤트와 미실행 프레임을 함께 정리해 닫힌 화면에 늦게 측정값이 전달되지 않게 합니다.
    return () => {
      window.cancelAnimationFrame(frame);
      visualViewport?.removeEventListener("resize", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [active]);

  return viewport;
}
