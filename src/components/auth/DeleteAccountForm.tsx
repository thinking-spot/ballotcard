"use client";

import { useActionState } from "react";
import { deleteAccountAction } from "@/lib/actions";

type Props = {
  username: string;
};

export function DeleteAccountForm({ username }: Props) {
  const [error, action, pending] = useActionState(deleteAccountAction, null);

  return (
    <form action={action} className="flex flex-col gap-4 max-w-sm">
      <p className="text-sm text-bc-navy leading-relaxed">
        Your posts remain in the archive — they are part of the public record.
        Authorship will be redacted to{" "}
        <span className="font-mono text-xs">[deleted]</span>. This cannot be
        undone.
      </p>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="confirm"
          className="text-sm text-bc-navy font-medium"
        >
          Type <span className="font-mono font-bold">{username}</span> to
          confirm
        </label>
        <input
          id="confirm"
          name="confirm"
          type="text"
          autoComplete="off"
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
        className="bg-destructive text-white text-sm font-medium px-4 py-2.5 rounded hover:opacity-90 transition-opacity disabled:opacity-50 self-start"
      >
        {pending ? "Deleting…" : "Delete account"}
      </button>
    </form>
  );
}
