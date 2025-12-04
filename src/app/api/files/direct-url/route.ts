import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

// Zwraca bezpośredni (niepodpisany) URL do pliku w R2 oparty o R2_PUBLIC_HOSTNAME
// Uwaga: Działa tylko jeśli bucket/ścieżka jest publiczna przez ten host.
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
    const key = searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "Brak klucza pliku" }, { status: 400 });
    }

    // Uprawnienia: dozwolone pliki z własnej przestrzeni lub z 'main/' (dla uprawnionych)
    const userPrefix = `users/${decodedToken.uid}/`;
    if (!key.startsWith(userPrefix) && !key.startsWith("main/")) {
      return NextResponse.json(
        { error: "Brak dostępu do pliku" },
        { status: 403 }
      );
    }

    const r2Host = process.env.R2_PUBLIC_HOSTNAME;
    if (!r2Host) {
      return NextResponse.json(
        { error: "R2_PUBLIC_HOSTNAME nie jest skonfigurowane" },
        { status: 500 }
      );
    }

    const protocol = "https://";
    const directUrl = `${protocol}${r2Host}/${encodeURI(key)}`;

    return NextResponse.json({ directUrl });
  } catch (err) {
    console.error("Error in files/direct-url API:", err);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
