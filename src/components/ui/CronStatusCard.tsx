"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  Clock,
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface CronStatus {
  status: "pending" | "running" | "completed" | "failed";
  lastRun: string | null;
  nextRun: string;
  hoursSinceLastRun: number | null;
  hoursUntilNextRun: number;
  message: string;
}

export default function CronStatusCard() {
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async () => {
    try {
      setRefreshing(true);
      const response = await fetch("/api/cron/status");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch cron status");
      }
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: CronStatus["status"] | undefined) => {
    switch (status) {
      case "completed":
        return "bg-green-500 dark:bg-green-600";
      case "running":
        return "bg-blue-500 dark:bg-blue-600";
      case "failed":
        return "bg-red-500 dark:bg-red-600";
      case "pending":
        return "bg-yellow-500 dark:bg-yellow-600";
      default:
        return "bg-gray-500 dark:bg-gray-600";
    }
  };

  const getStatusIcon = (status: CronStatus["status"] | undefined) => {
    switch (status) {
      case "completed":
        return (
          <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400" />
        );
      case "running":
        return (
          <RefreshCw className="h-5 w-5 text-blue-500 dark:text-blue-400 animate-spin" />
        );
      case "failed":
        return (
          <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
        );
      case "pending":
        return (
          <Clock className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
        );
      default:
        return <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400" />;
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "Never";
    try {
      const date = new Date(dateString);
      return `London ${date.toLocaleString("en-GB", {
        timeZone: "Europe/London",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`;
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString;
    }
  };

  const formatHours = (hours: number | null): string => {
    if (hours === null) return "N/A";
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
    }
    return `${hours.toFixed(1)} hours`;
  };

  if (loading) {
    return (
      <Card className="shadow-md border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-500 dark:text-blue-400" />
            Event Cache Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-blue-400"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-md border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            Event Cache Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          {getStatusIcon(status?.status)}
          <CardTitle className="text-gray-900 dark:text-gray-100">
            Event Cache Status
          </CardTitle>
        </div>
        <Badge
          className={`${getStatusColor(status?.status)} text-white font-medium`}
        >
          {status?.status || "unknown"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
            {status?.message || "No status available"}
          </div>

          <div className="grid gap-4">
            <div className="flex justify-between items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Last Run:
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatDate(status?.lastRun ?? null)}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Next Run:
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatDate(status?.nextRun ?? null)}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time Since Last Run:
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatHours(status?.hoursSinceLastRun ?? null)}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time Until Next Run:
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatHours(status?.hoursUntilNextRun ?? 0)}
              </span>
            </div>
          </div>

          <Button
            onClick={fetchStatus}
            disabled={refreshing}
            className={`w-full mt-4 flex items-center justify-center gap-2 text-gray-900 dark:text-gray-100 ${
              refreshing ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {refreshing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Refresh Status
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
