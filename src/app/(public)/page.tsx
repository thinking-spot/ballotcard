import { LandingHero } from "@/components/landing/LandingHero";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingNegations } from "@/components/landing/LandingNegations";
import { LandingProspects } from "@/components/landing/LandingProspects";
import { LandingFinalCta } from "@/components/landing/LandingFinalCta";

export const metadata = {
  title: "BallotCard",
  description:
    "Enter your address, see everyone who represents you — a faithful recreation of your actual ballot, federal to local. No account, no ads, no tracking.",
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
