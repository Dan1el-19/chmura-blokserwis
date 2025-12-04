import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { deleteFile } from "@/lib/storage";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Brak tokenu autoryzacji" },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await verifyToken(token);

    if (!decodedToken) {
      return NextResponse.json(
        { error: "Nieprawidłowy token" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "Brak klucza pliku" }, { status: 400 });
    }
    // Prostą walidację stringa już mamy; schemat zostawiamy na POST/PUT body

    // Sprawdź uprawnienia do pliku
    if (
      !key.startsWith(`users/${decodedToken.uid}/`) &&
      !key.startsWith("main/")
    ) {
      return NextResponse.json(
        { error: "Brak uprawnień do pliku" },
        { status: 403 }
      );
    }

    // Pobierz rozmiar pliku przed usunięciem
    let fileSize = 0;
    try {
      const { listFiles } = await import("@/lib/storage");
      const objects = await listFiles(key);
      if (objects.length > 0) {
        fileSize = objects[0].Size || 0;
      }
    } catch {}

    // Usuń plik
    await deleteFile(key);

    // Log delete and update storage
    try {
      const db = getFirestore();
      await db.collection("activityLogs").add({
        userId: decodedToken.uid,
        userEmail: decodedToken.email || "",
        action: "delete",
        fileName: key.split("/").pop(),
        fileSize,
        key,
        timestamp: FieldValue.serverTimestamp(),
        ipAddress:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      });

      // Aktualizuj używaną przestrzeń w profilu użytkownika (transakcyjnie)
      if (key.startsWith(`users/${decodedToken.uid}/`)) {
        const userDocRef = db.doc(`users/${decodedToken.uid}`);
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(userDocRef);
          const prev = snap.exists ? snap.data()?.storageUsed || 0 : 0;
          const next = Math.max(0, (prev as number) - fileSize);
          tx.set(
            userDocRef,
            { storageUsed: next, lastLogin: FieldValue.serverTimestamp() },
            { merge: true }
          );
        });
      }
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in delete API:", error);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
