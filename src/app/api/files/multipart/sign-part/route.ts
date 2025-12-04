import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/firebaseAdmin";
import { initializeS3Client, getBucketName } from "@/lib/storage";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function POST(request: NextRequest) {
  try {
    console.log("🔧 [API Sign-Part] Starting sign part request");

    
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("🚫 [API Sign-Part] Missing authorization header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decodedToken;

    try {
      if (!auth) {
        console.error("🚫 [API Sign-Part] Firebase Admin not initialized");
        return NextResponse.json(
          { error: "Firebase Admin not initialized" },
          { status: 500 }
        );
      }
      decodedToken = await auth.verifyIdToken(token);
      console.log(
        "✅ [API Sign-Part] Token verified for user:",
        decodedToken.uid
      );
    } catch {
      console.error("🚫 [API Sign-Part] Token verification failed");
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    
    if (!decodedToken.uid) {
      console.error("🚫 [API Sign-Part] No user ID in token");
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    
    const body = await request.json();
    console.log("🔧 [API Sign-Part] Request body:", {
      uploadId: body.uploadId,
      partNumber: body.partNumber,
      key: body.key,
    });
    const { uploadId, partNumber, key } = body;

    
    if (!uploadId || !partNumber || !key) {
      console.error("🚫 [API Sign-Part] Missing required fields:", {
        hasUploadId: !!uploadId,
        hasPartNumber: !!partNumber,
        hasKey: !!key,
      });
      return NextResponse.json(
        {
          error: "Missing required fields: uploadId, partNumber, key",
        },
        { status: 400 }
      );
    }

    
    if (typeof partNumber !== "number" || partNumber < 1) {
      console.error("🚫 [API Sign-Part] Invalid partNumber:", {
        partNumber,
        type: typeof partNumber,
      });
      return NextResponse.json(
        {
          error: "partNumber must be a positive number",
        },
        { status: 400 }
      );
    }

    console.log("✅ [API Sign-Part] Validation passed for part:", partNumber);

    
    const s3Client = initializeS3Client();
    const bucketName = getBucketName();

    console.log("🔧 [API Sign-Part] S3 client initialized:", {
      bucket: bucketName,
      uploadId,
      partNumber,
      key,
    });

    
    const uploadPartCommand = new UploadPartCommand({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    
    const presignedUrl = await getSignedUrl(s3Client, uploadPartCommand, {
      expiresIn: 3600, 
    });

    console.log("✅ [API Sign-Part] Presigned URL generated successfully");
    console.log(
      "🔧 [API Sign-Part] URL domain:",
      new URL(presignedUrl).hostname
    );

    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    console.log("🎯 [API Sign-Part] Returning response for part:", partNumber);

    
    return NextResponse.json({
      presignedUrl,
      partNumber,
      expiresAt: expiresAt.toISOString(),
      uploadId,
      key,
      bucket: bucketName,
    });
  } catch (error) {
    console.error("Error signing part:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Failed to sign part",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
