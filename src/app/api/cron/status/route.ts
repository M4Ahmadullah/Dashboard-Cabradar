import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import prisma from "@/lib/prisma";

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
      const currentTime = now.toJSDate();
      schedule = await prisma.cronSchedule.create({
        data: {
          scheduledAt: now.startOf("day").plus({ hours: 4 }).toJSDate(),
          status: "pending",
          eventsCount: 0,
          updatedAt: currentTime,
        },
      });
      console.log("Created new schedule:", schedule);
    }

    // Calculate next run time based on the scheduled time
    let nextRun = DateTime.fromJSDate(schedule.scheduledAt);

    // If the scheduled time has passed today, move to tomorrow
    while (nextRun <= now) {
      nextRun = nextRun.plus({ days: 1 });
    }

    // Calculate time intervals
    const timeSinceLastRun = schedule.updatedAt
      ? now.diff(DateTime.fromJSDate(schedule.updatedAt), ["hours", "minutes"])
      : null;

    const timeUntilNextRun = nextRun.diff(now, ["hours", "minutes"]);

    // Extract hour and minutes from scheduledAt
    const scheduledHour = nextRun.hour;
    const scheduledMinutes = nextRun.minute;

    // Calculate hours including minutes as decimal
    const hoursSinceLastRun = timeSinceLastRun
      ? (timeSinceLastRun.hours || 0) + (timeSinceLastRun.minutes || 0) / 60
      : null;

    const hoursUntilNextRun =
      (timeUntilNextRun.hours || 0) + (timeUntilNextRun.minutes || 0) / 60;

    return NextResponse.json({
      status: schedule.status,
      lastRun: schedule.updatedAt?.toISOString() || null,
      nextRun: nextRun.toISO(),
      scheduledHour,
      scheduledMinutes,
      hoursSinceLastRun,
      hoursUntilNextRun,
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
        updatedAt: now.toJSDate(),
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
