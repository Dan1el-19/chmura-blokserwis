import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// GET - Pobierz wszystkie linki dla pliku
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
    const linksRef = db.collection("sharedFiles");
    const snapshot = await linksRef.where("key", "==", fileKey).get();

    const links: Array<{
      id: string;
      name: string;
      url: string;
      createdAt: Date;
      expiresAt: Date | null;
      isExpired: boolean;
    }> = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const expiresAt =
        data.expiresAt instanceof FieldValue ? null : data.expiresAt;

      // Sprawdź czy link nie wygasł
      if (!expiresAt || expiresAt.toDate().getTime() > Date.now()) {
        links.push({
          id: doc.id,
          name: data.name || "Bez nazwy",
          url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://chmura.blokserwis.pl"}/files/${doc.id}`,
          createdAt: data.createdAt?.toDate() || new Date(),
          expiresAt: expiresAt?.toDate() || null,
          isExpired: false,
        });
      } else {
        // Dodaj wygasłe linki z flagą
        links.push({
          id: doc.id,
          name: data.name || "Bez nazwy",
          url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://chmura.blokserwis.pl"}/files/${doc.id}`,
          createdAt: data.createdAt?.toDate() || new Date(),
          expiresAt: expiresAt?.toDate() || null,
          isExpired: true,
        });
      }
    });

    return NextResponse.json({ links });
  } catch (error) {
    console.error("Error in GET /api/files/links:", error);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}

// DELETE - Usuń link
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

    const body = await request.json();
    const { linkId } = body;

    if (!linkId) {
      return NextResponse.json({ error: "Brak ID linku" }, { status: 400 });
    }

    const db = getFirestore();
    const linkDoc = await db.collection("sharedFiles").doc(linkId).get();

    if (!linkDoc.exists) {
      return NextResponse.json({ error: "Link nie istnieje" }, { status: 404 });
    }

    const linkData = linkDoc.data();
    if (!linkData) {
      return NextResponse.json({ error: "Brak danych linku" }, { status: 400 });
    }

    // Sprawdź uprawnienia do pliku
    if (
      !linkData.key.startsWith(`users/${decodedToken.uid}/`) &&
      !linkData.key.startsWith("main/")
    ) {
      return NextResponse.json(
        { error: "Brak uprawnień do pliku" },
        { status: 403 }
      );
    }

    // Usuń link
    await db.collection("sharedFiles").doc(linkId).delete();

    // Log usunięcia
    try {
      await db.collection("activityLogs").add({
        userId: decodedToken.uid,
        userEmail: decodedToken.email || "",
        action: "delete_share",
        fileName: linkData.fileName || linkData.key.split("/").pop() || "file",
        linkName: linkData.name || "Bez nazwy",
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/files/links:", error);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}

// PATCH - Edytuj link (zmień nazwę lub czas ważności)
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { linkId, name, expiresIn, expiresAt: customExpiresAt } = body;

    if (!linkId) {
      return NextResponse.json({ error: "Brak ID linku" }, { status: 400 });
    }

    const db = getFirestore();
    const linkDoc = await db.collection("sharedFiles").doc(linkId).get();

    if (!linkDoc.exists) {
      return NextResponse.json({ error: "Link nie istnieje" }, { status: 404 });
    }

    const linkData = linkDoc.data();
    if (!linkData) {
      return NextResponse.json({ error: "Brak danych linku" }, { status: 400 });
    }

    // Sprawdź uprawnienia do pliku
    if (
      !linkData.key.startsWith(`users/${decodedToken.uid}/`) &&
      !linkData.key.startsWith("main/")
    ) {
      return NextResponse.json(
        { error: "Brak uprawnień do pliku" },
        { status: 403 }
      );
    }

    // Przygotuj dane do aktualizacji
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (customExpiresAt || expiresIn) {
      let newExpiresAt: Date;
      if (customExpiresAt) {
        newExpiresAt = new Date(customExpiresAt);
      } else if (expiresIn) {
        newExpiresAt = new Date(Date.now() + expiresIn * 1000);
      } else {
        return NextResponse.json(
          { error: "Nieprawidłowe dane wygaśnięcia" },
          { status: 400 }
        );
      }

      updateData.expiresAt = newExpiresAt;
    }

    // Aktualizuj link
    await db.collection("sharedFiles").doc(linkId).update(updateData);

    // Log edycji
    try {
      await db.collection("activityLogs").add({
        userId: decodedToken.uid,
        userEmail: decodedToken.email || "",
        action: "edit_share",
        fileName: linkData.fileName || linkData.key.split("/").pop() || "file",
        linkName: linkData.name || "Bez nazwy",
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in PATCH /api/files/links:", error);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
