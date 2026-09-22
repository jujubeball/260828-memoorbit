export interface MemoImageAttachment {
  url: string;
  name: string;
}

export interface MemoLink {
  targetId: string;
  weight: number;
  reason?: string;
}

export interface Memo {
  syncStatus: "synced" | "pending" | "failed";
  syncRevision?: string;
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
  links?: MemoLink[];
}

export interface SyncQueueEntry {
  id: string;
  revision: string;
  operation: "upsert" | "delete";
  memo?: Memo;
  attempts: number;
  nextAttemptAt: number;
  queuedAt: number;
}
