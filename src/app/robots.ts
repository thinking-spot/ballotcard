import type { MetadataRoute } from "next";

const BASE = "https://ballot-card.com";

// Crawl the permalink tree freely; keep crawlers out of the address-lookup
// result (/card spawns unbounded param combinations) and the API proxy.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/card", "/api/"],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
