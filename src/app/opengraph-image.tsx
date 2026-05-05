import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "ZIM CARRY Financial Dashboard — 5-Year Analysis (FY2021-FY2025)";

// Note: ImageResponse only supports TTF/OTF (single font, no Collection).
// Pretendard OTF returns "Unsupported OpenType signature Pack".
// We fall back to Latin-only design + try Korean font; if font fetch fails,
// the image still renders with default font.
export default async function OG() {
  let koreanFont: ArrayBuffer | null = null;
  try {
    // Spoqa Han Sans Neo Bold TTF (single OpenType, no Collection)
    const res = await fetch(
      "https://hangeul.pstatic.net/hangeul_static/webfont/SpoqaHanSansNeo/SpoqaHanSansNeo-Bold.ttf",
      { cache: "force-cache" }
    );
    if (res.ok) koreanFont = await res.arrayBuffer();
  } catch {
    /* fallback to default font */
  }

  const stats = [
    { label: "Revenue 5Y", value: "11.5×", color: "#16a34a" },
    { label: "Op Margin", value: "-8.1%", color: "#eab308" },
    { label: "Capital Used", value: "83%", color: "#dc2626" },
    { label: "Runway", value: "16 mo", color: "#eab308" },
  ];

  const fontFamily = koreanFont ? "Spoqa, sans-serif" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          background:
            "linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          fontFamily,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: "#eab308",
            }}
          />
          <div
            style={{
              fontSize: 18,
              color: "#64748b",
              letterSpacing: 1.5,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            ZIM CARRY · Financial Dashboard · FY2021—FY2025
          </div>
        </div>

        <div
          style={{
            fontSize: 92,
            fontWeight: 800,
            marginTop: 4,
            color: "#0f172a",
            letterSpacing: -3,
            lineHeight: 1.05,
          }}
        >
          ZIM CARRY
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 700,
            marginTop: 4,
            color: "#334155",
            letterSpacing: -1,
          }}
        >
          짐캐리 재무 대시보드
        </div>

        <div
          style={{
            fontSize: 26,
            marginTop: 22,
            color: "#475569",
            lineHeight: 1.45,
            fontWeight: 600,
            maxWidth: 1000,
          }}
        >
          PMF 검증·손익 개선 중 — 자본·현금 구조는 외부 자금 100% 의존
        </div>

        <div
          style={{
            display: "flex",
            gap: 14,
            marginTop: "auto",
          }}
        >
          {stats.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "20px 24px",
                border: "1px solid #e2e8f0",
                borderRadius: 18,
                background: "white",
                flex: 1,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  color: "#94a3b8",
                  fontWeight: 600,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  color: s.color,
                  marginTop: 4,
                  letterSpacing: -1.5,
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 28,
            paddingTop: 18,
            borderTop: "1px solid #e2e8f0",
            fontSize: 14,
            color: "#94a3b8",
            fontWeight: 600,
          }}
        >
          <div>Accounting · M&A perspective · DART + IR 2024 + Public Data</div>
          <div>2026-04-30</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: koreanFont
        ? [{ name: "Spoqa", data: koreanFont, weight: 700 }]
        : undefined,
    }
  );
}
