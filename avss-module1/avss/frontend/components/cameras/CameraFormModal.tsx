"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { Camera, CameraFormData, CameraStatus, CameraType } from "@/types/camera";

type CameraFormModalProps = {
  camera: Camera | null;   // null = create mode, Camera = edit mode
  saving: boolean;
  error: string | null;
  onSave: (data: CameraFormData) => void;
  onClose: () => void;
};

const EMPTY_FORM: CameraFormData = {
  name: "",
  url: "",
  camera_type: "rtsp",
  location: "",
  status: "inactive",
};

const TYPE_HINTS: Record<CameraType, string> = {
  rtsp: "e.g. rtsp://192.168.1.100:554/stream",
  webcam: "e.g. 0  or  /dev/video0",
  file: "e.g. /home/user/videos/sample.mp4",
};

export function CameraFormModal({
  camera,
  saving,
  error,
  onSave,
  onClose,
}: CameraFormModalProps) {
  const isEdit = camera !== null;
  const [form, setForm] = useState<CameraFormData>(EMPTY_FORM);

  // Populate form when editing
  useEffect(() => {
    if (camera) {
      setForm({
        name: camera.name,
        url: camera.url,
        camera_type: camera.camera_type,
        location: camera.location ?? "",
        status: camera.status,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [camera]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Dialog */}
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Module 4
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              {isEdit ? "Edit Camera" : "Add Camera"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="grid gap-4 p-6">
          {/* Name */}
          <label className="text-sm font-medium text-slate-700">
            Camera Name *
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="e.g. Front Entrance"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </label>

          {/* Type */}
          <label className="text-sm font-medium text-slate-700">
            Camera Type *
            <select
              name="camera_type"
              value={form.camera_type}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
            >
              <option value="rtsp">RTSP Stream</option>
              <option value="webcam">Webcam / USB Camera</option>
              <option value="file">Video File</option>
            </select>
          </label>

          {/* URL */}
          <label className="text-sm font-medium text-slate-700">
            URL / Path *
            <input
              name="url"
              value={form.url}
              onChange={handleChange}
              required
              placeholder={TYPE_HINTS[form.camera_type]}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <span className="mt-1 block text-xs text-slate-400">
              {TYPE_HINTS[form.camera_type]}
            </span>
          </label>

          {/* Location */}
          <label className="text-sm font-medium text-slate-700">
            Location
            <input
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="e.g. Main Gate, Parking Lot"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </label>

          {/* Status */}
          <label className="text-sm font-medium text-slate-700">
            Status
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
            >
              <option value="inactive">Inactive</option>
              <option value="active">Active</option>
              <option value="error">Error</option>
            </select>
          </label>

          {/* Error message */}
          {error && (
            <p className="text-sm font-medium text-rose-600">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Camera"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
