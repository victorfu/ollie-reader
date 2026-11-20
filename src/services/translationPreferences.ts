import { auth } from "../utils/firebaseUtil";
import { getUserSettings } from "./settingsService";

export async function readTranslationModel(): Promise<string | null> {
  await auth.authStateReady();
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const settings = await getUserSettings(uid);
  if (auth.currentUser?.uid !== uid) throw new Error("Account changed while loading translation settings");
  return settings?.translationModel ?? null;
}
