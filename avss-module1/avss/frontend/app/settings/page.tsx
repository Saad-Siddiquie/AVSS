"use client";
import { useEffect, useState } from "react";
import { Save, LogOut, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui";
import Toggle from "@/components/layout/Toggle";
import { applyTheme, THEME_KEY } from "@/components/layout/ThemeSync";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";

interface SystemStatus {
  database:         { status: string };
  backend_api:      { status: string };
  face_detector:    { status: string; model: string };
  face_recognition: { status: string; model: string };
  person_reid:      { status: string; model: string };
  disk:             { uploads_used_mb: number };
}

function StatusDot({ status }: { status: string }) {
  const color = status === "online" ? "bg-ok" : status === "not_loaded" ? "bg-warn" : "bg-danger";
  const label = status === "online" ? "Online" : status === "not_loaded" ? "Not loaded" : "Error";
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${color}`}/>
      <span className={status === "online" ? "text-ok" : status === "not_loaded" ? "text-warn" : "text-danger"}>
        {label}
      </span>
    </span>
  );
}

export default function SettingsPage() {
  const { user, clearToken, authFetch } = useAuth();

  const [systemName,   setSystemName]   = useState("AVSS");
  const [theme,        setTheme]        = useState("dark");
  const [notifications,setNotifs]       = useState(true);
  const [faceWeight,   setFaceWeight]   = useState(60);
  const [faceThresh,   setFaceThresh]   = useState(80);
  const [bodyThresh,   setBodyThresh]   = useState(70);
  const [saved,        setSaved]        = useState(false);
  const [sysStatus,    setSysStatus]    = useState<SystemStatus | null>(null);
  const [loadingStatus,setLoadingStatus]= useState(true);

  // Load current settings + status from backend
  useEffect(() => {
    authFetch(`${API}/settings`).then(r => {
      if (r.ok) r.json().then(d => {
        if (d.system_name)    setSystemName(d.system_name);
        if (d.theme)          { setTheme(d.theme); applyTheme(d.theme); }
        if (d.notifications !== undefined) setNotifs(d.notifications);
        if (d.face_threshold) setFaceThresh(d.face_threshold);
        if (d.body_threshold) setBodyThresh(d.body_threshold);
        if (d.face_weight)    setFaceWeight(d.face_weight);
      });
    });

    authFetch(`${API}/settings/status`).then(r => {
      if (r.ok) r.json().then(d => setSysStatus(d));
    }).finally(() => setLoadingStatus(false));
  }, []);

  async function save() {
    try {
      localStorage.setItem(THEME_KEY, theme);
      applyTheme(theme);
    } catch { /* */ }

    await authFetch(`${API}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_name:    systemName,
        theme,
        notifications,
        face_threshold: faceThresh,
        body_threshold: bodyThresh,
        face_weight:    faceWeight,
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const refreshStatus = () => {
    setLoadingStatus(true);
    authFetch(`${API}/settings/status`).then(r => {
      if (r.ok) r.json().then(d => setSysStatus(d));
    }).finally(() => setLoadingStatus(false));
  };

  const row   = "flex items-center justify-between gap-4 py-3.5 border-b border-edge/40 last:border-0";
  const panel = "glass p-5";

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Settings" subtitle="Manage system preferences and model parameters."/>

        {/* General */}
        <section className={panel} aria-labelledby="s-general">
          <h2 id="s-general" className="font-display text-base font-semibold mb-3">General</h2>
          <div className="divide-y divide-edge/40">
            <div className={row}>
              <div><p className="text-sm font-medium">System Name</p></div>
              <input value={systemName} onChange={e => setSystemName(e.target.value)} className="field max-w-48"/>
            </div>
            <div className={row}>
              <div><p className="text-sm font-medium">Theme</p><p className="text-xs text-mute">Dashboard appearance</p></div>
              <select value={theme} onChange={e => { setTheme(e.target.value); applyTheme(e.target.value); }} className="field max-w-48">
                <option value="dark">Dark</option>
                <option value="midnight">Midnight (deeper)</option>
              </select>
            </div>
            <div className={row}>
              <div><p className="text-sm font-medium">Notifications</p><p className="text-xs text-mute">Show alert banners</p></div>
              <Toggle label="Enable notifications" checked={notifications} onChange={setNotifs}/>
            </div>
          </div>
        </section>

        {/* AI Model */}
        <section className={panel} aria-labelledby="s-model">
          <h2 id="s-model" className="font-display text-base font-semibold mb-3">AI Model</h2>
          <div className="divide-y divide-edge/40">
            <div className={row}>
              <div><p className="text-sm font-medium">Face match threshold (%)</p><p className="text-xs text-mute">Below this = no face match</p></div>
              <div className="flex items-center gap-3 w-48">
                <input type="range" min={50} max={99} value={faceThresh} onChange={e => setFaceThresh(Number(e.target.value))} className="flex-1 accent-accent"/>
                <output className="w-10 text-right text-sm tabular-nums">{faceThresh}%</output>
              </div>
            </div>
            <div className={row}>
              <div><p className="text-sm font-medium">Clothing threshold (%)</p><p className="text-xs text-mute">OSNet minimum similarity</p></div>
              <div className="flex items-center gap-3 w-48">
                <input type="range" min={40} max={99} value={bodyThresh} onChange={e => setBodyThresh(Number(e.target.value))} className="flex-1 accent-accent"/>
                <output className="w-10 text-right text-sm tabular-nums">{bodyThresh}%</output>
              </div>
            </div>
            <div className={row}>
              <div><p className="text-sm font-medium">Face weight in fusion (%)</p><p className="text-xs text-mute">Remainder = clothing weight</p></div>
              <div className="flex items-center gap-3 w-48">
                <input type="range" min={0} max={100} value={faceWeight} onChange={e => setFaceWeight(Number(e.target.value))} className="flex-1 accent-accent"/>
                <output className="w-10 text-right text-sm tabular-nums">{faceWeight}%</output>
              </div>
            </div>
          </div>

          {/* Pipeline component info */}
          <div className="mt-4">
            <p className="text-xs text-mute mb-2">Pipeline components</p>
            <dl className="grid grid-cols-3 gap-3">
              {[
                ["Detection",        "YOLOv8",   "Finds people in frames"],
                ["Face Recognition", "ArcFace",  "512-dim embeddings"],
                ["Re-ID",            "OSNet",     "Clothing matching"],
              ].map(([k, v, d]) => (
                <div key={k} className="rounded-lg bg-panel-2 p-3">
                  <dt className="text-xs text-mute">{k}</dt>
                  <dd className="font-display font-semibold">{v}</dd>
                  <dd className="text-xs text-mute mt-0.5">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* System Status */}
        <section className={panel} aria-labelledby="s-status">
          <div className="flex items-center justify-between mb-3">
            <h2 id="s-status" className="font-display text-base font-semibold">System Status</h2>
            <button onClick={refreshStatus} className="btn-ghost px-2.5 py-1.5 text-xs" aria-label="Refresh status">
              <RefreshCw className={`size-3.5 ${loadingStatus ? "animate-spin" : ""}`}/>
            </button>
          </div>

          {loadingStatus ? (
            <div className="animate-pulse space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-8 rounded-lg bg-panel-2"/>)}
            </div>
          ) : sysStatus ? (
            <div className="divide-y divide-edge/40">
              {[
                { label: "Database",          status: sysStatus.database.status,         note: "" },
                { label: "Backend API",       status: sysStatus.backend_api.status,      note: "" },
                { label: "Face Detector",     status: sysStatus.face_detector.status,    note: sysStatus.face_detector.model },
                { label: "Face Recognition",  status: sysStatus.face_recognition.status, note: sysStatus.face_recognition.model },
                { label: "Person Re-ID",      status: sysStatus.person_reid.status,      note: sysStatus.person_reid.model },
              ].map(({ label, status, note }) => (
                <div key={label} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm">{label}</p>
                    {note && <p className="text-xs text-mute">{note}</p>}
                  </div>
                  <StatusDot status={status}/>
                </div>
              ))}
              <div className="flex items-center justify-between py-2.5">
                <p className="text-sm">Uploads disk usage</p>
                <span className="text-xs text-mute">{sysStatus.disk.uploads_used_mb} MB</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-mute">Could not load status. Is the backend running?</p>
          )}
        </section>

        {/* Save */}
        <div className="space-y-2">
          <button onClick={save} className="btn-primary w-full justify-center">
            <Save className="size-4"/> Save Changes
          </button>
          <p role="status" className="min-h-5 text-center text-sm text-ok">
            {saved ? "Changes saved ✓" : ""}
          </p>
        </div>

        {/* Account */}
        <section className="glass flex items-center justify-between gap-4 p-5">
          <div>
            <h2 className="font-display text-base font-semibold">Account</h2>
            <p className="text-xs text-mute">Signed in as {user?.email}</p>
          </div>
          <button onClick={clearToken} className="btn-ghost">
            <LogOut className="size-4"/> Logout
          </button>
        </section>
      </div>
    </AppShell>
  );
}
