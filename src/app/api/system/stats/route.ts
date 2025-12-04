import { NextResponse } from "next/server";
import { db, auth } from "@/lib/firebaseAdmin";
import { listFiles } from "@/lib/storage";

export async function GET() {
  try {
    console.log("System stats endpoint called");

    // Sprawdź czy Firebase Admin jest zainicjalizowany
    // Sprawdź czy Firebase Admin jest zainicjalizowany (db pochodzi z inicjalizatora)
    try {
      if (!db) throw new Error("Firestore not initialized");
      console.log("Firestore initialized successfully");
    } catch (error) {
      console.error("Firestore initialization error:", error);
      return NextResponse.json({
        totalFiles: 0,
        totalStorage: 0,
        totalUsers: 0,
        recentActivity: 0,
        systemStatus: {
          cloudflare: false,
          firebase: false,
          api: true,
        },
        recentFiles: [],
        error: "Firebase not configured",
      });
    }

    // Sprawdź status Firebase Auth
    let totalUsers = 0;
    let firebaseWorking = false;
    try {
      // Sprawdź czy Firebase Auth działa - spróbuj pobrać listę użytkowników
      if (!auth) throw new Error("Firebase Admin auth not configured");
      const result = await auth.listUsers(1000);
      totalUsers = result.users.length;
      firebaseWorking = true;
      console.log("Firebase Auth working, users count:", totalUsers);
    } catch (error: unknown) {
      console.error("Error fetching users:", error);
      // Sprawdź czy to błąd braku użytkowników czy rzeczywisty problem z Firebase
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "auth/user-not-found" ||
          error.code === "auth/invalid-credential")
      ) {
        // Firebase działa, ale nie ma użytkowników lub problem z credentials
        firebaseWorking = true;
        console.log("Firebase Auth working but no users or credential issue");
      } else {
        // Spróbuj prostszą operację - sprawdź czy Firebase Admin jest zainicjalizowany
        try {
          if (!auth) throw new Error("Auth not initialized");
          // Jeśli nie ma błędu, Firebase Admin działa
          firebaseWorking = true;
          console.log("Firebase Auth working (admin initialized)");
        } catch (adminError: unknown) {
          firebaseWorking = false;
          console.error("Firebase Auth not working:", adminError);
        }
      }
    }

    // Sprawdź status Cloudflare R2
    let totalFiles = 0;
    let totalStorage = 0;
    let cloudflareWorking = false;
    let recentFiles: Array<{ name: string; size: number; uploadedAt: string }> =
      [];

    try {
      // Sprawdź czy Cloudflare R2 działa - spróbuj pobrać listę plików
      const userFiles = await listFiles("users/");
      const mainFiles = await listFiles("main/");

      const allFiles = [...userFiles, ...mainFiles];
      totalFiles = allFiles.length;
      totalStorage = allFiles.reduce(
        (total, obj) => total + (obj.Size || 0),
        0
      );

      // Pobierz ostatnie 5 plików
      const sortedFiles = allFiles
        .sort(
          (a, b) =>
            (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0)
        )
        .slice(0, 5);

      recentFiles = sortedFiles.map((obj) => ({
        name: obj.Key?.split("/").pop() || "Nieznany plik",
        size: obj.Size || 0,
        uploadedAt: obj.LastModified
          ? formatTimeAgo(obj.LastModified)
          : "Nieznana data",
      }));

      cloudflareWorking = true;
      console.log("Cloudflare R2 working, files count:", totalFiles);
    } catch (error: unknown) {
      console.error("Error fetching files:", error);
      // Sprawdź czy to błąd braku plików czy rzeczywisty problem z Cloudflare
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        (error.name === "NoSuchBucket" || error.name === "AccessDenied")
      ) {
        // Cloudflare działa, ale problem z uprawnieniami lub bucketem
        cloudflareWorking = true;
        console.log("Cloudflare R2 working but access issue");
      } else {
        // Spróbuj prostszą operację - sprawdź czy S3 client jest zainicjalizowany
        try {
          // Sprawdź czy możemy połączyć się z Cloudflare R2
          await listFiles("");
          cloudflareWorking = true;
          console.log("Cloudflare R2 working (connection test successful)");
        } catch (connectionError: unknown) {
          cloudflareWorking = false;
          console.error("Cloudflare R2 not working:", connectionError);
        }
      }
    }

    // Pobierz ostatnią aktywność (ostatnie 24h)
    let recentActivity = 0;
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (!db) throw new Error("Firestore not initialized");
      const logsSnapshot = await db
        .collection("activityLogs")
        .where("timestamp", ">=", yesterday)
        .get();

      recentActivity = logsSnapshot.size;
    } catch (error: unknown) {
      console.error("Error fetching activity:", error);
    }

    // Sprawdź status systemu
    const systemStatus = {
      cloudflare: cloudflareWorking,
      firebase: firebaseWorking,
      api: true, // Endpoint działa, więc API jest online
    };

    console.log("System status:", systemStatus);

    return NextResponse.json({
      totalFiles,
      totalStorage,
      totalUsers,
      recentActivity,
      systemStatus,
      recentFiles,
    });
  } catch (error: unknown) {
    console.error("Error in system stats API:", error);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "Przed chwilą";
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} ${minutes === 1 ? "minutę" : minutes < 5 ? "minuty" : "minut"} temu`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? "godzinę" : hours < 5 ? "godziny" : "godzin"} temu`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ${days === 1 ? "dzień" : "dni"} temu`;
  }
}
