import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Get the current date
    const today = new Date();

    // Calculate the start date (Monday of the current week)
    const startDate = new Date(today);
    const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust to get to Monday
    startDate.setDate(today.getDate() - daysToSubtract);
    startDate.setHours(0, 0, 0, 0);

    // Calculate the end date (Sunday of the current week)
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6); // Monday + 6 days = Sunday of current week
    endDate.setHours(23, 59, 59, 999);

    console.log("Fetching events between:", {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const events = await prisma.eventsLive.findMany({
      where: {
        start_local: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        start_local: "asc",
      },
    });

    // Convert BigInt to string for serialization and add GeoJSON format
    const serializedEvents = events.map((event) => {
      // Create GeoJSON Point feature if lat and lon are available
      let geometry = null;
      if (event.lat !== null && event.lon !== null) {
        // Convert lon from string to number if needed
        const longitude =
          typeof event.lon === "string" ? parseFloat(event.lon) : event.lon;

        if (!isNaN(longitude) && !isNaN(event.lat)) {
          geometry = {
            type: "Point",
            coordinates: [longitude, event.lat], // GeoJSON uses [longitude, latitude] order
          };
        }
      }

      return {
        ...event,
        phq_attendance: event.phq_attendance?.toString(),
        geometry, // Add the GeoJSON geometry
      };
    });

    console.log(`Found ${events.length} events for the current week`);

    return NextResponse.json({
      success: true,
      data: serializedEvents,
      timestamp: new Date().toISOString(),
      metadata: {
        timeRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
