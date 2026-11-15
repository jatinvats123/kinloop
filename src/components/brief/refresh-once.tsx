"use client";
// Refreshes the server-rendered layout once after mount, so the demo tour panel (rendered in the
// layout alongside this page) shows the step this page just recorded.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RefreshOnce() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
  }, [router]);
  return null;
}
