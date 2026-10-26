import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Coins } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../hooks/useLanguage";
import { subscribeTokenBalance } from "../../services/gameProgressService";
import { logger } from "../../utils/logger";

/** The live gacha token balance for the toolbar; links to the gacha machine where it is spent. */
export function TokenBalance() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const uid = user?.uid;
  // Keyed by account so a balance never shows under another account while the new one loads.
  const [balance, setBalance] = useState<{ uid: string; value: number } | null>(null);

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeTokenBalance(
      uid,
      (value) => setBalance({ uid, value }),
      (err) => logger.error("Could not watch the token balance:", err),
    );
  }, [uid]);

  if (!uid || balance?.uid !== uid) return null;

  return (
    <Link
      to="/games/gacha"
      aria-label={t("tokens.balanceLabel", { n: balance.value })}
      title={t("tokens.title")}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold tabular-nums text-base-content/80 transition-colors duration-200 hover:bg-accent-tint hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
    >
      <Coins className="h-5 w-5 text-warning" strokeWidth={1.75} aria-hidden="true" />
      {balance.value.toLocaleString()}
    </Link>
  );
}
