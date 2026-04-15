"use client";

import { useActionState } from "react";
import { authenticate } from "@/lib/actions";

type Props = {
  callbackUrl?: string;
};

export function LoginForm({ callbackUrl }: Props) {
  const [error, action, pending] = useActionState(authenticate, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      {callbackUrl && (
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-sm text-bc-navy font-medium">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoFocus
          required
          className="border border-bc-light-lavender rounded px-3 py-2 text-sm text-bc-navy bg-bc-offwhite focus:outline-none focus:ring-2 focus:ring-bc-lavender"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm text-bc-navy font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="border border-bc-light-lavender rounded px-3 py-2 text-sm text-bc-navy bg-bc-offwhite focus:outline-none focus:ring-2 focus:ring-bc-lavender"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-bc-navy text-bc-offwhite text-sm font-medium px-4 py-2.5 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
