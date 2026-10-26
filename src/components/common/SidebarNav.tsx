import { Link } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  Ellipsis,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage";
import type { MessageKey } from "../../i18n/translate";
import { T } from "./T";

export interface SidebarNavItem {
  to: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  /** 其他也算在這個入口底下的路徑（子分頁） */
  matches?: string[];
}

interface SidebarNavProps {
  items: SidebarNavItem[];
  variant: "desktop" | "mobile";
  /** Desktop icon-rail mode: icons only, no move controls. */
  collapsed?: boolean;
  isActive: (item: SidebarNavItem) => boolean;
  isInMore: (to: string) => boolean;
  moreOpen: boolean;
  onToggleMore: () => void;
  onMoveToMore: (to: string) => void;
  onMoveOutOfMore: (to: string) => void;
  onNavigate?: () => void;
}

export function SidebarNav({
  items,
  variant,
  collapsed = false,
  isActive,
  isInMore,
  moreOpen,
  onToggleMore,
  onMoveToMore,
  onMoveOutOfMore,
  onNavigate,
}: SidebarNavProps) {
  const { t } = useLanguage();
  const isMobile = variant === "mobile";
  const mainItems = items.filter((item) => !isInMore(item.to));
  const moreItems = items.filter((item) => isInMore(item.to));

  const rowClass = (active: boolean) =>
    `flex items-center rounded-lg text-sm font-medium transition-colors duration-200 ${
      isMobile
        ? "gap-3 px-3 py-2.5 active:scale-[0.98]"
        : collapsed
          ? "justify-center px-2 py-2.5"
          : "gap-3 px-3 py-2"
    } ${
      active
        ? "bg-accent-tint text-accent"
        : `${isMobile ? "text-base-content" : "text-base-content/70"} hover:bg-accent-tint hover:text-accent`
    }`;

  const renderItem = (item: SidebarNavItem, inMore: boolean) => {
    const active = isActive(item);
    const Icon = item.icon;
    const MoveIcon = inMore ? ArrowUpToLine : ArrowDownToLine;
    const label = t(item.labelKey);
    const moveLabel = t(inMore ? "nav.moveOutOfMoreLabel" : "nav.moveToMoreLabel", { label });
    return (
      <div key={item.to} className="group relative">
        <Link
          to={item.to}
          title={label}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={`${rowClass(active)} ${collapsed ? "" : "pr-10"}`}
        >
          <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {!collapsed && <T k={item.labelKey} />}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={() => (inMore ? onMoveOutOfMore(item.to) : onMoveToMore(item.to))}
            aria-label={moveLabel}
            title={t(inMore ? "nav.moveOutOfMore" : "nav.moveToMore")}
            className={`absolute right-1.5 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-base-content/10 hover:text-base-content focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              isMobile ? "size-8" : "size-7 opacity-0 group-hover:opacity-100"
            }`}
          >
            <MoveIcon className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      {mainItems.map((item) => renderItem(item, false))}

      {moreItems.length > 0 && (
        <>
          <button
            type="button"
            onClick={onToggleMore}
            aria-expanded={moreOpen}
            title={t("nav.more")}
            className={`${rowClass(false)} w-full`}
          >
            <Ellipsis className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            {!collapsed && (
              <>
                <span className="flex min-w-0 flex-1 text-left">
                  <T k="nav.more" />
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 transition-transform duration-200 ${
                    moreOpen ? "rotate-180" : ""
                  }`}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </>
            )}
          </button>
          {moreOpen && moreItems.map((item) => renderItem(item, true))}
        </>
      )}
    </>
  );
}
