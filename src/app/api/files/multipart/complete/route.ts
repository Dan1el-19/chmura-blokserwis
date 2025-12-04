import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/firebaseAdmin";
import { initializeS3Client, getBucketName } from "@/lib/storage";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { Part } from "@/types/multipart";

export async function POST(request: NextRequest) {
  try {
    console.log("🔧 [API Complete] Starting complete multipart upload request");

    
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error(
        "🚫 [API Complete] Missing or invalid authorization header"
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decodedToken;

    try {
      if (!auth) {
        console.error("🚫 [API Complete] Firebase Admin not initialized");
        return NextResponse.json(
          { error: "Firebase Admin not initialized" },
          { status: 500 }
        );
      }
      decodedToken = await auth.verifyIdToken(token);
      console.log(
        "✅ [API Complete] Token verified for user:",
        decodedToken.uid
      );
    } catch {
      console.error("🚫 [API Complete] Token verification failed");
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    
    if (!decodedToken.uid) {
      console.error("🚫 [API Complete] No user ID in token");
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    
    const body = await request.json();
    console.log("🔧 [API Complete] Request body parsed:", {
      uploadId: body.uploadId,
      key: body.key,
      partsCount: body.parts?.length || 0,
    });
    const { uploadId, key, parts } = body;

    
    if (!uploadId || !key || !parts || !Array.isArray(parts)) {
      console.error("🚫 [API Complete] Missing required fields:", {
        hasUploadId: !!uploadId,
        hasKey: !!key,
        hasPartsArray: Array.isArray(parts),
        partsType: typeof parts,
      });
      return NextResponse.json(
        {
          error: "Missing required fields: uploadId, key, parts",
        },
        { status: 400 }
      );
    }

    
    if (parts.length === 0) {
      console.error("🚫 [API Complete] Empty parts array");
      return NextResponse.json(
        {
          error: "Parts array cannot be empty",
        },
        { status: 400 }
      );
    }

    console.log(
      "🔧 [API Complete] Parts received:",
      parts.map((p) => ({
        partNumber: p.partNumber,
        etag: p.etag?.substring(0, 20) + "...",
        hasEtag: !!p.etag,
      }))
    );

    
    for (const part of parts) {
      if (
        !part.partNumber ||
        !part.etag ||
        typeof part.partNumber !== "number" ||
        typeof part.etag !== "string"
      ) {
        return NextResponse.json(
          {
            error: "Invalid part data. Each part must have partNumber and etag",
          },
          { status: 400 }
        );
      }
    }

    
    const sortedParts = parts.sort(
      (a: Part, b: Part) => a.partNumber - b.partNumber
    );
    console.log(
      "🔧 [API Complete] Parts after sorting:",
      sortedParts.map((p) => p.partNumber)
    );

    
    for (let i = 0; i < sortedParts.length; i++) {
      if (sortedParts[i].partNumber !== i + 1) {
        console.error(
          `🚫 [API Complete] Invalid part sequence at index ${i}:`,
          {
            expected: i + 1,
            actual: sortedParts[i].partNumber,
          }
        );
        return NextResponse.json(
          {
            error: `Invalid part sequence. Expected part ${i + 1}, got part ${sortedParts[i].partNumber}`,
          },
          { status: 400 }
        );
      }
    }

    console.log("✅ [API Complete] Part sequence validation passed");

    
    const s3Client = initializeS3Client();
    const bucketName = getBucketName();

    console.log("🔧 [API Complete] S3 client initialized:", {
      bucket: bucketName,
      uploadId,
      key,
    });

    
    const r2Parts = sortedParts.map((part) => ({
      PartNumber: part.partNumber,
      ETag: part.etag,
    }));

    console.log(
      "🔧 [API Complete] R2 parts prepared:",
      r2Parts.map((p) => ({
        PartNumber: p.PartNumber,
        ETag: p.ETag?.substring(0, 20) + "...",
      }))
    );

    
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: r2Parts,
      },
    });

    console.log("🚀 [API Complete] Sending complete command to R2...");

    
    try {
      const result = await s3Client.send(completeCommand);

      console.log("✅ [API Complete] R2 response:", {
        etag: result.ETag,
        location: result.Location,
      });

      if (!result.ETag) {
        console.error("🚫 [API Complete] No ETag in R2 response");
        throw new Error("Failed to complete multipart upload on R2");
      }

      console.log("🎉 [API Complete] Multipart upload completed successfully");

      
      return NextResponse.json({
        status: "completed",
        key,
        etag: result.ETag.replace(/"/g, ""), 
        message: "Multipart upload completed successfully",
        uploadId,
        bucket: bucketName,
        partsCount: parts.length,
        completedAt: new Date().toISOString(),
      });
    } catch (r2Error) {
      console.error("💥 [API Complete] R2 Error:", {
        error: r2Error instanceof Error ? r2Error.message : r2Error,
        name: r2Error instanceof Error ? r2Error.name : "Unknown",
        uploadId,
        key,
      });

      
      if (
        r2Error instanceof Error &&
        r2Error.message.includes("does not exist")
      ) {
        return NextResponse.json(
          {
            error: "Upload session expired or was aborted",
            code: "UPLOAD_NOT_FOUND",
            uploadId,
            suggestion: "Please restart the upload process",
          },
          { status: 410 }
        ); 
      }

      throw r2Error; 
    }
  } catch (error) {
    console.error("Error completing multipart upload:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Failed to complete multipart upload",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
