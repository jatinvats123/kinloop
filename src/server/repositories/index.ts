// Chooses the repository implementation from DATA_BACKEND and keeps one instance per process.
import "server-only";
import { env } from "@/server/env";
import { MemoryRepository } from "./memory-repository";
import { singletons } from "@/server/singletons";
import type { Repository } from "./repository";

/** The process-wide repository (Firestore in production, in-memory for tests and local runs). */
export async function getRepository(): Promise<Repository> {
  const holder = singletons();
  if (holder.repository) return holder.repository;
  const { DATA_BACKEND, FIREBASE_SERVICE_ACCOUNT } = env();
  if (DATA_BACKEND === "firestore") {
    if (!FIREBASE_SERVICE_ACCOUNT)
      throw new Error("Invalid server configuration: FIREBASE_SERVICE_ACCOUNT");
    const [{ Firestore }, { FirestoreRepository, firestoreSettings }] = await Promise.all([
      import("@google-cloud/firestore"),
      import("./firestore-repository"),
    ]);
    holder.repository = new FirestoreRepository(
      new Firestore(firestoreSettings(FIREBASE_SERVICE_ACCOUNT)),
    );
  } else {
    holder.repository = new MemoryRepository();
  }
  return holder.repository;
}

/** Test hook: replaces the process-wide repository. */
export function setRepositoryForTests(repo: Repository): void {
  singletons().repository = repo;
}
