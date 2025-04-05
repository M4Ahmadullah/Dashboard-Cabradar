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

async function getCronJobStatus() {
  const CRONJOB_API_KEY = process.env.CRONJOB_API_KEY;
  const CRONJOB_ID = process.env.CRONJOB_ID;

  if (!CRONJOB_API_KEY || !CRONJOB_ID) {
    console.log("Missing CRONJOB_API_KEY or CRONJOB_ID");
    return null;
  }

  try {
    const response = await fetch(
      `https://api.cron-job.org/jobs/${CRONJOB_ID}`,
      {
        headers: {
          Authorization: `Bearer ${CRONJOB_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch cron job status:", await response.text());
      return null;
    }

    const data = await response.json();
    console.log("Cron job data:", data);
    return data;
  } catch (error) {
    console.error("Error fetching cron job status:", error);
    return null;
  }
}

export async function GET() {
  try {
    // Try to get real status from cron-job.org
    const cronJobStatus = await getCronJobStatus();

    // If we have real status from cron-job.org, use it
    if (cronJobStatus && cronJobStatus.jobDetails) {
      const job = cronJobStatus.jobDetails;

      // Convert Unix timestamps to ISO strings
      const lastRunTime = job.lastExecution
        ? new Date(job.lastExecution * 1000).toISOString()
        : null;
      const nextRunTime = job.nextExecution
        ? new Date(job.nextExecution * 1000).toISOString()
        : null;

      return NextResponse.json({
        status: job.enabled
          ? job.lastStatus === 200
            ? "completed"
            : "failed"
          : "disabled",
        lastRun: lastRunTime,
        nextRun: nextRunTime,
        jobDetails: {
          enabled: job.enabled,
          title: job.title,
          url: job.url,
          schedule: job.schedule,
          lastStatus: job.lastStatus,
          lastDuration: job.lastDuration,
          notifyOnFailure: job.notification?.onFailure || false,
          notifyOnSuccess: job.notification?.onSuccess || false,
          saveResponses: job.saveResponses,
        },
        message: job.enabled
          ? job.lastStatus === 200
            ? "Last run completed successfully"
            : `Last run failed with status ${job.lastStatus}`
          : "Job is currently disabled on cron-job.org",
      });
    }

    // Fall back to static times if we can't get real status
    const { lastRun, nextRun } = getStaticTimes();
    return NextResponse.json({
      status: "completed",
      lastRun: lastRun.toISOString(),
      nextRun: nextRun.toISOString(),
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
