"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          textAlign: "center",
          padding: "1.5rem",
          background: "#F0F2F6",
          color: "#1A1D23",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>حدث خطأ في النظام</h2>
        <p style={{ color: "#4A5068" }}>نعتذر عن هذا الخلل. يرجى إعادة المحاولة.</p>
        <button
          onClick={reset}
          style={{
            background: "#1B4F8A",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            padding: "0.6rem 1.5rem",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          إعادة المحاولة
        </button>
      </body>
    </html>
  );
}
