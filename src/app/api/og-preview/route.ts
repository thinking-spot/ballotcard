import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { limits } from "@/lib/rate-limit";
import { fetchOpenGraph } from "@/lib/og-fetch";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!limits.ogFetch(session.user.id)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429 }
    );
  }

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL is required." }, { status: 400 });
  }

  const result = await fetchOpenGraph(url);
  return NextResponse.json(result);
}
