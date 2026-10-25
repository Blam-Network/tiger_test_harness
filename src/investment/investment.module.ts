import { Module } from "@nestjs/common";
import { activeBuild } from "../builds";
import { type CharacterStore, CharacterStoreToken } from "./character-store";
import { prepareBuildDatabase } from "./database";
import { investmentBuild } from "./versions";

// Accounts / characters in the build's own SQLite file in the working directory,
// created and migrated on first use.
export function createCharacterStore(): CharacterStore {
  const url = prepareBuildDatabase(".", activeBuild());
  return investmentBuild().connectCharacterStore(url);
}

@Module({
  providers: [
    { provide: CharacterStoreToken, useFactory: createCharacterStore },
  ],
  exports: [CharacterStoreToken],
})
export class InvestmentModule {}
