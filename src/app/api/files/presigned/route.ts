import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { generatePresignedUrl } from "@/lib/storage";

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
    const op = (searchParams.get("op") || "get") as "get" | "put";
    if (!key) {
      return NextResponse.json({ error: "Brak klucza pliku" }, { status: 400 });
    }

    const userPrefix = `users/${decodedToken.uid}/`;
    if (!key.startsWith(userPrefix)) {
      if (!key.startsWith("main/")) {
        return NextResponse.json(
          { error: "Brak dostępu do pliku" },
          { status: 403 }
        );
      }
    }

    if (op === "put" && key.startsWith("users/")) {
    }

    const expirationSeconds = op === "put" ? 7200 : 300;

    const responseParams =
      op === "get"
        ? {
            "response-content-disposition": `attachment; filename="${encodeURIComponent(key.split("/").pop() || "file")}"`,
          }
        : undefined;

    const presignedUrl = await generatePresignedUrl(
      key,
      op,
      expirationSeconds,
      responseParams
    );

    return NextResponse.json({ presignedUrl });
  } catch (error) {
    console.error("Error in files/presigned API:", error);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
