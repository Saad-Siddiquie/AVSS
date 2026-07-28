import type { Camera } from "@/types/camera";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-slate-100 text-slate-600",
  error: "bg-rose-100 text-rose-700",
};

const TYPE_LABELS: Record<string, string> = {
  rtsp: "RTSP",
  webcam: "Webcam",
  file: "Video File",
};

type CameraListProps = {
  cameras: Camera[];
  loading: boolean;
  deletingId: number | null;
  onEdit: (camera: Camera) => void;
  onDelete: (id: number) => void;
};

export function CameraList({
  cameras,
  loading,
  deletingId,
  onEdit,
  onDelete,
}: CameraListProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <p className="text-sm text-slate-500">Loading cameras...</p>
      </div>
    );
  }

  if (cameras.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 shadow-sm text-center">
        <p className="text-slate-500 font-medium">No cameras registered yet.</p>
        <p className="mt-1 text-sm text-slate-400">
          Click &ldquo;+ Add Camera&rdquo; to register your first camera source.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-left">
            <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
            <th className="px-4 py-3 font-semibold text-slate-600">Type</th>
            <th className="px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">URL</th>
            <th className="px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Location</th>
            <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
            <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {cameras.map((camera, index) => (
            <tr
              key={camera.id}
              className={`border-b border-slate-100 last:border-0 ${
                index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
              }`}
            >
              <td className="px-4 py-3 font-medium text-slate-900">{camera.name}</td>
              <td className="px-4 py-3 text-slate-600">
                {TYPE_LABELS[camera.camera_type] ?? camera.camera_type}
              </td>
              <td className="px-4 py-3 text-slate-500 hidden md:table-cell max-w-[200px] truncate">
                <span title={camera.url}>{camera.url}</span>
              </td>
              <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                {camera.location ?? "—"}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                    STATUS_STYLES[camera.status] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {camera.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(camera)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(camera.id)}
                    disabled={deletingId === camera.id}
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                  >
                    {deletingId === camera.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
