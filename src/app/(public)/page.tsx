import { LandingHero } from "@/components/landing/LandingHero";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingNegations } from "@/components/landing/LandingNegations";
import { LandingProspects } from "@/components/landing/LandingProspects";
import { LandingFinalCta } from "@/components/landing/LandingFinalCta";

export const metadata = {
  // Absolute title so the root template's "| Find Your Ballot" suffix isn't
  // appended — this is THE landing page, the brand name belongs at the end.
  title: { absolute: "Find My Ballot | Sample Ballots & Election Info | BallotCard" },
  description:
    "Create an online version of your local ballot in seconds. From the senate to city hall, stay up to date on your representatives and your elections, 24/7.",
};

export default function LandingPage() {
  return (
    <>
      <LandingHero />
      <LandingHowItWorks />
      <LandingNegations />
      <LandingProspects />
      <LandingFinalCta />
    </>
  );
}
