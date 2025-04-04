"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import CronStatusCard from "@/components/ui/CronStatusCard";

export default function Home() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to CabRadar
          </h1>
          <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">
            Your central hub for event monitoring and management
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Quick Actions
            </h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Access your most used features
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Events
            </h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              View your latest event updates
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Analytics
            </h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Track event metrics and insights
            </p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            System Status
          </h2>
          <CronStatusCard />
        </div>
      </div>
    </DashboardLayout>
  );
}
