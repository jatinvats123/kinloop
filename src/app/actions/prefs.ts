"use server";
// Per-device comfort preference: text size, stored in a cookie so the first paint is already right.
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
