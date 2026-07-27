"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  service: string;
  database_connected: boolean;
};

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/backend/health")
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setError("Could not reach backend. Is FastAPI running?"));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold">AVSS</h1>
      <p className="text-muted-foreground">
        Autonomous Video Surveillance System — Project Setup (Module 1)
      </p>

      <div className="mt-6 rounded-lg border p-4 text-sm">
        {error && <p className="text-destructive">{error}</p>}
        {!error && !health && <p>Checking backend connection...</p>}
        {health && (
          <ul className="space-y-1">
            <li>Backend status: {health.status}</li>
            <li>Service: {health.service}</li>
            <li>
              Database connected:{" "}
              {health.database_connected ? "✅ yes" : "❌ no"}
            </li>
          </ul>
        )}
      </div>
    </main>
  );
}
