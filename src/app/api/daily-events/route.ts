import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getRedisClient } from "@/lib/redis";

const prisma = new PrismaClient();

export async function GET() {
  const redisClient = getRedisClient();

  try {
    // Get today's date
    const today = new Date();

    // Set start time to 4 AM of the current day
    const startTime = new Date(today);
    startTime.setHours(4, 0, 0, 0);

    // Set end time to 3:59:59.999 AM of the next day
    const endTime = new Date(today);
    endTime.setDate(today.getDate() + 1); // Move to next day
    endTime.setHours(3, 59, 59, 999);

    console.log("Fetching events between:", {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });

    // Generate cache keys
    const dateStr = today.toISOString().split("T")[0];
    const eventsKey = `events:${dateStr}`; // For storing the full events data
    const geoKey = `geo:events:${dateStr}`; // For storing geo data

    // Try to get data from Redis cache first
    const cachedEvents = await redisClient.get(eventsKey);

    if (cachedEvents) {
      console.log("Using cached daily events data");
      return NextResponse.json(JSON.parse(cachedEvents));
    }

    // If not in cache, fetch from database
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
        // Only process events with valid coordinates
        if (event.lat !== null && event.lon !== null) {
          const longitude =
            typeof event.lon === "string" ? parseFloat(event.lon) : event.lon;

          if (!isNaN(longitude) && !isNaN(event.lat)) {
            // Store in Redis Geo data structure
            // GEOADD key longitude latitude member
            try {
              await redisClient.geoadd(
                geoKey,
                longitude,
                event.lat,
                event.id // Use event ID as the member name
              );
            } catch (error) {
              console.error("Error storing geo data:", error);
            }

            // Add GeoJSON format for the response
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

        // Return event without geometry if no valid coordinates
        return {
          ...event,
          phq_attendance: event.phq_attendance?.toString(),
          geometry: null,
        };
      })
    );

    console.log(`Found ${events.length} events for the 4 AM to 4 AM period`);

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

    // Cache the response for 5 minutes
    await redisClient.setex(eventsKey, 300, JSON.stringify(response));

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching daily events:", error);

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

    return NextResponse.json(
      { error: "Failed to fetch daily events" },
      { status: 500 }
    );
  }
}
