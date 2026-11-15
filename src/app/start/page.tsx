// Create a new care circle; codes and passcodes are shown once on success.
import type { Metadata } from "next";
import { createCircleAction } from "@/app/actions/auth";
import { CreateCircleForm } from "@/components/auth/create-circle-form";
import { PublicFrame } from "@/components/shell/public-frame";

export const metadata: Metadata = { title: "Create a circle" };

export default function StartPage() {
  return (
    <PublicFrame
      title="Create a care circle"
      intro="One circle per elder. You can add family and caretakers afterwards."
    >
      <CreateCircleForm action={createCircleAction} />
    </PublicFrame>
  );
}
