import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis";

export async function POST(request: Request) {
  const redisClient = getRedisClient();

  try {
    // Verify authorization
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Update cron status to running
    const cronStatusKey = "cron:status";
    await redisClient.set(
      cronStatusKey,
      JSON.stringify({
        status: "running",
        lastRun: new Date().toISOString(),
        message: "Cache update in progress",
      })
    );

    // Get today's date
    const today = new Date();

    // Set start time to 4 AM of the current day
    const startTime = new Date(today);
    startTime.setHours(4, 0, 0, 0);

    // Set end time to 3:59:59.999 AM of the next day
    const endTime = new Date(today);
    endTime.setDate(today.getDate() + 1);
    endTime.setHours(3, 59, 59, 999);

    // Generate cache keys
    const dateStr = today.toISOString().split("T")[0];
    const eventsKey = `events:${dateStr}`;
    const geoKey = `geo:events:${dateStr}`;

    // Fetch events from database
    const events = await prisma.eventsLive.findMany({
      where: {
        start_local: {
          gte: startTime,
          lt: endTime,
        },
      },
      orderBy: {
        start_local: "asc",
      },
    });

    // Process events and store geo data
    const serializedEvents = await Promise.all(
      events.map(async (event) => {
        if (event.lat !== null && event.lon !== null) {
          const longitude =
            typeof event.lon === "string" ? parseFloat(event.lon) : event.lon;

          if (!isNaN(longitude) && !isNaN(event.lat)) {
            try {
              await redisClient.geoadd(geoKey, longitude, event.lat, event.id);
            } catch (error) {
              console.error("Error storing geo data:", error);
            }

            return {
              ...event,
              phq_attendance: event.phq_attendance?.toString(),
              geometry: {
                type: "Point",
                coordinates: [longitude, event.lat],
              },
            };
          }
        }

        return {
          ...event,
          phq_attendance: event.phq_attendance?.toString(),
          geometry: null,
        };
      })
    );

    // Prepare the response
    const response = {
      success: true,
      data: serializedEvents,
      timestamp: new Date().toISOString(),
      metadata: {
        timeRange: {
          start: startTime.toISOString(),
          end: endTime.toISOString(),
        },
      },
    };

    // Cache the response for 24 hours
    await redisClient.setex(eventsKey, 86400, JSON.stringify(response));

    // Update cron status to success
    await redisClient.set(
      cronStatusKey,
      JSON.stringify({
        status: "success",
        lastRun: new Date().toISOString(),
        eventsCount: events.length,
        message: `Successfully cached ${events.length} events`,
      })
    );

    return NextResponse.json({
      success: true,
      message: "Events cached successfully",
      eventsCount: events.length,
    });
  } catch (error) {
    console.error("Error in cron job:", error);

    // Check if it's a Redis connection error
    if (
      error instanceof Error &&
      error.message.includes("max number of clients reached")
    ) {
      return NextResponse.json(
        {
          error:
            "Service is experiencing high load. Please try again in a few moments.",
          details: "Redis connection limit reached",
        },
        { status: 503 }
      );
    }

    // Update cron status to failed
    const cronStatusKey = "cron:status";
    await redisClient.set(
      cronStatusKey,
      JSON.stringify({
        status: "failed",
        lastRun: new Date().toISOString(),
        message: "Failed to cache events",
      })
    );

    return NextResponse.json(
      { error: "Failed to cache events" },
      { status: 500 }
    );
  }
}
