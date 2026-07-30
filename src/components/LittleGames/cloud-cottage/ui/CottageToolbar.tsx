import {
  Bath,
  Gamepad2,
  Moon,
  Paintbrush,
  Settings,
  Shirt,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export type CottageToolbarAction =
  | "food"
  | "bath"
  | "toys"
  | "shop"
  | "decorate"
  | "wardrobe"
  | "actions"
  | "sleep"
  | "settings";

type CottageToolbarProps = {
  active?: CottageToolbarAction | null;
  disabled?: boolean | Partial<Record<CottageToolbarAction, boolean>>;
  sleeping?: boolean;
  onFood: () => void;
  onBath: () => void;
  onToys: () => void;
  onShop: () => void;
  onDecorate: () => void;
  onWardrobe: () => void;
  onActions: () => void;
  onSleep: () => void;
  onSettings: () => void;
};

type ToolbarItem = {
  id: CottageToolbarAction;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
};

export function CottageToolbar({
  active = null,
  disabled = false,
  sleeping = false,
  onFood,
  onBath,
  onToys,
  onShop,
  onDecorate,
  onWardrobe,
  onActions,
  onSleep,
  onSettings,
}: CottageToolbarProps) {
  const items: ToolbarItem[] = [
    { id: "food", label: "點心櫃", icon: UtensilsCrossed, onClick: onFood },
    { id: "bath", label: "洗澡", icon: Bath, onClick: onBath },
    { id: "toys", label: "玩具箱", icon: Gamepad2, onClick: onToys },
    { id: "shop", label: "商店", icon: ShoppingBag, onClick: onShop },
    { id: "decorate", label: "佈置", icon: Paintbrush, onClick: onDecorate },
    { id: "wardrobe", label: "衣櫥", icon: Shirt, onClick: onWardrobe },
    { id: "actions", label: "動作", icon: Sparkles, onClick: onActions },
    { id: "sleep", label: sleeping ? "叫醒" : "哄睡", icon: Moon, onClick: onSleep },
    { id: "settings", label: "設定", icon: Settings, onClick: onSettings },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-t-[18px] border border-white/60 bg-white/92 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:static sm:rounded-[18px] sm:bg-white/76 sm:pb-2 lg:grid lg:grid-cols-9"
      aria-label="照顧與佈置工具列"
    >
      {items.map(({ id, label, icon: Icon, onClick }) => {
        const isActive = active === id;
        const isDisabled =
          typeof disabled === "boolean" ? disabled : Boolean(disabled[id]);

        return (
          <button
            key={id}
            type="button"
            data-toolbar={id}
            disabled={isDisabled}
            aria-pressed={isActive}
            onClick={onClick}
            className={`inline-flex min-h-14 min-w-[68px] snap-start flex-col items-center justify-center gap-1 rounded-[12px] px-2 text-[11px] font-bold transition-all hover:-translate-y-0.5 hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 sm:min-h-16 sm:text-xs lg:min-w-0 ${
              isActive
                ? "bg-sky-100 text-sky-800 shadow-sm ring-1 ring-sky-200"
                : "text-slate-600"
            }`}
          >
            <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
