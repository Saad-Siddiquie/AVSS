// Mock data used by every page. Replace each export with a fetch to your FastAPI backend, e.g.
//   cameras  -> GET /api/cameras      persons -> GET /api/persons
//   sightings -> GET /api/sightings   alerts  -> GET /api/alerts

export type Camera = { id: string; name: string; zone: string; status: "online" | "offline" };

const zones = [
  "Main Entrance", "Atrium", "Food Court", "East Escalators", "Parking Level 1", "Electronics Wing",
  "Fashion Wing", "Kids Zone", "Cinema Lobby", "Service Corridor", "North Exit", "Elevators",
];

export const cameras: Camera[] = zones.map((zone, i): Camera => {
  const n = String(i + 1).padStart(2, "0");
  return { id: `c${n}`, name: `Camera ${n}`, zone, status: "online" };
});

export const cameraName = (id: string) => cameras.find((c) => c.id === id)?.name ?? id;
export const cameraZone = (id: string) => cameras.find((c) => c.id === id)?.zone ?? "";
export const cameraNumber = (id: string) => Number(id.slice(1));

export type PersonStatus = "identified" | "unknown" | "target";

export type Person = {
  id: string;
  /** Short tracker number shown as "ID 12" across the UI. */
  trackId: number;
  name: string;
  status: PersonStatus;
  firstSeen: string;
  detections: number;
  /** 0 = today. Used by the Gallery date-range filter. */
  daysAgo: number;
  note?: string;
};

export const statusLabel: Record<PersonStatus, string> = {
  identified: "Identified",
  unknown: "Unknown",
  target: "Search target",
};

export const persons: Person[] = [
  { id: "p-101", trackId: 12, name: "Ayesha Khan", status: "identified", firstSeen: "09:12", detections: 18, daysAgo: 0 },
  { id: "p-102", trackId: 7, name: "Bilal Ahmed", status: "identified", firstSeen: "09:40", detections: 11, daysAgo: 0 },
  { id: "p-103", trackId: 3, name: "Sana Malik", status: "target", firstSeen: "10:05", detections: 7, daysAgo: 0, note: "Reference image on file. Reported missing at 09:50." },
  { id: "p-104", trackId: 18, name: "Unknown #31", status: "unknown", firstSeen: "10:21", detections: 5, daysAgo: 0, note: "No face match. Tracked by clothing only." },
  { id: "p-105", trackId: 21, name: "Hamza Raza", status: "identified", firstSeen: "10:33", detections: 14, daysAgo: 0 },
  { id: "p-106", trackId: 25, name: "Unknown #32", status: "unknown", firstSeen: "10:48", detections: 4, daysAgo: 0, note: "Entered through the service corridor." },
  { id: "p-107", trackId: 14, name: "Zainab Iqbal", status: "identified", firstSeen: "11:02", detections: 9, daysAgo: 0 },
  { id: "p-108", trackId: 9, name: "Unknown #33", status: "unknown", firstSeen: "11:15", detections: 3, daysAgo: 0 },
  { id: "p-109", trackId: 6, name: "Usman Tariq", status: "identified", firstSeen: "16:20", detections: 8, daysAgo: 1 },
  { id: "p-110", trackId: 11, name: "Unknown #27", status: "unknown", firstSeen: "11:10", detections: 4, daysAgo: 2 },
  { id: "p-111", trackId: 16, name: "Hira Fatima", status: "identified", firstSeen: "14:15", detections: 10, daysAgo: 3 },
  { id: "p-112", trackId: 27, name: "Unknown #24", status: "unknown", firstSeen: "09:05", detections: 3, daysAgo: 5 },
];

export const getPerson = (id: string) => persons.find((p) => p.id === id);

// Face score is null when no face was visible; the match then relies on clothing (OSNet) alone.
export type Sighting = { personId: string; cameraId: string; time: string; face: number | null; body: number };

export const sightings: Sighting[] = [
  { personId: "p-101", cameraId: "c01", time: "09:12:08", face: 96.2, body: 88.4 },
  { personId: "p-101", cameraId: "c02", time: "09:16:41", face: 94.1, body: 90.3 },
  { personId: "p-101", cameraId: "c03", time: "09:31:27", face: 91.5, body: 87.2 },
  { personId: "p-101", cameraId: "c07", time: "10:02:55", face: 89.3, body: 85.6 },
  { personId: "p-102", cameraId: "c01", time: "09:40:19", face: 92.4, body: 84.1 },
  { personId: "p-102", cameraId: "c06", time: "09:58:02", face: 88.7, body: 82.6 },
  { personId: "p-102", cameraId: "c09", time: "10:41:36", face: 90.1, body: 86.0 },
  { personId: "p-103", cameraId: "c01", time: "10:05:44", face: 87.3, body: 91.2 },
  { personId: "p-103", cameraId: "c04", time: "10:14:09", face: 79.5, body: 89.4 },
  { personId: "p-103", cameraId: "c08", time: "10:26:31", face: null, body: 86.8 },
  { personId: "p-103", cameraId: "c03", time: "10:38:50", face: 83.9, body: 90.6 },
  { personId: "p-104", cameraId: "c05", time: "10:21:12", face: null, body: 74.3 },
  { personId: "p-104", cameraId: "c12", time: "10:29:47", face: null, body: 71.1 },
  { personId: "p-104", cameraId: "c05", time: "10:36:20", face: null, body: 69.5 },
  { personId: "p-105", cameraId: "c02", time: "10:33:15", face: 93.0, body: 90.2 },
  { personId: "p-105", cameraId: "c06", time: "10:44:58", face: 90.4, body: 88.1 },
  { personId: "p-106", cameraId: "c10", time: "10:48:23", face: null, body: 66.4 },
  { personId: "p-106", cameraId: "c11", time: "10:55:07", face: null, body: 63.2 },
  { personId: "p-107", cameraId: "c01", time: "11:02:36", face: 95.4, body: 92.1 },
  { personId: "p-107", cameraId: "c03", time: "11:09:18", face: 92.6, body: 89.5 },
  { personId: "p-108", cameraId: "c07", time: "11:15:40", face: null, body: 61.3 },
  { personId: "p-108", cameraId: "c05", time: "11:22:29", face: null, body: 58.7 },
  { personId: "p-109", cameraId: "c02", time: "16:20:33", face: 91.4, body: 87.2 },
  { personId: "p-109", cameraId: "c06", time: "16:35:12", face: 88.9, body: 85.5 },
  { personId: "p-110", cameraId: "c05", time: "11:10:48", face: null, body: 70.3 },
  { personId: "p-110", cameraId: "c10", time: "11:25:05", face: null, body: 66.8 },
  { personId: "p-111", cameraId: "c03", time: "14:15:21", face: 93.7, body: 90.1 },
  { personId: "p-111", cameraId: "c09", time: "14:40:56", face: 90.2, body: 88.4 },
  { personId: "p-112", cameraId: "c12", time: "09:05:14", face: null, body: 62.4 },
  { personId: "p-112", cameraId: "c11", time: "09:20:39", face: null, body: 60.9 },
];

export const FACE_WEIGHT = 0.6; // default face/clothing fusion weight, adjustable in Settings > Model
const round1 = (n: number) => Math.round(n * 10) / 10;
export const fused = (s: Sighting, faceWeight = FACE_WEIGHT) =>
  s.face === null ? s.body : round1(s.face * faceWeight + s.body * (1 - faceWeight));

export const sightingsFor = (personId: string) => sightings.filter((s) => s.personId === personId);
export const lastSighting = (personId: string) => sightingsFor(personId).at(-1);
export const bestScore = (personId: string) => Math.max(0, ...sightingsFor(personId).map((s) => fused(s)));

const hash = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7);

// ---- Live monitoring: people currently shown in a camera's "Detected persons" list ----------------------------
export type Detection = { person: Person; score: number };

export function detectionsFor(cameraId: string, limit = 6): Detection[] {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const here = sightings
    .filter((s) => s.cameraId === cameraId)
    .map((s) => ({ person: getPerson(s.personId)!, score: r2(fused(s) / 100) }));
  const seen = new Set(here.map((d) => d.person.id));
  // Pad the list so a quiet camera still shows people near it. Replace with: GET /api/cameras/{id}/detections
  const filler = persons
    .filter((p) => !seen.has(p.id) && p.daysAgo === 0)
    .map((person) => ({ person, score: r2(0.6 + (hash(person.id + cameraId) % 30) / 100) }));
  return [...here, ...filler].sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---- Search: ranks every sighting against a reference person -------------------------------------------------
export type Hit = { sighting: Sighting; person: Person; score: number };

export const defaultTarget = persons.find((p) => p.status === "target")!;

/**
 * Demo scoring. A real backend compares the reference image with each sighting; here the reference person's own
 * sightings keep their fused score and everyone else is scaled down, so the threshold slider stays meaningful.
 * Replace with: POST /api/search (multipart: image or personId, cameraId)
 */
export function hitsFor(referenceId: string | null, cameraId: string): Hit[] {
  const ref = referenceId ?? defaultTarget.id;
  return sightings
    .filter((s) => cameraId === "all" || s.cameraId === cameraId)
    .map((sighting) => {
      const person = getPerson(sighting.personId)!;
      const base = fused(sighting);
      const score = sighting.personId === ref ? base : round1(base * (0.62 + (hash(sighting.personId) % 18) / 100));
      return { sighting, person, score };
    })
    .sort((a, b) => b.score - a.score);
}

// ---- Alerts --------------------------------------------------------------------------------------------------
export type Severity = "high" | "medium" | "low" | "info";
export type AlertKind = "unknown" | "match" | "lowconf" | "access" | "system";

export type Alert = {
  id: string;
  kind: AlertKind;
  severity: Severity;
  title: string;
  text: string;
  cameraId: string;
  personId?: string;
  time: string;
  read: boolean;
};

export const severityLabel: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low", info: "Info" };

export const alerts: Alert[] = [
  { id: "a1", kind: "unknown", severity: "high", title: "Unknown Person Detected", text: "Nobody on file matches this person. Tracked by clothing only.", cameraId: "c05", personId: "p-104", time: "14:12:33", read: false },
  { id: "a2", kind: "match", severity: "medium", title: "Possible Match Found", text: "Search target Sana Malik matched with the reference image.", cameraId: "c03", personId: "p-103", time: "13:45:12", read: false },
  { id: "a3", kind: "lowconf", severity: "low", title: "Low Confidence Match", text: "A match scored below the clothing threshold. Review before acting.", cameraId: "c07", personId: "p-108", time: "12:22:01", read: false },
  { id: "a4", kind: "access", severity: "high", title: "Unauthorized Access", text: "Movement detected in a restricted area after hours.", cameraId: "c01", time: "11:03:17", read: false },
  { id: "a5", kind: "system", severity: "info", title: "System Alert", text: "Camera 04 reconnected after a short outage.", cameraId: "c04", time: "09:15:46", read: true },
  { id: "a6", kind: "unknown", severity: "medium", title: "Unknown Person Detected", text: "Entered through the service corridor.", cameraId: "c10", personId: "p-106", time: "08:48:10", read: true },
];
