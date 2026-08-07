"use client";

import { useState, type ChangeEvent } from "react";

type SearchResult = {
  rank: number;
  person_id: number;
  person_name: string;
  similarity: number;
  distance: number;
};

type SearchResponse = {
  query_processed: boolean;
  total_results: number;
  results: SearchResult[];
  index_size: number;
};

export default function SearchPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [topK, setTopK] = useState(5);
  const [minSim, setMinSim] = useState(0.30);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setResponse(null);
    setError(null);
  };

  const handleSearch = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const body = new FormData();
      body.append("image", selectedFile);
      const res = await fetch(
        `/api/backend/search/face?top_k=${topK}&min_similarity=${minSim}`,
        { method: "POST", body }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.detail ?? `Server error ${res.status}`);
      }
      setResponse(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const simColor = (sim: number) => {
    if (sim >= 0.70) return "bg-emerald-100 text-emerald-700";
    if (sim >= 0.50) return "bg-amber-100 text-amber-700";
    return "bg-slate-100 text-slate-600";
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl flex flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Module 10</p>
          <h1 className="text-2xl font-bold text-slate-900">Face Similarity Search</h1>
          <p className="mt-1 text-sm text-slate-600">
            Upload a face photo. FAISS searches the embedding index for the most similar registered persons.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4">
          <label className="text-sm font-medium text-slate-700" htmlFor="search-photo">
            Query Face Photo
            <input id="search-photo" type="file" accept="image/jpeg,image/png,image/webp"
              onChange={handleFile}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>

          {previewUrl && (
            <img src={previewUrl} alt="Query face" className="h-48 w-full object-cover rounded-xl border border-slate-200" />
          )}

          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm font-medium text-slate-700">
              Top K results
              <input type="number" min={1} max={20} value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Min similarity (0–1)
              <input type="number" min={0} max={1} step={0.05} value={minSim}
                onChange={(e) => setMinSim(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </div>

          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}

          <button onClick={handleSearch} disabled={!selectedFile || loading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-slate-700 transition-colors">
            {loading ? "Searching..." : "Search by Face"}
          </button>
        </div>

        {response && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">
                {response.total_results} result{response.total_results !== 1 ? "s" : ""} found
              </h2>
              <span className="text-xs text-slate-400">Index size: {response.index_size} embeddings</span>
            </div>

            {response.total_results === 0 ? (
              <p className="text-sm text-slate-500">
                No matches found above the similarity threshold ({minSim}). 
                Try registering more persons or lowering the threshold.
              </p>
            ) : (
              <ul className="space-y-3">
                {response.results.map((r) => (
                  <li key={r.rank} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 w-6">#{r.rank}</span>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{r.person_name}</p>
                        <p className="text-xs text-slate-400">Person ID: {r.person_id}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${simColor(r.similarity)}`}>
                        {(r.similarity * 100).toFixed(1)}% match
                      </span>
                      <p className="text-xs text-slate-400 mt-1">dist: {r.distance.toFixed(4)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
