import * as Sentry from "@sentry/nextjs";
import type { ErrorEvent } from "@sentry/nextjs";

// The geocoder is the only path where a resident's address is ever in flight.
// Defense in depth: drop any event that originated from the Census host, and
// strip request data (URL, query string, headers, body) plus the client IP from
// every event before it leaves the process. An address must never ride along in
// an error report — privacy is architecture here, not policy.
const CENSUS_HOST = "geocoding.geo.census.gov";

function scrubPii(event: ErrorEvent): ErrorEvent | null {
  if ((event.request?.url ?? "").includes(CENSUS_HOST)) return null;
  delete event.request;
  if (event.user) delete event.user.ip_address;
  return event;
}

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    debug: false,
    beforeSend: scrubPii,
    denyUrls: [/geocoding\.geo\.census\.gov/],
  });
}
