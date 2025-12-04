import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/firebaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Nieprawidłowy adres email" },
        { status: 400 }
      );
    }

    // Podstawowa walidacja email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Nieprawidłowy format adresu email" },
        { status: 400 }
      );
    }

    if (!auth) {
      return NextResponse.json(
        { error: "Błąd serwera - brak konfiguracji admin" },
        { status: 500 }
      );
    }

    try {
      // Sprawdź czy użytkownik istnieje w Firebase Auth
      await auth.getUserByEmail(email);

      // Jeśli użytkownik istnieje, zwróć pozytywną odpowiedź
      return NextResponse.json({ exists: true });
    } catch (error: unknown) {
      // Jeśli użytkownik nie istnieje
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "auth/user-not-found"
      ) {
        return NextResponse.json({ exists: false });
      }

      // Inne błędy Firebase Auth
      console.error("Firebase Auth error:", error);
      return NextResponse.json(
        { error: "Błąd sprawdzania użytkownika" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("User check error:", error);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
