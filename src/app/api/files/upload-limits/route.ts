import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getFirestore } from "firebase-admin/firestore";

export async function GET(request: NextRequest) {
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

    const db = getFirestore();

    // Pobierz dane użytkownika
    const userDoc = await db.doc(`users/${decodedToken.uid}`).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    // Sprawdź aktywne uploady użytkownika
    const activeUploadsQuery = await db
      .collection("activityLogs")
      .where("userId", "==", decodedToken.uid)
      .where("action", "in", ["queue_started", "multipart_initiated"])
      .where("timestamp", ">", new Date(Date.now() - 30 * 60 * 1000)) // Ostatnie 30 minut
      .get();

    const activeUploads = activeUploadsQuery.docs.length;

    // Limity na podstawie roli użytkownika
    const userRole = userData?.role || "user";
    let maxConcurrentUploads = 2; // Domyślny limit
    let maxFileSize = 100 * 1024 * 1024; // 100MB
    let maxStorageLimit = 5 * 1024 * 1024 * 1024; // 5GB

    switch (userRole) {
      case "admin":
        maxConcurrentUploads = 5;
        maxFileSize = 10 * 1024 * 1024 * 1024; // 10GB
        maxStorageLimit = 100 * 1024 * 1024 * 1024; // 100GB
        break;
      case "plus":
        maxConcurrentUploads = 3;
        maxFileSize = 2 * 1024 * 1024 * 1024; // 2GB
        maxStorageLimit = 20 * 1024 * 1024 * 1024; // 20GB
        break;
      case "user":
      default:
        maxConcurrentUploads = 2;
        maxFileSize = 100 * 1024 * 1024; // 100MB
        maxStorageLimit = 5 * 1024 * 1024 * 1024; // 5GB
        break;
    }

    const currentStorageUsed = userData?.storageUsed || 0;
    const remainingStorage = Math.max(0, maxStorageLimit - currentStorageUsed);

    return NextResponse.json({
      limits: {
        maxConcurrentUploads,
        maxFileSize,
        maxStorageLimit,
        currentStorageUsed,
        remainingStorage,
      },
      current: {
        activeUploads,
        canStartNewUpload: activeUploads < maxConcurrentUploads,
      },
      userRole,
    });
  } catch (error) {
    console.error("Błąd podczas sprawdzania limitów uploadu:", error);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
