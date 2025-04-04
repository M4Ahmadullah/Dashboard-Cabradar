import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const [eventsCount, cronCount] = await Promise.all([
      prisma.eventsLive.count(),
      prisma.cronSchedule.count(),
    ]);

    return NextResponse.json({
      success: true,
      message: "Database connection successful",
      counts: {
        eventsLive: eventsCount,
        cronSchedule: cronCount,
      },
    });
  } catch (error) {
    console.error("Database connection error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Database connection failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
