import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { initializeS3Client, getBucketName, listFiles } from "@/lib/storage";

interface MoveRequestBase {
  targetFolderPath: string;
  overwrite?: boolean;
}
interface MoveSingleRequest extends MoveRequestBase {
  key: string;
}
interface MoveBatchRequest extends MoveRequestBase {
  keys: string[];
}
interface MoveFolderRequest extends MoveRequestBase {
  folderPath: string;
  recursive: true;
}
type MoveRequest = MoveSingleRequest | MoveBatchRequest | MoveFolderRequest;

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
    const body = (await request.json().catch(() => null)) as MoveRequest | null;
    if (
      !body ||
      !("targetFolderPath" in body) ||
      !body.targetFolderPath.endsWith("/")
    ) {
      return NextResponse.json({ error: "Brak parametrów" }, { status: 400 });
    }
    const overwrite = !!body.overwrite;
    const result = {
      moved: [] as string[],
      conflicts: [] as string[],
      errors: [] as string[],
    };
    const client = initializeS3Client();
    const bucket = getBucketName();
    const { HeadObjectCommand, CopyObjectCommand, DeleteObjectCommand } =
      await import("@aws-sdk/client-s3");

    const processFile = async (key: string) => {
      try {
        const isFolderMarker = key.endsWith("/.keep");
        if (isFolderMarker) return; 
        const isPersonal = key.startsWith(`users/${decoded.uid}/`);
        const isMain = key.startsWith("main/");
        if (!isPersonal && !isMain) {
          result.errors.push(key);
          return;
        }
        if (isMain) {
          const role =
            (decoded as { role?: string } | undefined)?.role || "basic";
          if (role !== "admin" && role !== "plus") {
            result.errors.push(key);
            return;
          }
        }
        const fileName = key.substring(key.lastIndexOf("/") + 1);
        const newKey = body.targetFolderPath + fileName;
        if (newKey === key) {
          return;
        }
        
        if (isPersonal && !newKey.startsWith(`users/${decoded.uid}/`)) {
          result.errors.push(key);
          return;
        }
        if (isMain && !newKey.startsWith("main/")) {
          result.errors.push(key);
          return;
        }
        
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        
        let exists = false;
        try {
          await client.send(
            new HeadObjectCommand({ Bucket: bucket, Key: newKey })
          );
          exists = true;
        } catch {
         
        }
        if (exists && !overwrite) {
          result.conflicts.push(key);
          return;
        }
        if (exists && overwrite) {
          
          await client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: newKey })
          );
        }
        await client.send(
          new CopyObjectCommand({
            Bucket: bucket,
            Key: newKey,
            CopySource: `${bucket}/${key}`,
          })
        );
        await client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: key })
        );
        result.moved.push(key);
      } catch {
        result.errors.push(key);
      }
    };

    if ("folderPath" in body && body.recursive) {
      const folderPath = body.folderPath;
      if (!folderPath.endsWith("/"))
        return NextResponse.json(
          { error: "folderPath musi mieć /" },
          { status: 400 }
        );
      
      if (body.targetFolderPath.startsWith(folderPath)) {
        return NextResponse.json(
          { error: "Nie można przenieść folderu do siebie" },
          { status: 400 }
        );
      }
      const parentFolderName = folderPath
        .slice(0, -1)
        .split("/")
        .filter(Boolean)
        .pop();
      const newBase = body.targetFolderPath + parentFolderName + "/";
      const objects = await listFiles(folderPath);
      
      if (!overwrite) {
        for (const obj of objects) {
          const k = obj.Key!;
          const rel = k.substring(folderPath.length);
          const destKey = newBase + rel;
          try {
            await client.send(
              new HeadObjectCommand({ Bucket: bucket, Key: destKey })
            );
            result.conflicts.push(k);
          } catch {}
        }
        if (result.conflicts.length) {
          return NextResponse.json(result, { status: 409 });
        }
      }
      for (const obj of objects) {
        const k = obj.Key!;
        const rel = k.substring(folderPath.length);
        const destKey = newBase + rel;
        try {
          if (overwrite) {
            try {
              await client.send(
                new DeleteObjectCommand({ Bucket: bucket, Key: destKey })
              );
            } catch {}
          }
          await client.send(
            new CopyObjectCommand({
              Bucket: bucket,
              Key: destKey,
              CopySource: `${bucket}/${k}`,
            })
          );
          await client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: k })
          );
          result.moved.push(k);
        } catch {
          result.errors.push(k);
        }
      }
      return NextResponse.json(result);
    }

    const keys: string[] =
      "keys" in body ? body.keys : "key" in body ? [body.key] : [];
    if (!keys.length) {
      return NextResponse.json({ error: "Brak plików" }, { status: 400 });
    }
    for (const k of keys) {
      await processFile(k);
    }
    const status = result.conflicts.length ? 409 : 200;
    return NextResponse.json(result, { status });
  } catch (e) {
    console.error("move error", e);
    return NextResponse.json({ error: "Błąd przenoszenia" }, { status: 500 });
  }
}
