"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ResolvedGeographies = {
  state?: { code: string; name: string; fips: string };
  county?: { name: string; geoid: string };
  place?: { name: string; geoid: string };
  congressionalDistrict?: { number: string };
  stateLegislativeUpper?: { number: string };
  stateLegislativeLower?: { number: string };
};

const STORAGE_KEY = "ballotcard.districts";

/** Build the /card URL from resolved geographies — district facts only. */
function cardPath(g: ResolvedGeographies): string {
  const params = new URLSearchParams();
  if (g.state) params.set("s", g.state.code.toLowerCase());
  if (g.congressionalDistrict) params.set("cd", g.congressionalDistrict.number);
  if (g.stateLegislativeUpper) params.set("su", g.stateLegislativeUpper.number);
  if (g.stateLegislativeLower) params.set("sl", g.stateLegislativeLower.number);
  // Geocoder-provided place facts — names only, no identifying information.
  // Used to render honest empty rows (Sheriff of X County, Mayor of Y).
  if (g.county?.name) params.set("cn", g.county.name);
  if (g.place?.name) params.set("pn", g.place.name);
  return `/card?${params.toString()}`;
}

export function AddressEntry({ variant = "hero" }: { variant?: "hero" | "plain" }) {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = (await res.json()) as {
        geographies?: ResolvedGeographies;
        error?: string;
      };

      if (!res.ok || !data.geographies) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Persist district IDs only — facts about a place, never the address.
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(data.geographies)
        );
      } catch {
        // localStorage may be unavailable (private mode); the URL still carries it.
      }

      router.push(cardPath(data.geographies));
    } catch {
      setError("Couldn't reach the address lookup. Please try again.");
      setLoading(false);
    }
  }

  const isHero = variant === "hero";

  return (
    <form onSubmit={onSubmit} className="w-full max-w-xl">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          inputMode="text"
          autoComplete="street-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Main St, City, ST 00000"
          aria-label="Your home address"
          className={
            isHero
              ? "flex-1 rounded bg-white/95 text-bc-navy placeholder:text-muted-foreground px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-bc-blush"
              : "flex-1 rounded border border-bc-light-lavender bg-white text-bc-navy placeholder:text-muted-foreground px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-bc-lavender"
          }
        />
        <button
          type="submit"
          disabled={loading || address.trim().length < 5}
          className="inline-flex items-center justify-center bg-bc-blush text-bc-navy font-medium text-sm px-6 py-3 rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? "Looking up…" : "See my ballot"}
        </button>
      </div>
      {error && (
        <p className={`mt-2 text-sm ${isHero ? "text-bc-blush" : "text-red-600"}`}>
          {error}
        </p>
      )}
      <p
        className={`mt-2 text-xs ${
          isHero ? "text-bc-lavender/80" : "text-muted-foreground"
        }`}
      >
        Your address is resolved to voting districts and immediately discarded.
        It is never stored or logged.
      </p>
    </form>
  );
}
