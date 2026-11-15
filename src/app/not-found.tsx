// 404 page.
import Link from "next/link";
import { PublicFrame } from "@/components/shell/public-frame";

export default function NotFound() {
  return (
    <PublicFrame title="Page not found" intro="That page doesn't exist or has been removed.">
      <Link href="/" className="font-semibold text-olive underline underline-offset-4">
        Go to the start
      </Link>
    </PublicFrame>
  );
}
