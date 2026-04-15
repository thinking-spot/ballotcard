import { redirect } from "next/navigation";
import { getPostCanonicalPath } from "@/lib/office-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;

  // Validate UUID format
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      postId
    )
  ) {
    return new Response("Not found", { status: 404 });
  }

  const canonicalPath = await getPostCanonicalPath(postId);

  if (!canonicalPath) {
    return new Response("Not found", { status: 404 });
  }

  redirect(canonicalPath);
}
