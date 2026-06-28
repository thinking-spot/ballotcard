import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

// Ingestion calls this after a successful run so the ISR cache on the catchall
// permalink route ([state]/[[...slug]]) flushes immediately rather than waiting
// out the 6-hour revalidate window. The spec says "office/official pages are
// static, revalidated on ingestion" — this is the second half of that contract.
//
// Auth: a shared secret in REVALIDATE_SECRET, set both in .env.local (for the
// ingest script) and in Vercel env vars (for the running app). Without it the
// route is a public cache-buster, which is bad.

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "REVALIDATE_SECRET not configured" },
      { status: 500 }
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Flush the catchall route ('/[state]/[[...slug]]' covers every district and
  // office permalink) plus the homepage and sitemap. We use the layout-level
  // path with type "layout" so ALL matching dynamic params are invalidated in
  // one call rather than iterating 15k+ specific paths.
  revalidatePath("/[state]/[[...slug]]", "layout");
  revalidatePath("/");
  revalidatePath("/sitemap.xml");

  return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
}
