import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "분양회 CRM | 광고인㈜ 대외협력팀",
  description: "분양회 VIP 멤버십 영업관리 시스템",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#D4A843" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="stylesheet" as="style" crossOrigin="anonymous" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{__html:`
          (function(){
            var s=localStorage.getItem("crm_dark_mode");
            if(s!=="false") document.documentElement.setAttribute("data-theme","dark");
          })();
        `}}/>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
