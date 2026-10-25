"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Bell, Camera, Cpu, LogOut, Save, Settings as Gear, Users, UserPlus, type LucideIcon } from "lucide-react";
import Toggle from "@/components/Toggle";
import { applyTheme, THEME_KEY } from "@/components/ThemeSync";
import { PageHeader } from "@/components/ui";
import { cameras } from "@/lib/data";
import { currentUser } from "@/lib/user";

type TabId = "general" | "cameras" | "model" | "notifications" | "users";
const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "general", label: "General", icon: Gear },
  { id: "cameras", label: "Cameras", icon: Camera },
  { id: "model", label: "Model", icon: Cpu },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "users", label: "User Management", icon: Users },
];

type User = { name: string; email: string; role: "Admin" | "Operator" | "Viewer" };

const defaults = {
  systemName: "AVSS",
  language: "en",
  theme: "dark",
  notifications: true,
  autoSaveLogs: true,
  faceThreshold: 80,
  bodyThreshold: 70,
  faceWeight: 60,
  alertUnknown: true,
  alertTarget: true,
  sound: false,
  email: true,
  enabled: Object.fromEntries(cameras.map((c) => [c.id, c.status === "online"])) as Record<string, boolean>,
  streams: Object.fromEntries(cameras.map((c) => [c.id, ""])) as Record<string, string>,
  users: [
    { name: currentUser.name, email: "saad@avss.local", role: "Admin" },
    { name: "Ayesha Khan", email: "ayesha@avss.local", role: "Operator" },
    { name: "Bilal Ahmed", email: "bilal@avss.local", role: "Viewer" },
  ] as User[],
};
type Settings = typeof defaults;

function Row({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {text && <p className="text-xs text-mute">{text}</p>}
      </div>
      {children}
    </div>
  );
}

function Slider({ id, value, min, max, onChange, unit = "%" }: { id: string; value: number; min: number; max: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div className="flex w-48 items-center gap-3">
      <input id={id} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-accent" />
      <output htmlFor={id} className="w-10 text-right text-sm tabular-nums">{value}{unit}</output>
    </div>
  );
}

export default function SettingsView() {
  const [s, setS] = useState<Settings>(defaults);
  const [tab, setTab] = useState<TabId>("general");
  const [saved, setSaved] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "Viewer" as User["role"] });
  const [inviteError, setInviteError] = useState("");

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    if (key === "theme") applyTheme(String(value)); // preview immediately; kept only after Save
  }

  function save() {
    // Replace with: PUT /api/settings (send everything except `theme`, which is a per-browser preference)
    try { localStorage.setItem(THEME_KEY, s.theme); } catch { /* storage unavailable */ }
    setSaved(true);
  }

  function addUser() {
    const email = invite.email.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setInviteError("Enter a valid email address.");
    if (s.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return setInviteError("That person already has access.");
    setInviteError("");
    // Replace with: POST /api/users/invite
    set("users", [...s.users, { name: email.split("@")[0], email, role: invite.role }]);
    setInvite({ email: "", role: "Viewer" });
  }

  const panel = "glass divide-y divide-edge/50 p-5";

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your system, cameras and preferences." />

      <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
        <div role="tablist" aria-orientation="vertical" aria-label="Settings sections" className="glass flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${tab === id ? "bg-accent/20 text-white ring-1 ring-accent/60" : "text-mute hover:bg-panel-2 hover:text-white"}`}>
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-4">
          {tab === "general" && (
            <section className={panel} aria-labelledby="h-general">
              <h2 id="h-general" className="pb-3 font-display text-base font-semibold">General Settings</h2>
              <Row title="System Name"><input aria-label="System name" value={s.systemName} onChange={(e) => set("systemName", e.target.value)} className="field max-w-60" /></Row>
              <Row title="Language">
                <select aria-label="Language" value={s.language} onChange={(e) => set("language", e.target.value)} className="field max-w-60">
                  <option value="en">English</option>
                  <option value="ur" disabled>Urdu (coming soon)</option>
                </select>
              </Row>
              <Row title="Theme">
                <select aria-label="Theme" value={s.theme} onChange={(e) => set("theme", e.target.value)} className="field max-w-60">
                  <option value="dark">Dark</option>
                  <option value="midnight">Midnight</option>
                </select>
              </Row>
              <Row title="Enable Notifications" text="Turn off to silence every alert type."><Toggle label="Enable notifications" checked={s.notifications} onChange={(v) => set("notifications", v)} /></Row>
              <Row title="Auto Save Logs" text="Keep detection and alert logs for review."><Toggle label="Auto save logs" checked={s.autoSaveLogs} onChange={(v) => set("autoSaveLogs", v)} /></Row>
            </section>
          )}

          {tab === "cameras" && (
            <section className="glass p-5" aria-labelledby="h-cams">
              <h2 id="h-cams" className="font-display text-base font-semibold">Cameras</h2>
              <p className="text-xs text-mute">Turned-off cameras stop detecting and drop out of Live Monitoring. Add each camera&rsquo;s stream address so the backend can read it.</p>
              <ul className="mt-3 divide-y divide-edge/40">
                {cameras.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="w-44 shrink-0">
                      <p className="text-sm">{c.name}</p>
                      <p className="text-xs text-mute">{c.zone}</p>
                    </div>
                    <input aria-label={`${c.name} stream URL`} placeholder="rtsp://host:554/stream" value={s.streams[c.id]} onChange={(e) => set("streams", { ...s.streams, [c.id]: e.target.value })} className="field min-w-48 flex-1" />
                    <Toggle label={`${c.name} enabled`} checked={s.enabled[c.id]} onChange={(v) => set("enabled", { ...s.enabled, [c.id]: v })} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "model" && (
            <>
              <section className={panel} aria-labelledby="h-model">
                <h2 id="h-model" className="pb-3 font-display text-base font-semibold">Model</h2>
                <Row title="Face match threshold" text="Faces scoring below this are treated as no face match."><Slider id="face-th" value={s.faceThreshold} min={50} max={99} onChange={(v) => set("faceThreshold", v)} /></Row>
                <Row title="Clothing match threshold" text="Minimum clothing (OSNet) similarity to link two sightings."><Slider id="body-th" value={s.bodyThreshold} min={40} max={99} onChange={(v) => set("bodyThreshold", v)} /></Row>
                <Row title="Face weight in final score" text={`Clothing counts for the remaining ${100 - s.faceWeight}%.`}><Slider id="fusion" value={s.faceWeight} min={0} max={100} onChange={(v) => set("faceWeight", v)} /></Row>
              </section>
              <section className="glass p-5" aria-labelledby="h-pipe">
                <h2 id="h-pipe" className="font-display text-base font-semibold">Pipeline</h2>
                <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                  {[["Detection", "YOLOv8", "Finds people and faces in each frame"], ["Face recognition", "ArcFace", "Compares the face with the reference"], ["Clothing re-ID", "OSNet", "Matches the body across cameras"]].map(([k, v, d]) => (
                    <div key={k} className="rounded-lg bg-panel-2 p-3"><dt className="text-xs text-mute">{k}</dt><dd className="font-display font-semibold">{v}</dd><dd className="mt-1 text-xs text-mute">{d}</dd></div>
                  ))}
                </dl>
              </section>
            </>
          )}

          {tab === "notifications" && (
            <section className={panel} aria-labelledby="h-notify">
              <h2 id="h-notify" className="pb-3 font-display text-base font-semibold">Notifications</h2>
              {!s.notifications && <p className="pb-3 text-xs text-warn">Notifications are switched off in General. These choices apply once you turn them back on.</p>}
              <Row title="Unknown person alerts" text="Alert when someone cannot be identified."><Toggle label="Unknown person alerts" checked={s.alertUnknown} onChange={(v) => set("alertUnknown", v)} /></Row>
              <Row title="Search target alerts" text="Alert when a reference person is matched."><Toggle label="Search target alerts" checked={s.alertTarget} onChange={(v) => set("alertTarget", v)} /></Row>
              <Row title="Alert sound" text="Play a sound in this browser tab."><Toggle label="Alert sound" checked={s.sound} onChange={(v) => set("sound", v)} /></Row>
              <Row title="Email summary" text="Send a daily summary to your account email."><Toggle label="Email summary" checked={s.email} onChange={(v) => set("email", v)} /></Row>
            </section>
          )}

          {tab === "users" && (
            <section className="glass p-5" aria-labelledby="h-users">
              <h2 id="h-users" className="font-display text-base font-semibold">User Management</h2>
              <ul className="mt-3 divide-y divide-edge/40">
                {s.users.map((u, i) => (
                  <li key={u.email} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-40 flex-1">
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-mute">{u.email}</p>
                    </div>
                    <select aria-label={`Role for ${u.name}`} value={u.role} disabled={u.email === s.users[0].email}
                      onChange={(e) => set("users", s.users.map((x, j) => (j === i ? { ...x, role: e.target.value as User["role"] } : x)))} className="field w-36">
                      <option>Admin</option><option>Operator</option><option>Viewer</option>
                    </select>
                  </li>
                ))}
              </ul>
              <form onSubmit={(e) => { e.preventDefault(); addUser(); }} className="mt-4 flex flex-wrap items-end gap-3 border-t border-edge/50 pt-4">
                <label className="min-w-48 flex-1 text-sm">Invite by email
                  <input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} className="field mt-1.5" placeholder="name@company.com" />
                </label>
                <label className="text-sm">Role
                  <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as User["role"] })} className="field mt-1.5 w-36"><option>Admin</option><option>Operator</option><option>Viewer</option></select>
                </label>
                <button type="submit" className="btn-ghost"><UserPlus className="size-4" aria-hidden /> Invite</button>
                {inviteError && <p role="alert" className="w-full text-xs text-danger">{inviteError}</p>}
              </form>
            </section>
          )}

          <div className="space-y-3">
            <button type="button" className="btn-primary inline-flex w-full items-center justify-center gap-2" onClick={save}><Save className="size-4" aria-hidden /> Save Changes</button>
            <p role="status" className="min-h-5 text-center text-sm text-ok">{saved ? "Changes saved" : ""}</p>
          </div>

          <section className="glass flex items-center justify-between gap-4 p-5" aria-labelledby="s-acct">
            <div>
              <h2 id="s-acct" className="font-display text-base font-semibold">Account</h2>
              <p className="text-xs text-mute">Signed in as {currentUser.name}.</p>
            </div>
            <Link href="/" className="btn-ghost"><LogOut className="size-4" aria-hidden /> Logout</Link>
          </section>
        </div>
      </div>
    </div>
  );
}
