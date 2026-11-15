// Sign in with circle code + personal passcode.
import type { Metadata } from "next";
import Link from "next/link";
import { signInAction } from "@/app/actions/auth";
import { SignInForm } from "@/components/auth/sign-in-form";
import { PublicFrame } from "@/components/shell/public-frame";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <PublicFrame title="Sign in" intro="Use your circle's code and your own 6-digit passcode.">
      <SignInForm action={signInAction} />
      <p className="mt-6 text-base">
        New here?{" "}
        <Link href="/start" className="font-semibold text-olive underline underline-offset-4">
          Create a care circle
        </Link>{" "}
        or{" "}
        <Link href="/" className="font-semibold text-olive underline underline-offset-4">
          try the demo
        </Link>
        .
      </p>
    </PublicFrame>
  );
}
