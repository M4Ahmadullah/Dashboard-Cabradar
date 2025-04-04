"use client";

import { FC } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const RetoolPage: FC = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Event Management Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage and edit events directly from this dashboard
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <iframe
            src="https://cabradar.retool.com/apps/Dashboard%20-%20Supabase-testing"
            className="w-full h-[calc(100vh-200px)] min-h-[800px]"
            title="CabRadar Event Management Dashboard"
            allow="fullscreen"
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default RetoolPage;
