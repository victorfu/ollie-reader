import { CircleDollarSign, Volume2, WifiOff } from "lucide-react";
import {
  useId,
  useMemo,
  useRef,
  type KeyboardEvent,
} from "react";
import { COTTAGE_PRODUCTS, ownsProduct } from "../logic/purchases";
import type {
  CottageProduct,
  CottageProductId,
  PetSaveV1,
} from "../types";
import { FURNITURE_VISUALS, OUTFIT_VISUALS } from "./cottageAssets";
import { CottagePanel } from "./CottagePanel";

export type CottageShopCategory = CottageProduct["kind"];

type CottageShopPanelProps = {
  open: boolean;
  save: PetSaveV1;
  coins: number | null;
  online: boolean;
  busy: CottageProductId | null;
  category: CottageShopCategory;
  reducedMotion?: boolean;
  onCategoryChange: (category: CottageShopCategory) => void;
  onPurchase: (productId: CottageProductId) => void | Promise<void>;
  onSpeak: (english: string, chinese: string) => void;
  onClose: () => void;
  onOpenWardrobe: () => void;
  onOpenDecorate: () => void;
};

const CATEGORIES: readonly {
  id: CottageShopCategory;
  label: string;
  english: string;
  emoji: string;
}[] = [
  { id: "snack", label: "點心", english: "Snacks", emoji: "🍰" },
  { id: "toy", label: "玩具", english: "Toys", emoji: "🧸" },
  { id: "outfit", label: "服飾", english: "Outfits", emoji: "🎀" },
  { id: "furniture", label: "家具", english: "Furniture", emoji: "🛋️" },
  { id: "wallpaper", label: "壁紙", english: "Wallpaper", emoji: "🖼️" },
  { id: "floor", label: "地板", english: "Flooring", emoji: "🧶" },
];

const PRODUCT_EMOJI: Partial<Record<CottageProductId, string>> = {
  apple: "🍎",
  "banana-yogurt": "🍌",
  pudding: "🍮",
  "honey-toast": "🍯",
  "strawberry-pancake": "🥞",
  "cinnamon-roll": "🥐",
  "rainbow-donut": "🍩",
  "cloud-cake": "🍰",
  ball: "⚽",
  frisbee: "🥏",
  "bubble-machine": "🫧",
  "music-box": "🎵",
  "cloud-swing": "☁️",
  "strawberry-clip": "🍓",
  "sailor-hat": "⚓",
  "flower-crown": "🌼",
  "star-headband": "⭐",
  "red-ribbon": "🎀",
  "blue-scarf": "🧣",
  "bell-collar": "🔔",
  "rainbow-scarf": "🌈",
  lamp: "💡",
  plant: "🪴",
  picture: "🖼️",
  rug: "🧶",
  table: "🫖",
  curtain: "🪟",
  sofa: "🛋️",
  bookshelf: "📚",
  "starry-night": "🌙",
  "candy-stripes": "🍬",
  forest: "🌲",
  "cloud-carpet": "☁️",
  "frosting-check": "🧁",
};

function categoryAccent(category: CottageShopCategory): string {
  switch (category) {
    case "snack":
      return "text-pink-700";
    case "toy":
      return "text-violet-700";
    case "outfit":
      return "text-fuchsia-700";
    case "furniture":
      return "text-amber-700";
    case "wallpaper":
      return "text-indigo-700";
    case "floor":
      return "text-emerald-700";
  }
}

export function CottageShopPanel({
  open,
  save,
  coins,
  online,
  busy,
  category,
  reducedMotion = false,
  onCategoryChange,
  onPurchase,
  onSpeak,
  onClose,
  onOpenWardrobe,
  onOpenDecorate,
}: CottageShopPanelProps) {
  const tablistId = useId();
  const tabRefs = useRef<Partial<Record<CottageShopCategory, HTMLButtonElement | null>>>({});

  const products = useMemo(
    () => COTTAGE_PRODUCTS.filter((product) => product.kind === category),
    [category],
  );

  const selectCategory = (nextCategory: CottageShopCategory) => {
    onCategoryChange(nextCategory);
    tabRefs.current[nextCategory]?.focus();
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentCategory: CottageShopCategory,
  ) => {
    const currentIndex = CATEGORIES.findIndex(({ id }) => id === currentCategory);
    let nextIndex: number | undefined;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % CATEGORIES.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (currentIndex - 1 + CATEGORIES.length) % CATEGORIES.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = CATEGORIES.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    selectCategory(CATEGORIES[nextIndex].id);
  };

  const categoryAction = category === "outfit"
    ? { label: "打開衣櫥", onClick: onOpenWardrobe }
    : category === "furniture" || category === "wallpaper" || category === "floor"
      ? { label: "佈置房間", onClick: onOpenDecorate }
      : null;

  return (
    <CottagePanel
      open={open}
      title="雲朵商店"
      eyebrow="Cloud shop"
      onClose={onClose}
      reducedMotion={reducedMotion}
      wide
    >
      <div className="mb-4 flex items-center justify-between gap-3 rounded-[12px] border border-sky-100 bg-sky-50/80 px-3 py-2">
        <p className="text-xs font-semibold text-slate-600">挑一件喜歡的東西帶回小窩吧！</p>
        <p className="inline-flex shrink-0 items-center gap-1 text-sm font-black text-amber-700" aria-live="polite">
          <CircleDollarSign className="size-4" aria-hidden="true" />
          {coins === null ? "確認中" : coins.toLocaleString()}
        </p>
      </div>

      <div
        id={tablistId}
        role="tablist"
        aria-label="商店分類"
        className="mb-4 flex snap-x snap-mandatory gap-1 overflow-x-auto rounded-[12px] bg-slate-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-6 sm:overflow-visible"
      >
        {CATEGORIES.map((item) => {
          const selected = item.id === category;
          return (
            <button
              key={item.id}
              ref={(element) => {
                tabRefs.current[item.id] = element;
              }}
              id={`${tablistId}-${item.id}-tab`}
              type="button"
              role="tab"
              data-shop-category={item.id}
              aria-selected={selected}
              aria-controls={`${tablistId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onCategoryChange(item.id)}
              onKeyDown={(event) => handleTabKeyDown(event, item.id)}
              className={`inline-flex min-h-11 min-w-[88px] snap-start items-center justify-center gap-1.5 rounded-[9px] px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:min-w-0 ${
                selected
                  ? `bg-white shadow-sm ${categoryAccent(item.id)}`
                  : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
              }`}
              aria-label={`${item.label} ${item.english}`}
            >
              <span aria-hidden="true">{item.emoji}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {!online ? (
        <div className="mb-4 flex items-start gap-2 rounded-[12px] border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          連上雲端並確認代幣後就能購物；已經擁有的物品仍可查看。
        </div>
      ) : null}

      <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
        <div>
          <h3 className={`text-sm font-black ${categoryAccent(category)}`}>
            {CATEGORIES.find((item) => item.id === category)?.label}
          </h3>
          <p className="text-[11px] text-slate-500">
            {category === "snack" ? "點心可以重複購買，其餘商品會永久收藏。" : "買一次就會永久收藏。"}
          </p>
        </div>
        {categoryAction ? (
          <button
            type="button"
            onClick={categoryAction.onClick}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] border border-sky-200 bg-white px-3 text-xs font-black text-sky-700 shadow-sm transition-colors hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {categoryAction.label}
          </button>
        ) : null}
      </div>

      <div
        id={`${tablistId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tablistId}-${category}-tab`}
        tabIndex={0}
        className="grid grid-cols-2 gap-3 outline-none sm:grid-cols-3 lg:grid-cols-4"
      >
        {products.map((product) => {
          const owned = product.kind !== "snack" && ownsProduct(save, product);
          const count = product.kind === "snack"
            ? save.inventory.snacks[product.id] ?? 0
            : undefined;
          const isBusy = busy === product.id;
          const disabled = !online || busy !== null || owned;
          const rasterPreview = product.kind === "outfit"
            ? OUTFIT_VISUALS[product.id].src
            : product.kind === "furniture"
              ? FURNITURE_VISUALS[product.id].src
              : null;

          return (
            <article
              key={product.id}
              className="flex min-h-52 flex-col rounded-[16px] border border-slate-200/80 bg-white/85 p-3 shadow-sm"
            >
              <div className="flex min-h-16 items-center justify-center text-4xl" aria-hidden="true">
                {rasterPreview ? (
                  <img
                    src={rasterPreview}
                    alt=""
                    className="h-16 w-20 select-none object-contain drop-shadow-sm"
                    draggable={false}
                  />
                ) : (
                  PRODUCT_EMOJI[product.id] ?? "🎁"
                )}
              </div>
              <h4 className="mt-1 text-center text-sm font-black text-slate-800">{product.nameZh}</h4>
              <div className="mt-0.5 flex min-h-8 items-start justify-center gap-1">
                <p className="pt-1 text-center text-[11px] leading-4 text-slate-500">{product.nameEn}</p>
                <button
                  type="button"
                  onClick={() => onSpeak(product.nameEn, product.nameZh)}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-sky-700 transition-colors hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  aria-label={`唸出 ${product.nameEn}`}
                >
                  <Volume2 className="size-4" aria-hidden="true" />
                </button>
              </div>
              {count !== undefined ? (
                <p className="mb-1 text-center text-[11px] font-semibold text-pink-600">目前有 {count}</p>
              ) : (
                <p className="mb-1 text-center text-[11px] font-semibold text-slate-500">
                  {owned
                    ? "已加入收藏"
                    : product.kind === "outfit"
                      ? product.slot === "head" ? "頭飾 · 永久收藏" : "頸飾 · 永久收藏"
                      : product.kind === "furniture"
                        ? product.zone === "wall" ? "牆面 · 永久收藏" : "地板 · 永久收藏"
                        : "永久收藏"}
                </p>
              )}
              <button
                type="button"
                data-product-id={product.id}
                disabled={disabled}
                onClick={() => void onPurchase(product.id)}
                className="mt-auto inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-sky-500 to-blue-500 px-3 text-xs font-black text-white shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500"
                aria-label={owned ? `${product.nameZh} 已擁有` : `購買 ${product.nameZh}，${product.price} 枚代幣`}
              >
                {isBusy ? (
                  "購買中…"
                ) : owned ? (
                  "已擁有"
                ) : (
                  <>
                    <CircleDollarSign className="size-4" aria-hidden="true" />
                    {product.price}
                  </>
                )}
              </button>
            </article>
          );
        })}
      </div>
    </CottagePanel>
  );
}
