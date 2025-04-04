import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getRedisClient } from "@/lib/redis";

const prisma = new PrismaClient();

// Maximum number of retries for failed updates
const MAX_RETRIES = 3;
// Time to wait between retries (in milliseconds)
const RETRY_DELAY = 30 * 1000; // 30 seconds

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

    // Get current retry count from Redis
    const retryKey = "cron:retry_count";
    const currentRetries = await redisClient.get(retryKey);
    const retryCount = currentRetries ? parseInt(currentRetries) : 0;

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
    const cronStatusKey = "cron:status";

    // Update cron status to running
    await redisClient.set(
      cronStatusKey,
      JSON.stringify({
        status: "running",
        lastRun: new Date().toISOString(),
        message: "Cache update in progress",
        retryCount: retryCount,
      })
    );

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

    // Reset retry count on success
    await redisClient.del(retryKey);

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
    console.error("Error in cache update:", error);

    // Get current retry count from Redis
    const retryKey = "cron:retry_count";
    const currentRetries = await redisClient.get(retryKey);
    const retryCount = currentRetries ? parseInt(currentRetries) : 0;

    if (retryCount < MAX_RETRIES) {
      // Increment retry count
      await redisClient.setex(retryKey, 3600, (retryCount + 1).toString());

      // Update cron status to failed with retry info
      await redisClient.set(
        "cron:status",
        JSON.stringify({
          status: "failed",
          lastRun: new Date().toISOString(),
          message: `Failed to cache events. Retry ${
            retryCount + 1
          }/${MAX_RETRIES} in 30 seconds.`,
          retryCount: retryCount + 1,
        })
      );

      // Return 503 with retry-after header
      return NextResponse.json(
        {
          error: "Cache update failed, will retry",
          retryCount: retryCount + 1,
          maxRetries: MAX_RETRIES,
          nextRetry: new Date(Date.now() + RETRY_DELAY).toISOString(),
        },
        {
          status: 503,
          headers: {
            "Retry-After": "30",
          },
        }
      );
    }

    // If we've exhausted all retries, reset the retry count
    await redisClient.del(retryKey);

    // Update cron status to failed
    await redisClient.set(
      "cron:status",
      JSON.stringify({
        status: "failed",
        lastRun: new Date().toISOString(),
        message: "Failed to cache events after all retries",
        retryCount: 0,
      })
    );

    return NextResponse.json(
      { error: "Failed to cache events after all retries" },
      { status: 500 }
    );
  }
}
