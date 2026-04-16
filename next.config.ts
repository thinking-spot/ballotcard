import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // experimental.instrumentationHook was stabilized in Next.js 15 — no flag needed.
};

export default withSentryConfig(nextConfig, {
  // Sentry organization + project slugs — set these as env vars in Vercel.
  // (Used for source map uploads during CI builds; not needed locally.)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for source map uploads — set SENTRY_AUTH_TOKEN in Vercel env.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress the Sentry plugin's verbose build output.
  silent: !process.env.CI,

  // Upload source maps to Sentry and delete them from the deployment bundle.
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
