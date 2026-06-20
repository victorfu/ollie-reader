import {
  CircleHelp,
  Hotel,
  Landmark,
  Plane,
  PlaneTakeoff,
  ShoppingBag,
  TrainFront,
  Trees,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { TravelTopic } from "../../types/travelEnglish";

const topicVisuals: Record<
  string,
  {
    Icon: LucideIcon;
    gradient: string;
    accent: string;
  }
> = {
  airport: {
    Icon: PlaneTakeoff,
    gradient: "from-sky-100 via-white to-emerald-100 dark:from-sky-950 dark:via-base-200 dark:to-emerald-950",
    accent: "bg-sky-500",
  },
  plane: {
    Icon: Plane,
    gradient: "from-blue-100 via-white to-cyan-100 dark:from-blue-950 dark:via-base-200 dark:to-cyan-950",
    accent: "bg-blue-500",
  },
  transport: {
    Icon: TrainFront,
    gradient: "from-green-100 via-white to-sky-100 dark:from-green-950 dark:via-base-200 dark:to-sky-950",
    accent: "bg-green-500",
  },
  hotel: {
    Icon: Hotel,
    gradient: "from-amber-100 via-white to-orange-100 dark:from-amber-950 dark:via-base-200 dark:to-orange-950",
    accent: "bg-amber-500",
  },
  food: {
    Icon: Utensils,
    gradient: "from-orange-100 via-white to-yellow-100 dark:from-orange-950 dark:via-base-200 dark:to-yellow-950",
    accent: "bg-orange-500",
  },
  attractions: {
    Icon: Landmark,
    gradient: "from-purple-100 via-white to-pink-100 dark:from-purple-950 dark:via-base-200 dark:to-pink-950",
    accent: "bg-purple-500",
  },
  shopping: {
    Icon: ShoppingBag,
    gradient: "from-pink-100 via-white to-rose-100 dark:from-pink-950 dark:via-base-200 dark:to-rose-950",
    accent: "bg-pink-500",
  },
  mandai: {
    Icon: Trees,
    gradient: "from-emerald-100 via-white to-lime-100 dark:from-emerald-950 dark:via-base-200 dark:to-lime-950",
    accent: "bg-emerald-500",
  },
  help: {
    Icon: CircleHelp,
    gradient: "from-red-100 via-white to-orange-100 dark:from-red-950 dark:via-base-200 dark:to-orange-950",
    accent: "bg-red-500",
  },
};

const fallbackVisual = topicVisuals.airport;

interface TopicSceneVisualProps {
  topic: TravelTopic;
  size?: "card" | "hero";
}

export function TopicSceneVisual({ topic, size = "card" }: TopicSceneVisualProps) {
  const visual = topicVisuals[topic.id] ?? fallbackVisual;
  const Icon = visual.Icon;
  const isHero = size === "hero";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${visual.gradient} ${
        isHero ? "min-h-[240px] sm:min-h-[300px]" : "min-h-[150px]"
      }`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(120deg,rgba(255,255,255,.7)_0,rgba(255,255,255,.15)_35%,transparent_65%)] dark:opacity-20" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/70 dark:bg-white/15" />
      <div className="absolute inset-y-6 left-8 w-px bg-white/45 dark:bg-white/10" />
      <div className="absolute inset-y-10 left-16 w-px bg-white/30 dark:bg-white/5" />
      <div
        className={`absolute ${isHero ? "bottom-8 right-8 size-28 sm:size-36" : "bottom-5 right-5 size-20"} rounded-[28px] bg-white/72 p-5 shadow-elevated ring-1 ring-black/5 backdrop-blur-md dark:bg-white/12 dark:ring-white/10`}
      >
        <Icon className="h-full w-full text-base-content/80 dark:text-white/80" strokeWidth={1.5} />
      </div>
      <div className={`absolute left-5 top-5 h-1.5 w-16 rounded-full ${visual.accent}`} />
      <div className="absolute bottom-5 left-5 flex gap-2">
        <span className={`size-2 rounded-full ${visual.accent}`} />
        <span className="size-2 rounded-full bg-base-content/20" />
        <span className="size-2 rounded-full bg-base-content/10" />
      </div>
    </div>
  );
}
