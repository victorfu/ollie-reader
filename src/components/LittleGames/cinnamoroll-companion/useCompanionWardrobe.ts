import { useCallback, useEffect, useRef, useState } from "react";
import type { CompanionAccessory, CompanionOutfit, CompanionWardrobe } from "../../../types/companion";
import { useAuth } from "../../../hooks/useAuth";
import { subscribeTokenBalance } from "../../../services/gameProgressService";
import { logger } from "../../../utils/logger";
import {
  EMPTY_WARDROBE,
  createPurchaseId,
  isCompanionAlreadyOwnedError,
  isCompanionInsufficientCoinsError,
  purchaseCompanionAccessory,
  saveCompanionEquipment,
  subscribeCompanionWardrobe,
} from "./companionWardrobeStorage";

export type WardrobeStatus = "guest" | "loading" | "ready" | "error";
/** "busy": another purchase was still in flight, so this one was ignored. */
export type PurchaseOutcome = "bought" | "insufficient" | "owned" | "offline" | "failed" | "busy";

export interface CompanionWardrobeState {
  status: WardrobeStatus;
  wardrobe: CompanionWardrobe;
  /** null until the balance has loaded; always null for guests. */
  balance: number | null;
  online: boolean;
  /** The accessory whose purchase is in flight. */
  buying: CompanionAccessory | null;
  purchase: (item: CompanionAccessory) => Promise<PurchaseOutcome>;
  equip: (outfit: CompanionOutfit) => void;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * The signed-in player's companion wardrobe and token balance, with the shop
 * purchase. Guests get an empty wardrobe and cannot buy.
 */
export function useCompanionWardrobe(): CompanionWardrobeState {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const online = useOnline();
  // Keyed by account so one account's wardrobe never shows under another.
  const [loaded, setLoaded] = useState<{ uid: string; wardrobe: CompanionWardrobe | null; failed: boolean } | null>(null);
  const [balance, setBalance] = useState<{ uid: string; value: number } | null>(null);
  const [buying, setBuying] = useState<{ uid: string; item: CompanionAccessory } | null>(null);
  const inFlight = useRef(false);
  // A purchase whose outcome is unknown (e.g. the reply was lost) keeps its
  // id, so retrying it cannot charge twice.
  const pendingIds = useRef(new Map<string, string>());

  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    subscribeCompanionWardrobe(
      uid,
      (wardrobe) => { if (!cancelled) setLoaded({ uid, wardrobe, failed: false }); },
      (error) => {
        logger.error("Could not load the companion wardrobe:", error);
        if (!cancelled) setLoaded({ uid, wardrobe: null, failed: true });
      },
    ).then((stop) => {
      if (cancelled) stop();
      else unsubscribe = stop;
    }, (error: unknown) => {
      logger.error("Could not watch the companion wardrobe:", error);
      if (!cancelled) setLoaded({ uid, wardrobe: null, failed: true });
    });
    const stopBalance = subscribeTokenBalance(
      uid,
      (value) => { if (!cancelled) setBalance({ uid, value }); },
      (error) => logger.error("Could not watch the token balance:", error),
    );
    return () => {
      cancelled = true;
      unsubscribe?.();
      stopBalance();
    };
  }, [uid]);

  const current = uid && loaded?.uid === uid ? loaded : null;
  const status: WardrobeStatus = !uid ? "guest" : !current ? "loading" : current.failed ? "error" : "ready";
  const wardrobe = current?.wardrobe ?? EMPTY_WARDROBE;

  const purchase = useCallback(async (item: CompanionAccessory): Promise<PurchaseOutcome> => {
    if (!uid || status !== "ready") return "failed";
    if (!navigator.onLine) return "offline";
    // Double taps and a second buy button wait for the first purchase.
    if (inFlight.current) return "busy";
    inFlight.current = true;
    setBuying({ uid, item });
    const key = `${uid}:${item}`;
    const purchaseId = pendingIds.current.get(key) ?? createPurchaseId();
    pendingIds.current.set(key, purchaseId);
    try {
      await purchaseCompanionAccessory(uid, item, purchaseId);
      pendingIds.current.delete(key);
      return "bought";
    } catch (error) {
      if (isCompanionInsufficientCoinsError(error)) {
        pendingIds.current.delete(key);
        return "insufficient";
      }
      if (isCompanionAlreadyOwnedError(error)) {
        pendingIds.current.delete(key);
        return "owned";
      }
      logger.error("Companion purchase failed:", error);
      return "failed";
    } finally {
      inFlight.current = false;
      setBuying(null);
    }
  }, [status, uid]);

  const equip = useCallback((outfit: CompanionOutfit) => {
    if (!uid || status !== "ready" || wardrobe.owned.size === 0) return;
    // Offline the write is queued and the snapshot already shows it.
    saveCompanionEquipment(uid, outfit, wardrobe.owned).catch((error: unknown) => {
      logger.error("Could not save the companion outfit:", error);
    });
  }, [status, uid, wardrobe.owned]);

  return {
    status,
    wardrobe,
    balance: uid && balance?.uid === uid ? balance.value : null,
    online,
    buying: uid && buying?.uid === uid ? buying.item : null,
    purchase,
    equip,
  };
}
