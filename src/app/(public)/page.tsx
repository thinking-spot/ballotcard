import { LandingHero } from "@/components/landing/LandingHero";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingNegations } from "@/components/landing/LandingNegations";
import { LandingProspects } from "@/components/landing/LandingProspects";
import { LandingFinalCta } from "@/components/landing/LandingFinalCta";

export const metadata = {
  title: "BallotCard",
  description:
    "A powerless, parallel government structure for public civic accountability.",
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
