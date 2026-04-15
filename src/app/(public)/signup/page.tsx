import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata = { title: "Sign up" };

export default async function SignupPage() {
  const session = await auth();
  if (session) redirect("/ballot");

  return (
    <div className="min-h-[calc(100vh-7rem)] flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-2xl text-bc-navy mb-2">
          Join BallotCard
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          A permanent, public record of what your elected officials do — and
          what residents make of it.
        </p>
        <SignupForm />
        <p className="mt-5 text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-bc-navy underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
