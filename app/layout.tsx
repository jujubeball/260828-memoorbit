import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MemoOrbit",
  description: "생각을 기록하고 연결하는 메모 서비스",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full max-w-full overflow-x-hidden antialiased`}
    >
      {/* 루트 본문도 기기 너비를 넘지 않도록 막아 모든 페이지가 같은 가로 경계를 공유합니다. */}
      <body className="flex min-h-full w-full max-w-full flex-col overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
