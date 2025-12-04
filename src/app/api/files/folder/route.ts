import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { initializeS3Client, getBucketName } from "@/lib/storage";
import { db } from "@/lib/firebaseAdmin";
import { generateUniqueFolderId } from "@/lib/folderIds";

// Create a 'folder' by putting a zero-length object with a trailing slash (or .keep) so that listing shows the prefix
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Brak tokenu autoryzacji" },
        { status: 401 }
      );
    }
    const token = authHeader.split("Bearer ")[1];
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: "Nieprawidłowy token" },
        { status: 401 }
      );
    }
    const body = (await request.json().catch(() => null)) as {
      folder?: string;
      name?: string;
    } | null;
    if (!body || !body.name) {
      return NextResponse.json(
        { error: "Brak nazwy folderu" },
        { status: 400 }
      );
    }
    const rawName = body.name.trim();
    if (!/^[\w\-. ]{1,64}$/.test(rawName)) {
      return NextResponse.json(
        { error: "Nieprawidłowa nazwa folderu" },
        { status: 400 }
      );
    }
    const targetFolder = body.folder === "main" ? "main" : "personal";
    // Authorization for main folder: only plus/admin (reuse same check as list route ideally - simplified here)
    if (targetFolder === "main") {
      // Minimal role check could be added here if needed; assume verifyToken provides custom claims (role) via decoded?.role
      const role = (decoded as { role?: string } | undefined)?.role || "basic";
      if (role !== "admin" && role !== "plus") {
        return NextResponse.json(
          { error: "Brak uprawnień do folderu głównego" },
          { status: 403 }
        );
      }
    }
    const prefix =
      targetFolder === "personal" ? `users/${decoded.uid}/` : "main/";
    // Use trailing slash to designate folder
    const folderKey = `${prefix}${rawName}/.keep`; // .keep marker so list shows something if empty

    // Firestore metadata with unique shortId (for future pretty routing)
    let shortId: string | null = null;
    let slug: string | null = null;
    if (db) {
      try {
        shortId = await generateUniqueFolderId();
        slug = `${rawName}-${shortId}`;
        const docRef = db.collection("folders").doc();
        await docRef.set({
          name: rawName,
          shortId,
          slug,
          path: folderKey.replace(/\.keep$/, ""),
          owner: targetFolder === "personal" ? decoded.uid : "main",
          space: targetFolder,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (err) {
        console.error("Firestore folder metadata error", err);
      }
    }

    const client = initializeS3Client();
    const bucket = getBucketName();
    await client.send(
      new (await import("@aws-sdk/client-s3")).PutObjectCommand({
        Bucket: bucket,
        Key: folderKey,
        Body: "",
        ContentType: "application/x-directory",
      })
    );
    return NextResponse.json({ success: true, key: folderKey, shortId, slug });
  } catch (e) {
    console.error("Folder create error", e);
    return NextResponse.json(
      { error: "Błąd tworzenia folderu" },
      { status: 500 }
    );
  }
}
