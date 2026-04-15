import { z } from "zod";

// ─── Shared field schemas ─────────────────────────────────────────────────────

export const UsernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Username can only contain letters, numbers, underscores, and hyphens"
  );

export const PasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters");

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
  // Loose hex-UUID regex — accepts any well-formed UUID including Zod v4's
  // stricter RFC 4122 check rejects our fixed test-seed UUIDs (version 0).
  // Production gen_random_uuid() values pass both; this accepts both.
  homeDistrictId: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "Please select a home district"
    ),
});

export const LoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ─── Shared UUID ─────────────────────────────────────────────────────────────
// Zod v4 .uuid() enforces RFC 4122 version nibble [1-8] — our seed UUIDs
// (version 0) fail. Use a loose hex regex that accepts any well-formed UUID.
const uuidField = (msg = "Invalid ID") =>
  z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      msg
    );

// ─── Content ─────────────────────────────────────────────────────────────────

export const CreatePostSchema = z.object({
  officeId: uuidField("Invalid office ID"),
  title: z.string().min(5, "Title must be at least 5 characters").max(300),
  body: z.string().min(10, "Body must be at least 10 characters").max(50000),
  featuredLinkUrl: z.string().url().optional().nullable(),
  tagIds: z.array(uuidField("Invalid tag ID")).max(10),
});

export const CreateReplySchema = z.object({
  parentPostId: uuidField("Invalid post ID"),
  body: z.string().min(1, "Reply cannot be empty").max(20000),
});

export const EditPostSchema = z.object({
  postId: uuidField("Invalid post ID"),
  title: z.string().min(5, "Title must be at least 5 characters").max(300).optional(),
  body: z.string().min(1, "Body cannot be empty").max(50000),
});

// ─── Elections ───────────────────────────────────────────────────────────────

export const CandidacySchema = z.object({
  electionId: uuidField("Invalid election ID"),
  statementShort: z
    .string()
    .min(10, "Statement must be at least 10 characters")
    .max(280),
  statementLong: z.string().max(5000).optional(),
});
