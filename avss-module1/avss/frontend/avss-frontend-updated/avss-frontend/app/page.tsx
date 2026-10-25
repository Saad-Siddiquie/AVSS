import AuthCard from "@/components/AuthCard";
import KeyFeatures from "@/components/KeyFeatures";

export default function WelcomePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-12 p-6">
      <AuthCard mode="login" />
      <KeyFeatures />
      <p className="pb-4 text-right font-display text-sm italic text-mute">AI Today <span className="mx-2 text-edge">|</span> Safer Tomorrow</p>
    </div>
  );
}
