export interface Memo {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  ageAtCreation?: number;
  tags: string[];
  aiComment?: string;
}

export interface MindOrbitData {
  year: number;
  age: number;
  mainCategory: string;
  keywords: string[];
}