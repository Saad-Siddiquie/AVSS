"use client";
import { useEffect, useState } from "react";
import { Camera, Check } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";

interface Cam { id: number; name: string; camera_type: string; url: string; location: string|null; status: string; description: string|null }

const TYPE_COLOR: Record<string,string> = { rtsp:"text-accent", webcam:"text-ok", file:"text-violet" };
const EMPTY: Partial<Cam> = { camera_type:"rtsp", status:"active", name:"", url:"", location:"", description:"" };

export default function AdminCamerasPage() {
  const { authFetch } = useAuth();
  const [cameras,  setCameras]  = useState<Cam[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState<Partial<Cam>|null>(null);
  const [deleting, setDeleting] = useState<Cam|null>(null);
  const [formErr,  setFormErr]  = useState("");
  const [busy,     setBusy]     = useState(false);
  const [toast,    setToast]    = useState("");

  const showToast = (m:string)=>{ setToast(m); setTimeout(()=>setToast(""),3000); };

  const load = async () => {
    const r = await authFetch(`${API}/cameras`);
    if(r.ok){ const d=await r.json(); setCameras(d?.cameras??(Array.isArray(d)?d:[])); }
    setLoading(false);
  };
  useEffect(()=>{ load(); },[]);

  const save = async (form: Partial<Cam>) => {
    setFormErr("");
    if(!form.name?.trim()||!form.url?.trim()){ setFormErr("Name and URL are required."); return; }
    setBusy(true);
    try {
      const isEdit = !!form.id;
      const r = await authFetch(isEdit?`${API}/cameras/${form.id}`:`${API}/cameras`,{
        method:isEdit?"PUT":"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ name:form.name, camera_type:form.camera_type??"rtsp", url:form.url, location:form.location??"", description:form.description??"", status:form.status??"active" }),
      });
      if(!r.ok){const d=await r.json();throw new Error(d?.detail||"Save failed.");}
      showToast("Camera saved."); setEditing(null); load();
    } catch(e:any){ setFormErr(e.message); }
    finally { setBusy(false); }
  };

  const del = async (id:number) => {
    const r = await authFetch(`${API}/cameras/${id}`,{method:"DELETE"});
    if(!r.ok){const d=await r.json();showToast(d?.detail||"Delete failed.");}
    else showToast("Camera deleted.");
    setDeleting(null); load();
  };

  const statusDot = (s:string) => s==="active"?"bg-ok":s==="error"?"bg-danger":"bg-mute";

  return (
    <AppShell adminOnly>
      {toast&&(
        <div className="fixed bottom-4 right-4 z-50 glass px-4 py-2 text-sm flex items-center gap-2 text-ok">
          <Check className="size-4"/> {toast}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">Cameras</h1>
            <p className="text-sm text-mute">{cameras.filter(c=>c.status==="active").length} online · {cameras.length} total</p>
          </div>
          <button onClick={()=>{setEditing({...EMPTY});setFormErr("");}} className="btn-primary">
            <Camera className="size-4"/> Add Camera
          </button>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
            {[1,2,3].map(i=><div key={i} className="h-40 glass rounded-xl"/>)}
          </div>
        ) : cameras.length===0 ? (
          <div className="glass p-12 text-center">
            <Camera className="size-12 text-mute mx-auto mb-4" aria-hidden/>
            <p className="font-semibold text-lg">No cameras registered yet</p>
            <p className="text-sm text-mute mt-1 mb-5">Add your first RTSP stream, webcam, or video file.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={()=>{setEditing({...EMPTY,camera_type:"rtsp"});setFormErr("");}} className="btn-primary">Add RTSP Camera</button>
              <button onClick={()=>{setEditing({...EMPTY,camera_type:"file"});setFormErr("");}} className="btn-ghost">Use video file as virtual camera</button>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cameras.map(c=>(
              <div key={c.id} className="glass p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(c.status)}`} title={c.status}/>
                    <span className="font-semibold truncate">{c.name}</span>
                  </div>
                  <span className={`text-xs font-semibold uppercase flex-shrink-0 ${TYPE_COLOR[c.camera_type]??"text-mute"}`}>
                    {c.camera_type}
                  </span>
                </div>
                <div className="text-sm text-mute">📍 {c.location||"No location"}</div>
                <div className="text-xs text-mute font-mono break-all rounded-lg bg-panel-2/60 px-2 py-1">{c.url}</div>
                {c.description&&<p className="text-sm text-mute line-clamp-2">{c.description}</p>}
                <div className="flex gap-2 mt-auto pt-1">
                  <button onClick={()=>{setEditing({...c});setFormErr("");}}
                    className="btn-ghost text-xs py-1 flex-1 justify-center">Edit</button>
                  <button onClick={()=>setDeleting(c)}
                    className="text-xs border border-danger/50 text-danger hover:bg-danger/10 rounded-lg px-3 py-1 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {editing!==null&&(
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={e=>e.target===e.currentTarget&&setEditing(null)}>
          <div className="glass w-full max-w-md p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-lg font-semibold mb-1">{editing.id?"Edit Camera":"Add Camera"}</h2>
            <p className="text-xs text-mute mb-4">Supports RTSP, IP Webcam (Android app), HTTP MJPEG, webcams and video files.</p>

            {formErr&&<div className="rounded-lg bg-danger/10 border border-danger/30 text-danger px-3 py-2 text-sm mb-3">{formErr}</div>}

            {/* Quick-fill for IP Webcam */}
            {!editing.id && (
              <div className="rounded-xl bg-accent/10 border border-accent/30 px-4 py-3 mb-4 text-xs">
                <p className="font-semibold text-accent mb-2">📱 IP Webcam Android App</p>
                <p className="text-mute mb-2">Open IP Webcam app on your phone → Start server → paste the URL shown:</p>
                <div className="flex gap-2">
                  <input
                    className="field flex-1 text-xs"
                    placeholder="http://192.168.x.x:8080"
                    onBlur={e => {
                      const v = e.target.value.trim();
                      if (v) setEditing(prev => ({ ...prev!, url: v, camera_type: "ip_webcam" }));
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const v = (e.target as HTMLInputElement).value.trim();
                        if (v) { setEditing(prev => ({ ...prev!, url: v, camera_type: "ip_webcam" })); (e.target as HTMLInputElement).value = ""; }
                      }
                    }}
                  />
                  <span className="text-mute self-center">← paste here</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-sm text-mute">
                Name *
                <input value={editing.name??""} onChange={e=>setEditing(v=>({...v!,name:e.target.value}))} placeholder="e.g. My Phone Camera" className="field mt-1" autoFocus={!editing.id}/>
              </label>

              <label className="block text-sm text-mute">
                Stream Type
                <select value={editing.camera_type??"rtsp"} onChange={e=>setEditing(v=>({...v!,camera_type:e.target.value}))} className="field mt-1">
                  <option value="rtsp">RTSP Stream (IP Camera / CCTV)</option>
                  <option value="ip_webcam">📱 IP Webcam Android App</option>
                  <option value="webcam">Webcam / USB Camera</option>
                  <option value="file">Video File (MP4, AVI, MKV)</option>
                  <option value="http">HTTP MJPEG Stream</option>
                </select>
              </label>

              <div>
                <label className="block text-sm text-mute">
                  URL / Path *
                  <input
                    value={editing.url??""}
                    onChange={e => {
                      const url = e.target.value;
                      // Auto-detect type from URL
                      let type = editing.camera_type ?? "rtsp";
                      if (url.startsWith("rtsp://"))       type = "rtsp";
                      else if (url.match(/^https?:\/\/.*:\d+/) || url.includes("/video") || url.includes("shot.jpg")) type = "ip_webcam";
                      else if (url.startsWith("http://") || url.startsWith("https://")) type = "ip_webcam";
                      else if (url === "0" || url.startsWith("/dev/") || /^\d+$/.test(url)) type = "webcam";
                      else if (/\.(mp4|avi|mkv|mov)$/i.test(url)) type = "file";
                      setEditing(v => ({ ...v!, url, camera_type: type }));
                    }}
                    placeholder={
                      editing.camera_type === "ip_webcam" ? "http://192.168.x.x:8080" :
                      editing.camera_type === "webcam"    ? "0  or  /dev/video0" :
                      editing.camera_type === "file"      ? "/path/to/recording.mp4" :
                      "rtsp://user:pass@192.168.x.x:554/stream1"
                    }
                    className="field mt-1"
                  />
                </label>
                <p className="text-[10px] text-mute mt-1">
                  {editing.camera_type === "ip_webcam"
                    ? "IP Webcam app: copy the URL shown on your phone screen (e.g. http://192.168.100.37:8080)"
                    : editing.camera_type === "rtsp"
                    ? "Include credentials if required. For IP Webcam RTSP: rtsp://ip:8080/h264_ulaw.sdp"
                    : ""}
                </p>
              </div>

              <label className="block text-sm text-mute">
                Location / Zone
                <input value={editing.location??""} onChange={e=>setEditing(v=>({...v!,location:e.target.value}))} placeholder="e.g. Gate A, Lobby, Room 3" className="field mt-1"/>
              </label>
              <label className="block text-sm text-mute">
                Description
                <input value={editing.description??""} onChange={e=>setEditing(v=>({...v!,description:e.target.value}))} placeholder="Optional notes" className="field mt-1"/>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={()=>setEditing(null)} className="btn-ghost">Cancel</button>
              <button onClick={()=>save(editing)} disabled={busy} className="btn-primary">
                {busy?"Saving…":"Save Camera"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleting&&(
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="glass w-full max-w-sm p-5 shadow-2xl">
            <h2 className="font-display text-lg font-semibold mb-3">Delete Camera</h2>
            <p className="text-sm text-mute mb-5">Delete <strong className="text-white">{deleting.name}</strong>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setDeleting(null)} className="btn-ghost">Cancel</button>
              <button onClick={()=>del(deleting.id)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
