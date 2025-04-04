"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";

interface Event {
  id: string;
  title: string | null;
  category: string | null;
  start_local: string | null;
  end_local: string | null;
  venue_name: string | null;
  venue_formatted_address: string | null;
  lat: number | null;
  lon: string | null;
  attendance: string | null;
  labels: string | null;
  check_timings: string | null;
  phq_attendance: string | null;
  geometry: {
    type: string;
    coordinates: [number, number];
  } | null;
}

export default function DailyEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch("/api/daily-events");
        if (!response.ok) {
          throw new Error("Failed to fetch events");
        }
        const data = await response.json();
        console.log("API Response:", data);
        if (data.success && Array.isArray(data.data)) {
          setEvents(data.data);
        } else {
          setEvents([]);
        }
      } catch (error) {
        console.error("Error fetching events:", error);
        setError("Failed to load events. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDateRange = () => {
    const now = new Date();

    // Set start time to 4 AM today
    const startTime = new Date(now);
    startTime.setHours(4, 0, 0, 0);

    // Set end time to 3:59:59 AM tomorrow
    const endTime = new Date(now);
    endTime.setDate(endTime.getDate() + 1); // Move to tomorrow
    endTime.setHours(3, 59, 59, 999);

    const formatDate = (date: Date) => {
      return date
        .toLocaleDateString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .replace(/\//g, "-");
    };

    return `Events (${formatDate(startTime)} 4AM to ${formatDate(
      endTime
    )} 4AM)`;
  };

  const getDayOfWeek = () => {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return days[new Date().getDay()];
  };

  const toggleEventDetails = (eventId: string) => {
    setExpandedEventId(expandedEventId === eventId ? null : eventId);
  };

  const getGoogleMapsUrl = (lat: number | null, lon: string | null) => {
    if (lat === null || lon === null) return null;

    // Convert lon from string to number if needed
    const longitude = typeof lon === "string" ? parseFloat(lon) : lon;

    if (isNaN(longitude) || isNaN(lat)) return null;

    return `https://www.google.com/maps?q=${lat},${longitude}`;
  };

  const renderEventCard = (event: Event) => {
    const isExpanded = expandedEventId === event.id;
    const mapsUrl = getGoogleMapsUrl(event.lat, event.lon);

    return (
      <div
        key={event.id}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-4"
      >
        <div
          className="p-4 cursor-pointer"
          onClick={() => toggleEventDetails(event.id)}
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {event.title || "Untitled Event"}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {event.venue_name || "No venue"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {formatTime(event.start_local)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {event.category || "No category"}
              </p>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
            <div className="mt-3 space-y-2">
              <div className="flex items-start">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-24">
                  Venue:
                </span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {event.venue_formatted_address || "No address available"}
                </span>
              </div>

              {event.geometry && (
                <div className="flex items-start">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-24">
                    Location:
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {`${event.geometry.coordinates[1].toFixed(
                      6
                    )}, ${event.geometry.coordinates[0].toFixed(6)}`}
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        View on Map
                      </a>
                    )}
                  </span>
                </div>
              )}

              <div className="flex items-start">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-24">
                  Attendance:
                </span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {event.phq_attendance || "N/A"}
                </span>
              </div>

              {event.labels && (
                <div className="flex items-start">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-24">
                    Labels:
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {event.labels}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {getDateRange()}
          </h1>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-lg text-gray-700 dark:text-gray-300">
              {getDayOfWeek()}, {events.length}{" "}
              {events.length === 1 ? "Event" : "Events"} Today
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading events...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No events found for this period.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map((event) => renderEventCard(event))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
