import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis";

interface Geometry {
  type: "Point";
  coordinates: [number, number];
}

export async function POST(request: Request) {
  let redisClient;
  try {
    // Initialize Redis client
    redisClient = getRedisClient();

    // Test Redis connection
    await redisClient.ping();
    console.log("Redis connection successful");

    // Verify authorization
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid authorization header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    if (token !== process.env.CRON_SECRET) {
      console.error("Invalid cron secret token");
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

    // Get today's date in UTC
    const today = new Date();
    console.log("Current time:", today.toISOString());

    // Set start time to 4 AM UTC of the current day
    const startTime = new Date(today);
    startTime.setUTCHours(4, 0, 0, 0);
    console.log("Start time:", startTime.toISOString());

    // Set end time to 3:59:59.999 AM UTC of the next day
    const endTime = new Date(today);
    endTime.setUTCDate(today.getUTCDate() + 1);
    endTime.setUTCHours(3, 59, 59, 999);
    console.log("End time:", endTime.toISOString());

    // Generate cache key
    const eventsKey = "EventsLive";

    // Fetch events from database
    console.log("Fetching events from database...");
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
    console.log(`Found ${events.length} events`);

    // Process events and prepare data
    const serializedEvents = events.map((event) => {
      const eventData = {
        ...event,
        phq_attendance: event.phq_attendance?.toString(),
        geometry: null as Geometry | null,
      };

      // Add geometry if coordinates are valid
      if (event.lat !== null && event.lon !== null) {
        const longitude =
          typeof event.lon === "string" ? parseFloat(event.lon) : event.lon;
        if (!isNaN(longitude) && !isNaN(event.lat)) {
          eventData.geometry = {
            type: "Point",
            coordinates: [longitude, event.lat],
          };
        }
      }

      return eventData;
    });

    // Prepare the response with all data
    const response = {
      success: true,
      data: serializedEvents,
      timestamp: new Date().toISOString(),
      metadata: {
        timeRange: {
          start: startTime.toISOString(),
          end: endTime.toISOString(),
        },
        totalEvents: events.length,
        totalGeoPoints: serializedEvents.filter((e) => e.geometry !== null)
          .length,
      },
    };

    // Cache the response for 24 hours
    console.log("Caching events in Redis...");
    await redisClient.setex(eventsKey, 86400, JSON.stringify(response));
    console.log("Events cached successfully");

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

    // Log the full error stack
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
    }

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
    if (redisClient) {
      try {
        await redisClient.set(
          "cron:status",
          JSON.stringify({
            status: "failed",
            lastRun: new Date().toISOString(),
            message:
              error instanceof Error ? error.message : "Failed to cache events",
          })
        );
      } catch (redisError) {
        console.error("Failed to update Redis status:", redisError);
      }
    }

    return NextResponse.json(
      {
        error: "Failed to cache events",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
