import { NextResponse } from "next/server";

// Get today's 4 AM and tomorrow's 4 AM in London time
function getStaticTimes() {
  // Get current time in London
  const now = new Date();
  const londonDate = new Date(
    now.toLocaleString("en-GB", { timeZone: "Europe/London" })
  );

  // Create today's 4 AM
  const lastRun = new Date(now);
  lastRun.setUTCHours(3, 0, 0, 0); // 4 AM London is 3 AM UTC

  // If current London time is before 4 AM, move last run to previous day
  if (londonDate.getHours() < 4) {
    lastRun.setUTCDate(lastRun.getUTCDate() - 1);
  }

  // Next run is always 24 hours after last run
  const nextRun = new Date(lastRun);
  nextRun.setUTCDate(nextRun.getUTCDate() + 1);

  return { lastRun, nextRun };
}

export async function GET() {
  try {
    const { lastRun, nextRun } = getStaticTimes();

    return NextResponse.json({
      status: "completed",
      lastRun: lastRun.toISOString(),
      nextRun: nextRun.toISOString(),
      eventsCount: 0,
      message: "Static schedule: Updates daily at 4 AM London time",
    });
  } catch (error) {
    console.error("Error in status endpoint:", error);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}
