/**
 * Adaptateurs serveur publics des objectifs d'écriture du module Notes.
 * Les signatures historiques restent disponibles depuis @/server/gaia.
 */
import {
  getTodayWordsQuery,
  getWritingSettingsQuery,
  updateWritingSettingsCommand,
  type GaiaTodayWords,
  type GaiaWritingSettings,
} from "@/modules/notes/services/writing";

export type { GaiaWritingSettings, GaiaTodayWords } from "@/modules/notes/services/writing";

export async function getWritingSettings(userId: string): Promise<GaiaWritingSettings> {
  return getWritingSettingsQuery(userId);
}

export async function updateWritingSettings(
  userId: string,
  input: unknown,
): Promise<GaiaWritingSettings> {
  return updateWritingSettingsCommand(userId, input);
}

export async function getTodayWords(userId: string): Promise<GaiaTodayWords> {
  return getTodayWordsQuery(userId);
}
