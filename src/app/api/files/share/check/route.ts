import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db as adminDb } from "@/lib/firebaseAdmin";

async function checkSlugExists(slug: string): Promise<boolean> {
  const db = adminDb;
  if (!db) return false;
  const doc = await db.collection("sharedFiles").doc(slug).get();
  return doc.exists;
}

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
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { error: "Brak parametru slug" },
        { status: 400 }
      );
    }

    if (slug.length > 50) {
      return NextResponse.json(
        { error: "Slug za długi (max 50 znaków)", valid: false },
        { status: 400 }
      );
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Nieprawidłowy format slug", valid: false },
        { status: 400 }
      );
    }

    const exists = await checkSlugExists(slug);

    return NextResponse.json({
      slug,
      exists,
      available: !exists,
    });
  } catch (error) {
    console.error("Error checking slug:", error);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
