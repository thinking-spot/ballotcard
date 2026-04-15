import { parse as parseHTML } from "node-html-parser";
import * as ipaddr from "ipaddr.js";
import dns from "node:dns/promises";

type LookupAddress = { address: string; family: number };

export type OGResult = {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  domain?: string;
  publishedAt?: string;
  fetchStatus: "ok" | "no_metadata" | "failed" | "timeout" | "blocked";
};

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB
const TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "BallotCard/1.0 (+https://ballotcard.org)";

/**
 * Check whether an IP address is private/reserved (SSRF protection).
 */
function isPrivateIP(ip: string): boolean {
  try {
    const addr = ipaddr.parse(ip);
    const range = addr.range();
    // Allow only unicast (public) addresses
    return range !== "unicast";
  } catch {
    // If we can't parse the IP, block it
    return true;
  }
}

/**
 * Resolve a hostname to IPs and verify none are private.
 * Returns the first public IP, or throws if all are private.
 */
async function resolveAndValidate(hostname: string): Promise<string> {
  // Block obvious localhost patterns before DNS
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "[::1]" ||
    lower === "0.0.0.0"
  ) {
    throw new Error("blocked");
  }

  let addresses: LookupAddress[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error("failed");
  }

  if (addresses.length === 0) throw new Error("failed");

  for (const addr of addresses) {
    if (!isPrivateIP(addr.address)) {
      return addr.address;
    }
  }

  // All resolved IPs are private
  throw new Error("blocked");
}

/**
 * Extract Open Graph / Twitter Card / fallback metadata from HTML.
 */
function extractMetadata(
  html: string,
  finalUrl: string
): Omit<OGResult, "fetchStatus"> {
  // Only parse the head to avoid processing large bodies
  const headEnd = html.indexOf("</head>");
  const headHtml = headEnd > -1 ? html.slice(0, headEnd + 7) : html;

  const root = parseHTML(headHtml, {
    comment: false,
    blockTextElements: { script: false, style: false },
  });

  const getMeta = (property: string): string | undefined => {
    const el =
      root.querySelector(`meta[property="${property}"]`) ??
      root.querySelector(`meta[name="${property}"]`);
    return el?.getAttribute("content") || undefined;
  };

  const title =
    getMeta("og:title") ??
    getMeta("twitter:title") ??
    root.querySelector("title")?.textContent?.trim() ??
    undefined;

  const description =
    getMeta("og:description") ??
    getMeta("twitter:description") ??
    getMeta("description") ??
    undefined;

  const imageUrl =
    getMeta("og:image") ?? getMeta("twitter:image") ?? undefined;

  const publishedAt =
    getMeta("article:published_time") ??
    getMeta("datePublished") ??
    undefined;

  let domain: string | undefined;
  try {
    domain = new URL(finalUrl).hostname.replace(/^www\./, "");
  } catch {
    // leave undefined
  }

  return {
    url: finalUrl,
    title: title?.slice(0, 500),
    description: description?.slice(0, 1000),
    imageUrl: imageUrl?.slice(0, 2000),
    domain,
    publishedAt,
  };
}

/**
 * Fetch Open Graph metadata from a URL with SSRF protection.
 *
 * Security measures:
 * - Only http:// and https:// schemes
 * - DNS resolution checked against private/reserved IP ranges
 * - 5-second total timeout
 * - 2 MB response size cap
 * - Max 5 redirects, each re-checked for private IPs
 */
export async function fetchOpenGraph(url: string): Promise<OGResult> {
  // 1. Validate URL scheme and syntax
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, fetchStatus: "failed" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { url, fetchStatus: "blocked" };
  }

  if (url.length > 4096) {
    return { url, fetchStatus: "failed" };
  }

  // 2. Resolve DNS and validate IP
  try {
    await resolveAndValidate(parsed.hostname);
  } catch (e) {
    const status = (e as Error).message === "blocked" ? "blocked" : "failed";
    return { url, fetchStatus: status };
  }

  // 3. Fetch with timeout and redirect following
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  let currentUrl = url;
  let redirectCount = 0;

  try {
    response = await fetch(currentUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html, application/xhtml+xml",
      },
      redirect: "manual",
    });

    // Follow redirects manually so we can check each destination
    while (
      response.status >= 300 &&
      response.status < 400 &&
      redirectCount < MAX_REDIRECTS
    ) {
      const location = response.headers.get("location");
      if (!location) break;

      const nextUrl = new URL(location, currentUrl);
      if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
        return { url, fetchStatus: "blocked" };
      }

      // Re-validate the redirect target's IP
      await resolveAndValidate(nextUrl.hostname);

      currentUrl = nextUrl.href;
      redirectCount++;

      response = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html, application/xhtml+xml",
        },
        redirect: "manual",
      });
    }

    if (!response.ok) {
      return { url, fetchStatus: "failed" };
    }
  } catch (e) {
    clearTimeout(timer);
    if ((e as Error).name === "AbortError") {
      return { url, fetchStatus: "timeout" };
    }
    return { url, fetchStatus: "failed" };
  } finally {
    clearTimeout(timer);
  }

  // 4. Read body with size cap
  let html: string;
  try {
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
      return { url, fetchStatus: "failed" };
    }

    const reader = response.body?.getReader();
    if (!reader) return { url, fetchStatus: "failed" };

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        reader.cancel();
        break;
      }
      chunks.push(value);
    }

    const decoder = new TextDecoder("utf-8", { fatal: false });
    html = decoder.decode(
      chunks.reduce((acc, chunk) => {
        const merged = new Uint8Array(acc.length + chunk.length);
        merged.set(acc);
        merged.set(chunk, acc.length);
        return merged;
      }, new Uint8Array(0))
    );
  } catch {
    return { url, fetchStatus: "failed" };
  }

  // 5. Extract metadata
  const metadata = extractMetadata(html, currentUrl);

  const hasOG = !!(metadata.title || metadata.description);
  return {
    ...metadata,
    url: currentUrl, // canonical URL after redirects
    fetchStatus: hasOG ? "ok" : "no_metadata",
  };
}
