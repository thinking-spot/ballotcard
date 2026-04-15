import { db } from "@/lib/supabase";

export type ResolvedSlug =
  | { kind: "office"; districtGeoSlug: string; officeSlug: string }
  | { kind: "district"; geoSlug: string }
  | null;

/**
 * Resolves a Next.js catchall route (state + slug[]) to a typed discriminated
 * union so the page can render the correct surface.
 *
 * Resolution order:
 * 1. Try full path as a district geo_slug (handles /nc, /nc/07, /nc/new-hanover/wilmington)
 * 2. Try full-minus-last as district + last as office slug (handles /nc/07/us-house)
 */
export async function resolveSlug(
  state: string,
  slug: string[]
): Promise<ResolvedSlug> {
  const segments = [state, ...slug];
  const fullPath = segments.join("/");

  // 1. Exact district match
  const { data: exactDistrict } = await db
    .from("Districts")
    .select("id, geo_slug")
    .eq("geo_slug", fullPath)
    .maybeSingle();

  if (exactDistrict) {
    return { kind: "district", geoSlug: exactDistrict.geo_slug as string };
  }

  // 2. Try splitting: everything-but-last = district path, last = office slug
  if (segments.length >= 2) {
    const districtPath = segments.slice(0, -1).join("/");
    const officeSlug = segments[segments.length - 1];

    // Skip obviously non-office terminal segments
    const reservedSegments = new Set([
      "post", "election", "moderate", "candidacy", "vote",
      "new", "edit", "reply",
    ]);
    if (!reservedSegments.has(officeSlug)) {
      const { data: district } = await db
        .from("Districts")
        .select("id")
        .eq("geo_slug", districtPath)
        .maybeSingle();

      if (district) {
        const { data: office } = await db
          .from("Offices")
          .select("id, slug")
          .eq("district_id", district.id)
          .eq("slug", officeSlug)
          .maybeSingle();

        if (office) {
          return {
            kind: "office",
            districtGeoSlug: districtPath,
            officeSlug: officeSlug,
          };
        }
      }
    }
  }

  return null;
}
