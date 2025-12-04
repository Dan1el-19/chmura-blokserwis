import { db } from "@/lib/firebaseAdmin";
import { randomBytes } from "crypto";

// Generate a 4-char id and ensure uniqueness in Firestore collection folders
export async function generateUniqueFolderId(): Promise<string> {
  if (!db) throw new Error("Firestore not initialized");
  const col = db.collection("folders");
  for (let i = 0; i < 10; i++) {
    const id = randomBytes(3)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 4)
      .toLowerCase();
    const snap = await col.where("shortId", "==", id).limit(1).get();
    if (snap.empty) return id;
  }
  // Fallback to timestamp based
  return Date.now().toString(36).slice(-4);
}
