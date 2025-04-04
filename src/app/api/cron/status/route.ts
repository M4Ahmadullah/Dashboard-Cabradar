import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Get current time in London
    const now = DateTime.now().setZone("Europe/London");
    console.log("Current time in London:", now.toISO());

    // Get the latest schedule
    let schedule = await prisma.cronSchedule.findFirst({
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        eventsCount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    console.log("Found schedule:", schedule);

    // If no schedule exists, create one with default values
    if (!schedule) {
      console.log("No schedule found, creating default schedule");
      schedule = await prisma.cronSchedule.create({
        data: {
          scheduledAt: now.startOf("day").plus({ hours: 4 }).toJSDate(),
          status: "pending",
          eventsCount: 0,
        },
      });
      console.log("Created new schedule:", schedule);
    }

    // Calculate next run time based on the scheduled time
    const nextRun = DateTime.fromJSDate(schedule.scheduledAt);
    if (nextRun <= now) {
      nextRun.plus({ days: 1 });
    }

    // Extract hour and minutes from scheduledAt
    const scheduledHour = nextRun.hour;
    const scheduledMinutes = nextRun.minute;

    return NextResponse.json({
      status: schedule.status,
      nextRun: nextRun.toISO(),
      scheduledHour,
      scheduledMinutes,
      message:
        schedule.status === "running"
          ? "Cache update in progress..."
          : schedule.status === "completed"
          ? "Cache is up to date"
          : "Waiting for next scheduled update",
    });
  } catch (error) {
    console.error("Detailed error in cron status:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return NextResponse.json(
      {
        error: "Failed to fetch cron status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { hour, minutes } = await request.json();

    if (typeof hour !== "number" || hour < 0 || hour > 23) {
      return NextResponse.json(
        { error: "Hour must be between 0 and 23" },
        { status: 400 }
      );
    }

    if (typeof minutes !== "number" || minutes < 0 || minutes > 59) {
      return NextResponse.json(
        { error: "Minutes must be between 0 and 59" },
        { status: 400 }
      );
    }

    // Get current time in London
    const now = DateTime.now().setZone("Europe/London");

    // Calculate next run time (today or tomorrow if the time has passed)
    let nextRun = now.startOf("day").plus({ hours: hour, minutes: minutes });
    if (nextRun <= now) {
      nextRun = nextRun.plus({ days: 1 });
    }

    // Update the latest schedule
    await prisma.cronSchedule.updateMany({
      where: { id: { gt: 0 } }, // Update all records
      data: {
        scheduledAt: nextRun.toJSDate(),
      },
    });

    return NextResponse.json({
      message: "Schedule updated successfully",
      nextRun: nextRun.toISO(),
      scheduledHour: hour,
      scheduledMinutes: minutes,
    });
  } catch (error) {
    console.error("Error updating cron schedule:", error);
    return NextResponse.json(
      { error: "Failed to update cron schedule" },
      { status: 500 }
    );
  }
}
