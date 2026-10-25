import { ScanEye, ScanFace, ImageUp, BellRing, SlidersHorizontal, Network } from "lucide-react";

const features = [
  { icon: ScanEye, title: "Real-time Detection", text: "Detects multiple persons in live CCTV feeds", tone: "text-accent" },
  { icon: ScanFace, title: "Face + Clothing Fusion", text: "Combines face recognition with OSNet for accuracy", tone: "text-cyan" },
  { icon: ImageUp, title: "Reference Search", text: "Finds the target person from a single image", tone: "text-violet" },
  { icon: BellRing, title: "Smart Alerts", text: "Get notified about unknown or suspicious persons", tone: "text-warn" },
  { icon: SlidersHorizontal, title: "Easy Management", text: "Simple and intuitive interface", tone: "text-accent" },
  { icon: Network, title: "Cross-Camera Tracking", text: "Track the person across multiple cameras", tone: "text-cyan" },
];

export default function KeyFeatures() {
  return (
    <section aria-labelledby="key-features">
      <h2 id="key-features" className="font-display text-xl font-semibold">Key Features</h2>
      <p className="mt-1 text-sm text-mute">Powerful features to make your surveillance smarter.</p>
      <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {features.map(({ icon: Icon, title, text, tone }) => (
          <li key={title} className="glass flex flex-col items-center p-4 text-center transition-colors hover:border-accent">
            <span className={`grid size-14 place-items-center rounded-xl bg-panel-2 ${tone}`}>
              <Icon className="size-7" aria-hidden />
            </span>
            <h3 className="mt-3 text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-mute">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
