import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Calculate next run time based on cron-job.org schedule (4:15 AM London time)
function calculateNextRun(): Date {
  const now = new Date();
  const nextRun = new Date(now);

  // Set to 4:15 AM London time
  nextRun.setUTCHours(3, 15, 0, 0); // 4:15 AM London time is 3:15 AM UTC

  // If the time has passed today, set it for tomorrow
  if (nextRun <= now) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }

  return nextRun;
}

export async function GET() {
  try {
    // Get the latest run status
    const status = await prisma.cronSchedule.findFirst({
      select: {
        status: true,
        eventsCount: true,
        updatedAt: true,
        scheduledAt: true,
      },
      orderBy: { id: "desc" },
      take: 1,
    });

    // Calculate next run time
    const nextRun = calculateNextRun();

    // If no status exists, create one
    if (!status) {
      const newStatus = await prisma.cronSchedule.create({
        data: {
          status: "pending",
          eventsCount: 0,
          updatedAt: new Date(),
          scheduledAt: nextRun, // Store the next run time in scheduledAt
        },
        select: {
          status: true,
          eventsCount: true,
          updatedAt: true,
          scheduledAt: true,
        },
      });
      return NextResponse.json({
        status: newStatus.status,
        lastRun: newStatus.updatedAt.toISOString(),
        nextRun: nextRun.toISOString(),
        eventsCount: newStatus.eventsCount,
        message: "Waiting for first run",
      });
    }

    return NextResponse.json({
      status: status.status,
      lastRun: status.updatedAt.toISOString(),
      nextRun: nextRun.toISOString(),
      eventsCount: status.eventsCount,
      message:
        status.status === "running"
          ? "Cache update in progress..."
          : status.status === "completed"
          ? "Cache is up to date"
          : "Waiting for next scheduled update",
    });
  } catch (error) {
    console.error("Error in cron status:", error);
    return NextResponse.json(
      { error: "Failed to fetch cron status" },
      { status: 500 }
    );
  }
}
