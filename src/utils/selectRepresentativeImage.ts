import type { MemoImageAttachment } from "@/types/memo";

export type AttachedImage = MemoImageAttachment;

// 💡 [검색 단어 정리]
// 문장과 파일명을 소문자로 바꾸고 기호를 공백으로 나눠, 두 글자 이상인 중복 없는 단어만 비교 후보로 만듭니다.
const extractSearchWords = (value: string): string[] =>
  [...new Set(
    value
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((word) => word.trim())
      .filter((word) => word.length > 1),
  )];

// 💡 [본문 문맥 기반 대표 이미지 선별]
// 태그가 파일명에 들어가면 3점, 본문의 핵심 단어가 들어가면 1점을 더하고 가장 높은 이미지 URL을 돌려줍니다.
export function selectRepresentativeImage(
  content: string,
  tags: string[],
  images: AttachedImage[],
): string | undefined {
  // 첨부가 없으면 대표 이미지도 없고, 한 장뿐이면 점수를 계산할 필요 없이 그 사진을 사용합니다.
  if (images.length === 0) return undefined;
  if (images.length === 1) return images[0].url;

  const normalizedTags = tags
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  const contentWords = extractSearchWords(content);
  let bestMatchUrl = images[0].url;
  let maxScore = 0;

  images.forEach((image) => {
    const fileName = image.name.toLowerCase();
    const tagScore = normalizedTags.reduce(
      (score, tag) => score + (fileName.includes(tag) ? 3 : 0),
      0,
    );
    const contentScore = contentWords.reduce(
      (score, word) => score + (fileName.includes(word) ? 1 : 0),
      0,
    );
    const totalScore = tagScore + contentScore;
    if (totalScore > maxScore) {
      maxScore = totalScore;
      bestMatchUrl = image.url;
    }
  });

  // 어떤 파일명도 문맥과 맞지 않아 최고 점수가 0이면 업로드 순서가 가장 빠른 첫 사진이 그대로 남습니다.
  return bestMatchUrl;
}
