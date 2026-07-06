import type { BreadcrumbItem } from "@/lib/office-data";
import type { OfficialData } from "@/lib/office-data";

const BASE = "https://ballot-card.com";

// Renders a JSON-LD block. "<" is escaped so officeholder names or titles can
// never close the script tag (classic JSON-in-HTML injection vector).
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function webSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "BallotCard",
    url: `${BASE}/`,
    description:
      "See your full ballot — every office you vote for, who holds each seat, who's running, and when your next election is. Free, anonymous, built from public data.",
  };
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      // The last crumb is the current page and carries no href by convention.
      ...(item.href ? { item: `${BASE}${item.href}` } : {}),
    })),
  };
}

export function officeholderSchema(
  official: OfficialData,
  officeTitle: string,
  pageUrl: string
) {
  // external_refs stores bare IDs/slugs; expand them the same way
  // OfficeholderCard does for its outbound links.
  const refs = official.externalRefs ?? {};
  const sameAs = [
    refs.wikipedia ? `https://en.wikipedia.org/wiki/${refs.wikipedia}` : null,
    refs.ballotpedia ? `https://ballotpedia.org/${refs.ballotpedia}` : null,
    refs.bioguide ? `https://www.congress.gov/member/${refs.bioguide}` : null,
    refs.openstates ? `https://openstates.org/person/${refs.openstates}` : null,
    refs.official_site || null,
  ].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: official.name,
    jobTitle: officeTitle,
    url: pageUrl,
    ...(official.photoUrl ? { image: official.photoUrl } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}
