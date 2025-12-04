import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// GET - Pobierz statystyki użycia linków dla pliku
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

    const { searchParams } = new URL(request.url);
    const fileKey = searchParams.get("fileKey");

    if (!fileKey) {
      return NextResponse.json({ error: "Brak klucza pliku" }, { status: 400 });
    }

    // Sprawdź uprawnienia do pliku
    if (
      !fileKey.startsWith(`users/${decodedToken.uid}/`) &&
      !fileKey.startsWith("main/")
    ) {
      return NextResponse.json(
        { error: "Brak uprawnień do pliku" },
        { status: 403 }
      );
    }

    const db = getFirestore();

    // Pobierz wszystkie linki dla tego pliku
    const linksSnapshot = await db
      .collection("sharedFiles")
      .where("key", "==", fileKey)
      .get();

    const linkIds = linksSnapshot.docs.map((doc) => doc.id);

    if (linkIds.length === 0) {
      return NextResponse.json({
        stats: {
          totalClicks: 0,
          uniqueVisitors: 0,
          recentActivity: [],
          linkStats: [],
        },
      });
    }

    // Pobierz statystyki użycia dla wszystkich linków
    let usageData: Array<{
      id: string;
      linkId: string;
      linkName: string;
      fileName: string;
      accessedAt: Date;
      userAgent: string;
      ipAddress: string;
    }> = [];

    try {
      // Firestore ma limit 10 elementów dla zapytań 'in'
      if (linkIds.length <= 10) {
        const usageSnapshot = await db
          .collection("linkUsage")
          .where("linkId", "in", linkIds)
          .orderBy("accessedAt", "desc")
          .get();

        usageData = usageSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            linkId: data.linkId,
            linkName: data.linkName,
            fileName: data.fileName,
            accessedAt:
              data.accessedAt instanceof Timestamp
                ? data.accessedAt.toDate()
                : data.accessedAt,
            userAgent: data.userAgent,
            ipAddress: data.ipAddress,
          };
        });
      } else {
        // Jeśli więcej niż 10 linków, pobierz wszystkie i przefiltruj
        const usageSnapshot = await db
          .collection("linkUsage")
          .orderBy("accessedAt", "desc")
          .get();

        usageData = usageSnapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              linkId: data.linkId,
              linkName: data.linkName,
              fileName: data.fileName,
              accessedAt:
                data.accessedAt instanceof Timestamp
                  ? data.accessedAt.toDate()
                  : data.accessedAt,
              userAgent: data.userAgent,
              ipAddress: data.ipAddress,
            };
          })
          .filter((u) => linkIds.includes(u.linkId));
      }
    } catch (usageError) {
      console.error("Error fetching link usage:", usageError);
      // Jeśli nie można pobrać statystyk, zwróć puste dane
      usageData = [];
    }

    // Oblicz statystyki
    const totalClicks = usageData.length;
    const uniqueVisitors = new Set(usageData.map((u) => u.ipAddress)).size;

    // Ostatnia aktywność (ostatnie 10 kliknięć)
    const recentActivity = usageData.slice(0, 10);

    // Statystyki per link
    const linkStats = linkIds.map((linkId) => {
      const linkUsage = usageData.filter((u) => u.linkId === linkId);
      const linkDoc = linksSnapshot.docs.find((doc) => doc.id === linkId);
      const linkData = linkDoc?.data();

      return {
        linkId,
        linkName: linkData?.name || "Bez nazwy",
        totalClicks: linkUsage.length,
        uniqueVisitors: new Set(linkUsage.map((u) => u.ipAddress)).size,
        lastAccessed: linkUsage.length > 0 ? linkUsage[0].accessedAt : null,
        createdAt:
          linkData?.createdAt instanceof Timestamp
            ? linkData.createdAt.toDate()
            : linkData?.createdAt,
      };
    });

    return NextResponse.json({
      stats: {
        totalClicks,
        uniqueVisitors,
        recentActivity,
        linkStats,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/files/stats:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
