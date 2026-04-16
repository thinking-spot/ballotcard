import * as Sentry from "@sentry/nextjs";

// Only initializes when NEXT_PUBLIC_SENTRY_DSN is set (production).
// In local dev the env var is absent and this is a no-op.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Capture 10% of traces — adjust after traffic is known.
    tracesSampleRate: 0.1,
    // No session replays — BallotCard content is public, but we don't want
    // replay data from logged-in users without explicit consent.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    debug: false,
  });
}
