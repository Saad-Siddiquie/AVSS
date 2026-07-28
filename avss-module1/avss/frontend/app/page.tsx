"use client";

import { useEffect, useState } from "react";
import { Module4Metrics, Module4Overview, Module4Workflow } from "@/components/modules/module4";
import { Module5Workflow } from "@/components/modules/module5";
import { Module6Workflow } from "@/components/modules/module6";
import { Module7Workflow } from "@/components/modules/module7";
import { Module8Workflow } from "@/components/modules/module8";
import { Module9Workflow } from "@/components/modules/module9";

type HealthResponse = {
  status: string;
  service: string;
  database_connected: boolean;
};

type Module4OverviewData = {
  workflow_status: string;
  queue_size: number;
  active_alerts: number;
  resolved_today: number;
  alerts: Array<{
    id: number;
    title: string;
    zone: string;
    severity: string;
    description: string;
    status: string;
  }>;
};

type Module5OverviewData = {
  pipeline_name: string;
  framework: string;
  input_sources: string[];
  features: Array<{
    name: string;
    description: string;
    status: string;
  }>;
};

type Module6OverviewData = {
  model_name: string;
  task: string;
  input_types: string[];
  features: Array<{
    name: string;
    description: string;
    status: string;
  }>;
};

type Module7OverviewData = {
  model_name: string;
  task: string;
  input_types: string[];
  features: Array<{
    name: string;
    description: string;
    status: string;
  }>;
};

type Module8OverviewData = {
  model_name: string;
  task: string;
  input_types: string[];
  features: Array<{
    name: string;
    description: string;
    status: string;
  }>;
};

type Module9OverviewData = {
  task: string;
  features: Array<{
    name: string;
    description: string;
    status: string;
  }>;
};

const statCards = [
  { label: "Active Cameras", value: "12", tone: "bg-slate-900 text-white" },
  { label: "Alerts Today", value: "4", tone: "bg-emerald-600 text-white" },
  { label: "Missing Persons", value: "8", tone: "bg-amber-500 text-white" },
];

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [module4Data, setModule4Data] = useState<Module4OverviewData | null>(null);
  const [module4Error, setModule4Error] = useState<string | null>(null);
  const [module5Data, setModule5Data] = useState<Module5OverviewData | null>(null);
  const [module5Error, setModule5Error] = useState<string | null>(null);
  const [module6Data, setModule6Data] = useState<Module6OverviewData | null>(null);
  const [module6Error, setModule6Error] = useState<string | null>(null);
  const [module7Data, setModule7Data] = useState<Module7OverviewData | null>(null);
  const [module7Error, setModule7Error] = useState<string | null>(null);
  const [module8Data, setModule8Data] = useState<Module8OverviewData | null>(null);
  const [module8Error, setModule8Error] = useState<string | null>(null);
  const [module9Data, setModule9Data] = useState<Module9OverviewData | null>(null);
  const [module9Error, setModule9Error] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/backend/health")
      .then((res) => {
        if (!res.ok) throw new Error("Backend returned an error");
        return res.json();
      })
      .then(setHealth)
      .catch(() => setHealthError("Could not reach backend. Is FastAPI running?"));

    fetch("/api/backend/module4/overview")
      .then((res) => {
        if (!res.ok) throw new Error("Module 4 data unavailable");
        return res.json();
      })
      .then(setModule4Data)
      .catch(() => setModule4Error("Module 4 workflow data is currently unavailable."));

    fetch("/api/backend/module5/overview")
      .then((res) => {
        if (!res.ok) throw new Error("Module 5 data unavailable");
        return res.json();
      })
      .then(setModule5Data)
      .catch(() => setModule5Error("Module 5 video processing data is currently unavailable."));

    fetch("/api/backend/module6/overview")
      .then((res) => {
        if (!res.ok) throw new Error("Module 6 data unavailable");
        return res.json();
      })
      .then(setModule6Data)
      .catch(() => setModule6Error("Module 6 detection data is currently unavailable."));

    fetch("/api/backend/module7/overview")
      .then((res) => {
        if (!res.ok) throw new Error("Module 7 data unavailable");
        return res.json();
      })
      .then(setModule7Data)
      .catch(() => setModule7Error("Module 7 face detection data is currently unavailable."));

    fetch("/api/backend/module8/overview")
      .then((res) => {
        if (!res.ok) throw new Error("Module 8 data unavailable");
        return res.json();
      })
      .then(setModule8Data)
      .catch(() => setModule8Error("Module 8 face recognition data is currently unavailable."));

    fetch("/api/backend/module9/overview")
      .then((res) => {
        if (!res.ok) throw new Error("Module 9 data unavailable");
        return res.json();
      })
      .then(setModule9Data)
      .catch(() => setModule9Error("Module 9 registration data is currently unavailable."));
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
                Live monitoring overview covering camera status, system health, alerts, and detection module status (Modules 3–9).
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
        <Module4Workflow overview={module4Data} error={module4Error} />
        <Module5Workflow overview={module5Data} error={module5Error} />
        <Module6Workflow overview={module6Data} error={module6Error} />
        <Module7Workflow overview={module7Data} error={module7Error} />
        <Module8Workflow overview={module8Data} error={module8Error} />
        <Module9Workflow overview={module9Data} error={module9Error} />

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
              {healthError && <p className="text-rose-600">{healthError}</p>}
              {!healthError && !health && <p>Checking backend connection...</p>}
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
