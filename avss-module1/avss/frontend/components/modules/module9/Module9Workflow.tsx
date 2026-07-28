import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

type FeatureItem = {
  name: string;
  description: string;
  status: string;
};

type Module9WorkflowProps = {
  overview: {
    task: string;
    features: FeatureItem[];
  } | null;
  error: string | null;
};

type SubmitState = "idle" | "loading" | "success" | "error";

export function Module9Workflow({ overview, error }: Module9WorkflowProps) {
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "",
    description: "",
  });
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedPhoto(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedPhoto) {
      setSubmitState("error");
      setSubmitMessage("Please select a photo before registering.");
      return;
    }

    if (!formData.name.trim() || !formData.age || !formData.gender.trim()) {
      setSubmitState("error");
      setSubmitMessage("Name, age, and gender are required.");
      return;
    }

    setSubmitState("loading");
    setSubmitMessage(null);

    try {
      const body = new FormData();
      body.append("name", formData.name.trim());
      body.append("age", formData.age);
      body.append("gender", formData.gender.trim());
      body.append("description", formData.description.trim());
      body.append("photo", selectedPhoto);

      const res = await fetch("/api/backend/module9/register", {
        method: "POST",
        body,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail ?? `Server error ${res.status}`);
      }

      const data = await res.json();
      setSubmitState("success");
      setSubmitMessage(data.message ?? "Person registered successfully.");

      // Reset form
      setFormData({ name: "", age: "", gender: "", description: "" });
      setSelectedPhoto(null);
      setPreviewUrl(null);
    } catch (err) {
      setSubmitState("error");
      setSubmitMessage(err instanceof Error ? err.message : "Registration failed.");
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Module 9</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Person registration</h2>
        </div>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">
          Registration
        </span>
      </div>

      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      {!error && !overview && <p className="mt-4 text-sm text-slate-600">Loading registration module...</p>}

      {overview && (
        <div className="mt-6 space-y-6">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Workflow</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{overview.task}</p>
          </div>

          <form className="grid gap-4 rounded-xl border border-slate-200 p-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Name
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Enter full name"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Age
                <input
                  name="age"
                  type="number"
                  min={1}
                  max={120}
                  value={formData.age}
                  onChange={handleInputChange}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Enter age"
                />
              </label>
            </div>
            <label className="text-sm font-medium text-slate-700">
              Gender
              <input
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Male / Female / Other"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Description
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Add descriptive notes"
              />
            </label>
            <label className="text-sm font-medium text-slate-700" htmlFor="person-photo-input">
              Upload Person Photo
              <input
                id="person-photo-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            {selectedPhoto && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-medium">Selected photo: {selectedPhoto.name}</p>
                {previewUrl && (
                  <img src={previewUrl} alt="Selected person preview" className="mt-3 h-40 w-full rounded-lg object-cover" />
                )}
              </div>
            )}

            {submitMessage && (
              <p className={`text-sm font-medium ${submitState === "success" ? "text-emerald-700" : "text-rose-600"}`}>
                {submitMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={submitState === "loading"}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitState === "loading" ? "Registering..." : "Register Person"}
            </button>
          </form>

          <div className="grid gap-3 md:grid-cols-2">
            {overview.features.map((feature) => (
              <div key={feature.name} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{feature.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{feature.description}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    {feature.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
