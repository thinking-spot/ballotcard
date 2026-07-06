import { db } from "@/lib/supabase";
import { seatLabelToSlug } from "@/lib/seat-slug";

export type ResolvedSlug =
  | { kind: "office"; districtGeoSlug: string; officeSlug: string; seatSlug?: string }
  | { kind: "district"; geoSlug: string }
  | null;

// Reserved terminal segments are handled by other routes, not office slugs.
const RESERVED_SEGMENTS = new Set(["official"]);

/**
 * Resolves a Next.js catchall route (state + slug[]) to a typed discriminated
 * union so the page can render the correct surface.
 *
 * Resolution order:
 * 1. Try full path as a district geo_slug (handles /nc, /nc/07, /nc/new-hanover/wilmington)
 * 2. Try full-minus-last as district + last as office slug (handles /nc/07/us-house)
 * 3. Try full-minus-2 as district + office slug + trailing seat slug (handles
 *    multi-member districts, e.g. /vt/sldl-bennington-4/state-house/seat-1,
 *    where several Offices share one slug and only seat_label tells them apart)
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

    if (!RESERVED_SEGMENTS.has(officeSlug)) {
      const { data: district } = await db
        .from("Districts")
        .select("id")
        .eq("geo_slug", districtPath)
        .maybeSingle();

      if (district) {
        // A multi-member district's shared slug matches >1 row here — that's
        // ambiguous, so this split doesn't resolve it; step 3 below does.
        const { data: offices } = await db
          .from("Offices")
          .select("id, slug")
          .eq("district_id", district.id)
          .eq("slug", officeSlug);

        if (offices && offices.length === 1) {
          return {
            kind: "office",
            districtGeoSlug: districtPath,
            officeSlug: officeSlug,
          };
        }
      }
    }
  }

  // 3. Try splitting: everything-but-last-2 = district, then office slug,
  // then a trailing seat slug disambiguating a multi-member district's seats.
  if (segments.length >= 3) {
    const districtPath = segments.slice(0, -2).join("/");
    const officeSlug = segments[segments.length - 2];
    const seatSlug = segments[segments.length - 1];

    if (!RESERVED_SEGMENTS.has(officeSlug)) {
      const { data: district } = await db
        .from("Districts")
        .select("id")
        .eq("geo_slug", districtPath)
        .maybeSingle();

      if (district) {
        const { data: offices } = await db
          .from("Offices")
          .select("id, slug, seat_label")
          .eq("district_id", district.id)
          .eq("slug", officeSlug);

        const match = (offices ?? []).find(
          (o) => o.seat_label && seatLabelToSlug(o.seat_label as string) === seatSlug
        );
        if (match) {
          return {
            kind: "office",
            districtGeoSlug: districtPath,
            officeSlug: officeSlug,
            seatSlug,
          };
        }
      }
    }
  }

  return null;
}
