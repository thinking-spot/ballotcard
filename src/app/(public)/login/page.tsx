import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Log in" };

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const session = await auth();
  if (session) redirect("/ballot");

  const { next } = await searchParams;

  return (
    <div className="min-h-[calc(100vh-7rem)] flex items-start justify-center pt-20 px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-2xl text-bc-navy mb-6">Log in</h1>
        <LoginForm callbackUrl={next} />
        <p className="mt-5 text-sm text-center text-muted-foreground">
          No account?{" "}
          <Link href="/signup" className="text-bc-navy underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
