"use client";

import { useEffect, useState } from "react";
import { Module4Metrics, Module4Overview } from "@/components/modules/module4";

type HealthResponse = {
  status: string;
  service: string;
  database_connected: boolean;
};

const statCards = [
  { label: "Active Cameras", value: "12", tone: "bg-slate-900 text-white" },
  { label: "Alerts Today", value: "4", tone: "bg-emerald-600 text-white" },
  { label: "Missing Persons", value: "8", tone: "bg-amber-500 text-white" },
];

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/backend/health")
      .then((res) => {
        if (!res.ok) throw new Error("Backend returned an error");
        return res.json();
      })
      .then(setHealth)
      .catch(() => setError("Could not reach backend. Is FastAPI running?"));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                AVSS Dashboard
              </p>
              <h1 className="text-3xl font-bold">Autonomous Video Surveillance System</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Module 3 and Module 4 bring a live monitoring overview for camera status, alerts, and system health.
              </p>
            </div>
            <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
              {health?.status === "ok" ? "System Online" : "Checking backend..."}
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {statCards.map((card) => (
            <div key={card.label} className={`rounded-2xl p-5 shadow-sm ${card.tone}`}>
              <p className="text-sm opacity-80">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold">{card.value}</p>
            </div>
          ))}
        </section>

        <Module4Overview
          title="Video intelligence workflow"
          description="Module 4 focuses on the operational layer for live detections, alerts, and queue management across the surveillance workflow."
          badge="In Progress"
        />

        <Module4Metrics />

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Camera status</h2>
            <div className="mt-4 space-y-3">
              {[
                ["Front Entrance", "Online"],
                ["Parking Lot", "Online"],
                ["Loading Bay", "Warning"],
              ].map(([name, state]) => (
                <div key={name} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <span>{name}</span>
                  <span className={`rounded-full px-2.5 py-1 text-sm ${state === "Online" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {state}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Backend health</h2>
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
              {error && <p className="text-rose-600">{error}</p>}
              {!error && !health && <p>Checking backend connection...</p>}
              {health && (
                <ul className="space-y-2">
                  <li><span className="font-medium">Status:</span> {health.status}</li>
                  <li><span className="font-medium">Service:</span> {health.service}</li>
                  <li><span className="font-medium">Database:</span> {health.database_connected ? "Connected" : "Disconnected"}</li>
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
