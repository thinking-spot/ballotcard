import { LandingHero } from "@/components/landing/LandingHero";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingCommitments } from "@/components/landing/LandingCommitments";
import { LandingProspects } from "@/components/landing/LandingProspects";
import { LandingFinalCta } from "@/components/landing/LandingFinalCta";

export const metadata = {
  // Absolute title so the root template's "| Find Your Ballot" suffix isn't
  // appended — this is THE landing page, the brand name belongs at the end.
  title: { absolute: "Find My Ballot | Sample Ballots & Election Info | BallotCard" },
  description:
    "See your full ballot in seconds — every office you vote for, who holds each seat, who's running, and when your next election is. Free, anonymous, built from public data.",
};

export default function LandingPage() {
  return (
    <>
      <LandingHero />
      <LandingHowItWorks />
      <LandingCommitments />
      <LandingProspects />
      <LandingFinalCta />
    </>
  );
}
