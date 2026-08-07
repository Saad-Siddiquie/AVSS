"use client";

import { useRef, useState, useEffect, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type BoundingBox = {
  x1: number; y1: number; x2: number; y2: number;
  confidence: number; label: string; width: number; height: number;
};

type DetectionResponse = {
  person_count?: number;
  face_count?: number;
  detections: BoundingBox[];
  image_width: number;
  image_height: number;
};

type Mode = "persons" | "faces";

export default function DetectPage() {
  const router = useRouter();
  const { authHeaders, isLoggedIn, ready } = useAuth();
  const [mode, setMode] = useState<Mode>("persons");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (ready && !isLoggedIn) router.push("/login");
  }, [ready, isLoggedIn, router]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setResult(null);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const drawBoxes = (response: DetectionResponse) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const color = mode === "persons" ? "#22c55e" : "#3b82f6";
    response.detections.forEach((box) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x1, box.y1, box.width, box.height);
      ctx.fillStyle = color;
      ctx.font = "bold 16px sans-serif";
      const label = `${box.label} ${(box.confidence * 100).toFixed(0)}%`;
      const textW = ctx.measureText(label).width;
      ctx.fillRect(box.x1, box.y1 - 22, textW + 8, 22);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, box.x1 + 4, box.y1 - 5);
    });
  };

  const handleDetect = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("image", selectedFile);
      const endpoint = mode === "persons" ? "/api/backend/detect/persons" : "/api/backend/detect/faces";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: authHeaders(),
        body,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.detail ?? `Server error ${res.status}`);
      }
      const data: DetectionResponse = await res.json();
      setResult(data);
      // Draw boxes after image renders
      setTimeout(() => drawBoxes(data), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Detection failed.");
    } finally {
      setLoading(false);
    }
  };

  const count = result?.person_count ?? result?.face_count ?? 0;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl flex flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
            Modules 6 & 7
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Person & Face Detection</h1>
          <p className="mt-1 text-sm text-slate-600">
            Upload an image to detect persons (YOLOv8) or faces (OpenCV DNN).
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4">
          {/* Mode selector */}
          <div className="flex gap-2">
            {(["persons", "faces"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setResult(null); }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                  mode === m ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Detect {m}
              </button>
            ))}
          </div>

          {/* File input */}
          <label className="text-sm font-medium text-slate-700">
            Upload Image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          {/* Preview + canvas overlay */}
          {previewUrl && (
            <div className="relative w-full overflow-hidden rounded-xl border border-slate-200">
              <img
                ref={imgRef}
                src={previewUrl}
                alt="Preview"
                className="w-full"
                onLoad={() => result && drawBoxes(result)}
              />
              {result && (
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                  style={{ pointerEvents: "none" }}
                />
              )}
            </div>
          )}

          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}

          {result && (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="font-semibold">
                {count} {mode === "persons" ? "person" : "face"}{count !== 1 ? "s" : ""} detected
              </span>
              {count > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.detections.map((d, i) => (
                    <li key={i} className="flex gap-4 text-xs text-slate-500">
                      <span>#{i + 1}</span>
                      <span>Confidence: {(d.confidence * 100).toFixed(1)}%</span>
                      <span>Size: {Math.round(d.width)}×{Math.round(d.height)}px</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            onClick={handleDetect}
            disabled={!selectedFile || loading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-slate-700 transition-colors"
          >
            {loading ? "Running detection..." : `Detect ${mode}`}
          </button>
        </div>
      </div>
    </main>
  );
}
