import { NextRequest, NextResponse } from "next/server";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, taskId, userId, fileName, additionalData } = body;

    if (!action || !taskId) {
      return NextResponse.json(
        { error: "Brak wymaganych parametrów" },
        { status: 400 }
      );
    }

    // Loguj akcję kolejki
    const db = getFirestore();
    await db.collection("activityLogs").add({
      userId: userId || "unknown",
      userEmail: "", // Można dodać później
      action: `queue_${action}`,
      fileName: fileName || "unknown",
      fileSize: 0,
      taskId,
      additionalData: additionalData || {},
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Błąd podczas logowania akcji kolejki:", error);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
