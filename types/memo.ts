export type ImageMood = "수채화" | "네온" | "흑백" | "빈티지";

export interface MemoImageAttachment {
  url: string;
  name: string;
}

export interface Memo {
  id: string;
  title: string;
  content: string;
  richContent?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  tags: string[];
  imageUrl?: string;
  images?: MemoImageAttachment[];
  aiImageUrl?: string;
  aiImageMood?: ImageMood;
  aiImageSourceText?: string;
}
