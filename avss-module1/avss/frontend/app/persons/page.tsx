"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type Person = {
  id: number;
  name: string;
  age: number;
  gender: string;
  description: string | null;
  photo_filename: string;
  has_embedding: boolean;
};

type SubmitState = "idle" | "loading" | "success" | "error";

export default function PersonsPage() {
  const router = useRouter();
  const { authHeaders, isLoggedIn, ready } = useAuth();

  const [persons, setPersons] = useState<Person[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", age: "", gender: "", description: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !isLoggedIn) router.push("/login");
  }, [ready, isLoggedIn, router]);

  const fetchPersons = async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch("/api/backend/persons", { headers: authHeaders() });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setPersons(await res.json());
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load persons.");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) fetchPersons();
  }, [isLoggedIn]);

  const handleInput = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handlePhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhoto(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!photo) { setSubmitState("error"); setSubmitMessage("Please select a photo."); return; }
    setSubmitState("loading");
    setSubmitMessage(null);
    try {
      const body = new FormData();
      body.append("name", form.name.trim());
      body.append("age", form.age);
      body.append("gender", form.gender.trim());
      body.append("description", form.description.trim());
      body.append("photo", photo);

      const res = await fetch("/api/backend/persons/register", {
        method: "POST",
        headers: authHeaders(),   // no Content-Type — browser sets multipart boundary
        body,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.detail ?? `Server error ${res.status}`);
      }
      const data = await res.json();
      setSubmitState("success");
      setSubmitMessage(
        `✓ ${data.message}${data.has_embedding
          ? " Face embedding generated."
          : " (No face detected — embedding skipped.)"
        }`
      );
      setForm({ name: "", age: "", gender: "", description: "" });
      setPhoto(null);
      setPreviewUrl(null);
      await fetchPersons();
    } catch (err) {
      setSubmitState("error");
      setSubmitMessage(err instanceof Error ? err.message : "Registration failed.");
    }
  };

  if (!ready) return null;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl flex flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Module 9</p>
          <h1 className="text-2xl font-bold text-slate-900">Person Registration</h1>
          <p className="mt-1 text-sm text-slate-600">
            Register a person with photo. InsightFace generates a 512-dim embedding for search.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Registration form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4">Register New Person</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="text-sm font-medium text-slate-700">
                Full Name *
                <input name="name" value={form.name} onChange={handleInput} required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. Ahmed Ali" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-slate-700">
                  Age *
                  <input name="age" type="number" min={1} max={120} value={form.age}
                    onChange={handleInput} required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Gender *
                  <select name="gender" value={form.gender} onChange={handleInput} required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
              </div>
              <label className="text-sm font-medium text-slate-700">
                Description
                <textarea name="description" value={form.description} onChange={handleInput}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[80px]"
                  placeholder="Physical description, notes..." />
              </label>
              <label className="text-sm font-medium text-slate-700" htmlFor="photo-input">
                Photo *
                <input id="photo-input" type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhoto} required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              {previewUrl && (
                <img src={previewUrl} alt="Preview"
                  className="w-full h-40 object-cover rounded-xl border border-slate-200" />
              )}
              {submitMessage && (
                <p className={`text-sm font-medium ${submitState === "success" ? "text-emerald-700" : "text-rose-600"}`}>
                  {submitMessage}
                </p>
              )}
              <button type="submit" disabled={submitState === "loading"}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-slate-700 transition-colors">
                {submitState === "loading" ? "Registering..." : "Register Person"}
              </button>
            </form>
          </div>

          {/* Registered persons list */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4">
              Registered Persons{" "}
              <span className="text-slate-400 font-normal text-sm">({persons.length})</span>
            </h2>
            {loadingList && <p className="text-sm text-slate-500">Loading...</p>}
            {listError && <p className="text-sm text-rose-600">{listError}</p>}
            {!loadingList && persons.length === 0 && (
              <p className="text-sm text-slate-400">No persons registered yet.</p>
            )}
            <ul className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {persons.map((p) => (
                <li key={p.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.gender}, {p.age} yrs</p>
                    {p.description && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{p.description}</p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    p.has_embedding
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {p.has_embedding ? "Embedded" : "No embed"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
