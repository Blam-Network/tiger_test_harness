import type { CharacterStore } from "../character-store";

// What the character store needs of a build: its database mapping.
export interface InvestmentBuild {
  // The SQLite-backed store over the build's schema, on its database file.
  connectCharacterStore(url: string): CharacterStore;
}
