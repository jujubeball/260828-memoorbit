export type ImageMood = "수채화" | "네온" | "흑백" | "빈티지";

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
  aiImageUrl?: string;
  aiImageMood?: ImageMood;
  aiImageSourceText?: string;
}
