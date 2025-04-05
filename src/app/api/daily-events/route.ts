import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
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

    // Process events
    const serializedEvents = events.map((event) => {
      // Add GeoJSON format if coordinates are valid
      if (event.lat !== null && event.lon !== null) {
        const longitude =
          typeof event.lon === "string" ? parseFloat(event.lon) : event.lon;

        if (!isNaN(longitude) && !isNaN(event.lat)) {
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
    });

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
        totalEvents: serializedEvents.length,
        totalGeoPoints: serializedEvents.filter((e) => e.geometry !== null)
          .length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching daily events:", error);
    return NextResponse.json(
      { error: "Failed to fetch daily events" },
      { status: 500 }
    );
  }
}
