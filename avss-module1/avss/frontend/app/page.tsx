"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type HealthResponse = {
  status: string;
  service: string;
  database_connected: boolean;
};

const MODULE_CARDS = [
  {
    module: "Module 4",
    title: "Camera Management",
    description: "Add, edit, delete RTSP streams, webcams, and video file sources.",
    href: "/cameras",
    badge: "CRUD",
    color: "bg-blue-50 border-blue-200",
  },
  {
    module: "Modules 5 & 6",
    title: "Video & Person Detection",
    description: "OpenCV video pipeline + YOLOv8 person detection with bounding boxes.",
    href: "/detect",
    badge: "YOLOv8",
    color: "bg-emerald-50 border-emerald-200",
  },
  {
    module: "Modules 7 & 8",
    title: "Face Detection & Recognition",
    description: "OpenCV DNN face detector + InsightFace 512-dim embedding generation.",
    href: "/detect",
    badge: "InsightFace",
    color: "bg-violet-50 border-violet-200",
  },
  {
    module: "Module 9",
    title: "Person Registration",
    description: "Register persons with photo. Auto-generates face embedding on upload.",
    href: "/persons",
    badge: "Registration",
    color: "bg-amber-50 border-amber-200",
  },
  {
    module: "Module 10",
    title: "FAISS Similarity Search",
    description: "Search for a person by face photo. Returns ranked matches from the index.",
    href: "/search",
    badge: "FAISS",
    color: "bg-rose-50 border-rose-200",
  },
];

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/backend/health")
      .then((r) => { if (!r.ok) throw new Error("Backend error"); return r.json(); })
      .then(setHealth)
      .catch(() => setHealthError("Cannot reach backend. Is FastAPI running?"));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">

        {/* Header */}
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">AVSS Dashboard</p>
              <h1 className="text-3xl font-bold">Autonomous Video Surveillance System</h1>
              <p className="mt-2 text-sm text-slate-600 max-w-2xl">
                AI-powered surveillance platform. Person detection, face recognition, FAISS search,
                and multi-camera management — built as a BSCS Final Year Project.
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
              health?.status === "ok"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}>
              {health ? (health.status === "ok" ? "System Online" : "Degraded") : healthError ? "Offline" : "Checking..."}
            </span>
          </div>
        </header>

        {/* Backend health */}
        {health && (
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Backend", value: health.status === "ok" ? "Online" : "Error", ok: health.status === "ok" },
              { label: "Database", value: health.database_connected ? "Connected" : "Disconnected", ok: health.database_connected },
              { label: "Service", value: health.service, ok: true },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{item.label}</p>
                <p className={`mt-1 text-lg font-semibold ${item.ok ? "text-emerald-700" : "text-rose-600"}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        )}
        {healthError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
            {healthError}
          </div>
        )}

        {/* Module cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {MODULE_CARDS.map((card) => (
            <Link
              key={card.href + card.module}
              href={card.href}
              className={`group rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow ${card.color}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{card.module}</p>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-slate-700 shadow-sm">
                  {card.badge}
                </span>
              </div>
              <h2 className="font-bold text-slate-900 group-hover:underline">{card.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{card.description}</p>
            </Link>
          ))}
        </div>

        {/* API reference */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-3">API Endpoints</h2>
          <div className="grid gap-2 sm:grid-cols-2 text-xs font-mono">
            {[
              ["POST", "/api/v1/cameras", "Add camera"],
              ["GET",  "/api/v1/cameras", "List cameras"],
              ["GET",  "/api/v1/video/probe", "Probe video source"],
              ["POST", "/api/v1/detect/persons", "Detect persons (YOLOv8)"],
              ["POST", "/api/v1/detect/faces", "Detect faces (DNN)"],
              ["POST", "/api/v1/recognize/embed", "Generate face embedding"],
              ["POST", "/api/v1/recognize/compare", "Compare two faces"],
              ["POST", "/api/v1/persons/register", "Register person"],
              ["GET",  "/api/v1/persons", "List persons"],
              ["POST", "/api/v1/search/face", "Search by face (FAISS)"],
            ].map(([method, path, desc]) => (
              <div key={path + method} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span className={`font-bold ${method === "POST" ? "text-emerald-700" : "text-blue-700"}`}>
                  {method}
                </span>
                <span className="text-slate-700 truncate">{path}</span>
                <span className="text-slate-400 ml-auto hidden lg:block">{desc}</span>
              </div>
            ))}
          </div>
          <a
            href="http://localhost:8001/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          >
            Open Swagger UI →
          </a>
        </div>

      </div>
    </main>
  );
}
