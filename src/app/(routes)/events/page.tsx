"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";

interface Event {
  id: string;
  title: string | null;
  category: string | null;
  start_local: Date | string | null;
  end_local: string | null;
  venue_name: string | null;
  venue_formatted_address: string | null;
  phq_attendance: string | null;
  lat: number | null;
  lon: string | null;
  labels: string | null;
  geometry: {
    type: string;
    coordinates: [number, number];
  } | null;
}

interface DayEvents {
  date: Date;
  events: Event[];
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch("/api/events");
        if (!response.ok) {
          throw new Error("Failed to fetch events");
        }
        const data = await response.json();
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

  const getCurrentWeekDays = () => {
    const days: Date[] = [];
    const today = new Date();

    // Calculate Monday of the current week
    const monday = new Date(today);
    const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust to get to Monday
    monday.setDate(today.getDate() - daysToSubtract);
    monday.setHours(0, 0, 0, 0);

    // Add Monday to Sunday (7 days)
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      days.push(date);
    }

    return days;
  };

  const groupEventsByDay = (events: Event[]): DayEvents[] => {
    const days = getCurrentWeekDays();
    return days.map((date) => ({
      date,
      events: events.filter((event) => {
        if (!event.start_local) return false;
        const eventDate = new Date(event.start_local);
        return (
          eventDate.getDate() === date.getDate() &&
          eventDate.getMonth() === date.getMonth() &&
          eventDate.getFullYear() === date.getFullYear()
        );
      }),
    }));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (date: Date | string | null) => {
    if (!date) return "N/A";

    // Convert string to Date if needed
    const dateObj = typeof date === "string" ? new Date(date) : date;

    return dateObj.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
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
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
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

  const dayEvents = groupEventsByDay(events);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Current Week Events
          </h1>
          <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">
            View events from Monday to Sunday of the current week
          </p>
        </div>

        {/* Timeline Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {dayEvents.map(({ date, events }) => (
            <button
              key={date.toISOString()}
              onClick={() => setSelectedDay(date)}
              className={`p-6 rounded-xl transition-all duration-200 ${
                selectedDay?.toDateString() === date.toDateString()
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <div className="text-xl font-semibold">{formatDate(date)}</div>
              <div className="mt-2 text-lg">
                {events.length} {events.length === 1 ? "event" : "events"}
              </div>
            </button>
          ))}
        </div>

        {/* Events List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-lg">Loading events...</div>
          ) : error ? (
            <div className="p-8 text-center text-lg text-red-600 dark:text-red-400">
              {error}
            </div>
          ) : selectedDay ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {dayEvents
                .find(
                  (day) =>
                    day.date.toDateString() === selectedDay.toDateString()
                )
                ?.events.map((event) => renderEventCard(event))}
            </div>
          ) : (
            <div className="p-8 text-center text-lg text-gray-500 dark:text-gray-400">
              Select a day to view events
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
