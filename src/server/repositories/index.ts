// Chooses the repository implementation from DATA_BACKEND and keeps one instance per process.
import "server-only";
import { env } from "@/server/env";
import { MemoryRepository } from "./memory-repository";
import type { Repository } from "./repository";

const holder = globalThis as unknown as { __kinloopRepo?: Repository };

/** The process-wide repository (Firestore in production, in-memory for tests and local runs). */
export async function getRepository(): Promise<Repository> {
  if (holder.__kinloopRepo) return holder.__kinloopRepo;
  const { DATA_BACKEND, FIREBASE_SERVICE_ACCOUNT } = env();
  if (DATA_BACKEND === "firestore") {
    if (!FIREBASE_SERVICE_ACCOUNT)
      throw new Error("Invalid server configuration: FIREBASE_SERVICE_ACCOUNT");
    const [{ Firestore }, { FirestoreRepository, firestoreSettings }] = await Promise.all([
      import("@google-cloud/firestore"),
      import("./firestore-repository"),
    ]);
    holder.__kinloopRepo = new FirestoreRepository(
      new Firestore(firestoreSettings(FIREBASE_SERVICE_ACCOUNT)),
    );
  } else {
    holder.__kinloopRepo = new MemoryRepository();
  }
  return holder.__kinloopRepo;
}

/** Test hook: replaces the process-wide repository. */
export function setRepositoryForTests(repo: Repository): void {
  holder.__kinloopRepo = repo;
}
