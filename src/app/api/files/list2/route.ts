import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { listFiles } from "@/lib/storage";
import { db } from "@/lib/firebaseAdmin";
import { FileItem, FolderItem } from "@/types";

// GET /api/files/list2?folder=personal|main
// MVP: top-level folders derived from key prefixes; no nested path yet
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
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: "Nieprawidłowy token" },
        { status: 401 }
      );
    }
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") === "main" ? "main" : "personal";
    const pathParam = (searchParams.get("path") || "")
      .replace(/^\/+/, "")
      .replace(/\.\./g, "");
    const basePrefix =
      folder === "personal" ? `users/${decoded.uid}/` : "main/";
    const prefix =
      basePrefix +
      (pathParam
        ? pathParam.endsWith("/")
          ? pathParam
          : pathParam + "/"
        : "");

    const objects = await listFiles(prefix);

    const folderSet = new Map<string, FolderItem>();
    const files: FileItem[] = [];

    for (const obj of objects) {
      const key = obj.Key!;
      if (!key.startsWith(prefix)) continue;
      const rest = key.substring(prefix.length); // portion after current level prefix
      if (rest.length === 0) continue; // skip base
      // Remove .keep marker from folder representation
      if (rest.endsWith("/.keep")) {
        const folderName = rest.slice(0, -"/.keep".length);
        // Only show immediate children: ignore nested deeper than one segment relative to current prefix
        if (!folderName.includes("/")) {
          const firstSeg = folderName;
          if (!folderSet.has(firstSeg)) {
            const baseFolder: FolderItem = {
              type: "folder",
              name: firstSeg,
              path: prefix + firstSeg + "/",
              parentPath: prefix,
              owner: decoded.uid,
              space: folder,
            };
            if (db) {
              try {
                const metaSnap = await db
                  .collection("folders")
                  .where("path", "==", baseFolder.path)
                  .limit(1)
                  .get();
                if (!metaSnap.empty) {
                  const doc = metaSnap.docs[0];
                  const data = doc.data() as {
                    shortId?: string;
                    slug?: string;
                  };
                  if (data.shortId) baseFolder.shortId = data.shortId;
                  if (data.slug || data.shortId)
                    baseFolder.slug =
                      data.slug || `${baseFolder.name}-${data.shortId}`;
                }
              } catch {}
            }
            folderSet.set(firstSeg, baseFolder);
          }
        }
        continue;
      }
      if (rest.includes("/")) {
        // object inside a subfolder. Extract immediate child segment
        const firstSeg = rest.split("/")[0];
        if (!folderSet.has(firstSeg)) {
          const baseFolder: FolderItem = {
            type: "folder",
            name: firstSeg,
            path: prefix + firstSeg + "/",
            parentPath: prefix,
            owner: decoded.uid,
            space: folder,
          };
          if (db) {
            try {
              const metaSnap = await db
                .collection("folders")
                .where("path", "==", baseFolder.path)
                .limit(1)
                .get();
              if (!metaSnap.empty) {
                const doc = metaSnap.docs[0];
                const data = doc.data() as { shortId?: string; slug?: string };
                if (data.shortId) baseFolder.shortId = data.shortId;
                if (data.slug || data.shortId)
                  baseFolder.slug =
                    data.slug || `${baseFolder.name}-${data.shortId}`;
              }
            } catch {}
          }
          folderSet.set(firstSeg, baseFolder);
        }
        continue; // skip deeper file listing
      }
      // It's a file in current root
      if (rest === ".keep") continue; // safety
      files.push({
        key,
        name: rest,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        contentType: "application/octet-stream",
        owner: decoded.uid,
        path: key,
      });
    }

    // Sort folders alphabetically
    const folders = Array.from(folderSet.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pl")
    );
    return NextResponse.json({
      folders,
      files,
      path: pathParam,
      base: basePrefix,
    });
  } catch (e) {
    console.error("list2 error", e);
    return NextResponse.json({ error: "Błąd listowania" }, { status: 500 });
  }
}
