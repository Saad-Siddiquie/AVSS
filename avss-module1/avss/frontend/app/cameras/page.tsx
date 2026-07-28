"use client";

import { useEffect, useState } from "react";
import { CameraList } from "@/components/cameras/CameraList";
import { CameraFormModal } from "@/components/cameras/CameraFormModal";
import type { Camera, CameraFormData } from "@/types/camera";

export default function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchCameras = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backend/cameras");
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setCameras(data.cameras);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cameras.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  const openAddModal = () => {
    setEditingCamera(null);
    setSaveError(null);
    setModalOpen(true);
  };

  const openEditModal = (camera: Camera) => {
    setEditingCamera(camera);
    setSaveError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCamera(null);
    setSaveError(null);
  };

  const handleSave = async (formData: CameraFormData) => {
    setSaving(true);
    setSaveError(null);
    try {
      const isEdit = editingCamera !== null;
      const url = isEdit
        ? `/api/backend/cameras/${editingCamera.id}`
        : "/api/backend/cameras";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail ?? `Server error ${res.status}`);
      }

      closeModal();
      await fetchCameras();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cameraId: number) => {
    setDeletingId(cameraId);
    try {
      const res = await fetch(`/api/backend/cameras/${cameraId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      await fetchCameras();
    } catch {
      setError("Failed to delete camera. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl flex flex-col gap-6">

        {/* Header */}
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                Module 4
              </p>
              <h1 className="text-2xl font-bold text-slate-900">Camera Management</h1>
              <p className="mt-1 text-sm text-slate-600">
                Register and manage RTSP, webcam, and video file sources.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">{total} camera{total !== 1 ? "s" : ""}</span>
              <button
                onClick={openAddModal}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
              >
                + Add Camera
              </button>
            </div>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Camera list */}
        <CameraList
          cameras={cameras}
          loading={loading}
          deletingId={deletingId}
          onEdit={openEditModal}
          onDelete={handleDelete}
        />

        {/* Add / Edit modal */}
        {modalOpen && (
          <CameraFormModal
            camera={editingCamera}
            saving={saving}
            error={saveError}
            onSave={handleSave}
            onClose={closeModal}
          />
        )}
      </div>
    </main>
  );
}
