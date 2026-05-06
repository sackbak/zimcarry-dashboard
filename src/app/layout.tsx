import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "재무 대시보드",
  description:
    "재무상태표·손익계산서·현금흐름표를 입력하면 동일한 프레임으로 분석하는 인터랙티브 툴.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
