import { NextResponse } from "next/server";
import { resolveAddress } from "@/lib/geocoder";

export const runtime = "nodejs";
// Never statically cache; this is a stateless per-request proxy.
export const dynamic = "force-dynamic";

/**
 * POST { address: string } → resolved district geographies.
 *
 * Privacy contract: the address is forwarded to the US Census Geocoder and used
 * only to derive district identifiers. It is never stored, never logged, and
 * never returned. Sentry address scrubbing covers the error path.
 */
export async function POST(request: Request) {
  let address: string;
  try {
    const body = (await request.json()) as { address?: unknown };
    if (typeof body.address !== "string" || body.address.trim().length < 5) {
      return NextResponse.json(
        { error: "Please enter a full street address." },
        { status: 400 }
      );
    }
    address = body.address.trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const geographies = await resolveAddress(address);
    // Drop the address from scope as soon as resolution returns.
    address = "";

    if (!geographies?.state) {
      return NextResponse.json(
        {
          error:
            "We couldn't match that address. Try including city, state, and ZIP.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ geographies });
  } catch {
    // Do not include the address in the error — privacy is load-bearing.
    return NextResponse.json(
      { error: "Address lookup is temporarily unavailable. Please try again." },
      { status: 502 }
    );
  }
}
