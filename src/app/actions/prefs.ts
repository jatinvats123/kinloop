"use server";
// Per-device preferences stored in cookies so the first paint is already right: text size, and
// whether the demo tour panel is hidden.
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const SIZES = new Set(["normal", "large", "larger"]);

export async function setTextSizeAction(fd: FormData): Promise<void> {
  const size = String(fd.get("size") ?? "normal");
  (await cookies()).set("kl_text", SIZES.has(size) ? size : "normal", {
    path: "/",
    maxAge: 365 * 86400,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/", "layout");
}

/** Hides or shows the demo tour panel on this device. */
export async function setTourHiddenAction(fd: FormData): Promise<void> {
  (await cookies()).set("kl_tour", fd.get("hidden") === "1" ? "hidden" : "shown", {
    path: "/",
    maxAge: 86400,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/", "layout");
}
