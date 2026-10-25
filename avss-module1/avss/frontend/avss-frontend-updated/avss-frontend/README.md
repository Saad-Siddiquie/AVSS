# AVSS frontend

Dashboard UI for the Autonomous Video Surveillance System, built to match the design board
(`AVSS_Futuristic_Surveillance_Dashboard_Showcase.png`): welcome/login, dashboard, search, results, live monitoring,
person details, alerts, settings, gallery and key features.

## Run
```bash
npm install
npm run dev
```
Open http://localhost:3000. Requires Node 18.18+. Tailwind CSS v4 is included. The Sora and Inter fonts load from Google Fonts,
so the first build needs internet access.

## Pages
| Route | What it does |
| --- | --- |
| `/` | Welcome, login (show/hide password, validation) and Key Features |
| `/signup` | Create-account form that reuses the login card |
| `/dashboard` | Stats, quick actions, recent activity, 7-day detections trend with axes |
| `/search` | Upload Image or Select from Gallery, camera filter, ranked results with similarity threshold and pagination |
| `/live` | Main camera view (LIVE badge, clock), overlay modes (Detection, Tracking, Face, Clothing (OSNet), All), Detected Persons list, strip of all 12 cameras. `?camera=c05` opens a camera |
| `/gallery` | Tabs All / Matches / Detections / Favorites, date range, star favorites. `?q=` filters by name, ID, camera or time |
| `/alerts` | High / Medium / Low / Info alerts, Mark All as Read, unread badge in the sidebar |
| `/settings` | General, Cameras (stream URL + on/off), Model (thresholds, fusion weight), Notifications, User Management |
| `/person/[id]` | Person ID, Matched badge, confidence, face / clothing / combined scores, details, View Full Image, View in Video, camera path |

The top bar search sends you to the Gallery with your query. The sidebar badge, dashboard Alerts card and Alerts page share one unread count.

## Connecting the backend (FastAPI)
All data is mock data in `lib/data.ts`. Each place to change is marked with a `Replace with:` comment:
`POST /api/auth/login`, `POST /api/search`, `POST /api/alerts/{id}/read`, `PUT /api/settings`, `GET /api/persons/{id}`,
`GET /api/cameras/{id}/detections`, `POST /api/users/invite`.

- **Images:** people are drawn as placeholder figures (`components/art/Figure.tsx`). Pass `src` to `PersonThumb` / `FaceThumb` to show the real face or body crop.
- **Live feeds:** `components/art/CctvScene.tsx` stands in for a stream. Replace it with a `<video>`, MJPEG `<img>` or WebRTC player and draw boxes from the detections endpoint.
- **Search scoring** in `hitsFor()` is demo logic. The real similarity comes from your YOLOv8 + ArcFace + OSNet pipeline.
- **Signed-in user** is the constant in `lib/user.ts`.

## Structure
- `app/` routes (`(app)` group shares the sidebar and top bar)
- `components/` shared UI, `components/views/` page bodies, `components/art/` placeholder imagery
- `lib/data.ts` mock data and types; `lib/nav.ts` navigation; `lib/user.ts` current user
