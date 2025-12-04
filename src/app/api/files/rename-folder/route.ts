import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { initializeS3Client, getBucketName, listFiles } from "@/lib/storage";
import { db } from "@/lib/firebaseAdmin";

// POST /api/files/rename-folder body: { path: string; newName: string }
// path must end with '/'
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
    if (!decoded)
      return NextResponse.json(
        { error: "Nieprawidłowy token" },
        { status: 401 }
      );

    const body = (await request.json().catch(() => null)) as {
      path?: string;
      newName?: string;
    } | null;
    if (!body?.path || !body?.newName)
      return NextResponse.json({ error: "Brak parametrów" }, { status: 400 });

    let { path, newName } = body;
    path = path.trim();
    newName = newName.trim();
    if (!path.endsWith("/"))
      return NextResponse.json(
        { error: "Ścieżka musi kończyć się /" },
        { status: 400 }
      );
    if (!/^[\w\-. ]{1,64}$/.test(newName))
      return NextResponse.json(
        { error: "Nieprawidłowa nazwa" },
        { status: 400 }
      );
    if (path.includes(".."))
      return NextResponse.json(
        { error: "Nieprawidłowa ścieżka" },
        { status: 400 }
      );

    const isPersonal = path.startsWith(`users/${decoded.uid}/`);
    const isMain = path.startsWith("main/");
    if (!isPersonal && !isMain)
      return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });
    if (isMain) {
      const role = (decoded as { role?: string } | undefined)?.role || "basic";
      if (role !== "admin" && role !== "plus")
        return NextResponse.json(
          { error: "Brak uprawnień do folderu głównego" },
          { status: 403 }
        );
    }

    // Determine new path (same parent)
    const parts = path.split("/").filter(Boolean); // remove empty
    if (parts.length === 0)
      return NextResponse.json(
        { error: "Nieprawidłowa ścieżka" },
        { status: 400 }
      );
    const oldName = parts[parts.length - 1];
    const parentParts = parts.slice(0, -1);
    const parentPrefix = parentParts.length ? parentParts.join("/") + "/" : "";
    const newPath = parentPrefix + newName + "/";
    if (newPath === path) return NextResponse.json({ success: true, path });

    // List objects of old folder
    const objects = await listFiles(path);
    const client = initializeS3Client();
    const bucket = getBucketName();
    const { CopyObjectCommand, DeleteObjectCommand } =
      await import("@aws-sdk/client-s3");

    // Copy each object to new prefix
    for (const obj of objects) {
      if (!obj.Key) continue;
      const suffix = obj.Key.substring(path.length); // relative part after old folder prefix
      const newKey = newPath + suffix;
      await client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          Key: newKey,
          CopySource: `${bucket}/${obj.Key}`,
        })
      );
    }
    // After copying, delete old objects
    for (const obj of objects) {
      if (!obj.Key) continue;
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key })
      );
    }

    // Firestore metadata update (also update slug to reflect new name while preserving shortId)
    let newSlug: string | undefined;
    if (db) {
      try {
        const snaps = await db
          .collection("folders")
          .where("path", "==", path)
          .limit(1)
          .get();
        if (!snaps.empty) {
          const doc = snaps.docs[0];
          const data = doc.data() as { shortId?: string; slug?: string };
          if (data?.shortId) newSlug = `${newName}-${data.shortId}`; // maintain same shortId
          await doc.ref.update({
            name: newName,
            path: newPath,
            ...(newSlug ? { slug: newSlug } : {}),
            updatedAt: new Date(),
          });
        }
      } catch (err) {
        console.error("Folder rename meta error", err);
      }
    }

    return NextResponse.json({
      success: true,
      path: newPath,
      oldName,
      newName,
      slug: newSlug,
    });
  } catch (e) {
    console.error("rename-folder error", e);
    return NextResponse.json(
      { error: "Błąd zmiany nazwy folderu" },
      { status: 500 }
    );
  }
}
