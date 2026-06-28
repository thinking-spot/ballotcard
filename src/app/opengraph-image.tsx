import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "BallotCard — find your ballot";

// Default OG card used for every route that doesn't ship its own. The brand is
// the message: paper-on-glass aesthetic in a 1200×630 frame, no per-page data
// (per-route OGs can override this by colocating their own opengraph-image).
export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(135deg, #e8e4f5 0%, #f1edf8 50%, #e1dcf0 100%)",
          color: "#1a2347",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "10px",
              border: "3px solid #1a2347",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.85,
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1a2347"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 12 10 18 20 6" />
            </svg>
          </div>
          <div
            style={{
              fontSize: "40px",
              fontWeight: 500,
              letterSpacing: "-0.5px",
            }}
          >
            BallotCard
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              fontSize: "92px",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-1.5px",
              fontFamily: "serif",
            }}
          >
            Find your ballot.
          </div>
          <div
            style={{
              fontSize: "32px",
              lineHeight: 1.3,
              color: "#4a5170",
              maxWidth: "900px",
            }}
          >
            Enter your address, see everyone who represents you — federal to
            local — on one permanent, shareable page.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "22px",
            color: "#4a5170",
          }}
        >
          <span>ballot-card.com</span>
          <span>No account · No ads · No tracking</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
