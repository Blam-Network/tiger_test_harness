import { BitReader, BitWriter } from "@blamnetwork/rsat";

// AH ScriptState (38) / ScriptEvent (39) / RequestScriptUpdates (40).
//
// The guest sends RequestScriptUpdates as a single bool (`toggle`) through
// the type-40 RSAT schema. The Tower capture (2.3.1) never shows Script*
// traffic during spawn: combatant scripts start from the ActorAuth cookie/PC.
// These builders keep the AH path quiet-but-aware until atom payloads exist.

export function parseRequestScriptUpdates(payload: Buffer): {
  toggle: boolean;
} | null {
  if (payload.length === 0) {
    return null;
  }
  try {
    const br = new BitReader(payload);
    return { toggle: br.readBit() === 1 };
  } catch {
    return null;
  }
}

export function buildRequestScriptUpdatesRsat(toggle: boolean): Buffer {
  const bw = new BitWriter(8);
  bw.writeBit(toggle ? 1 : 0);
  return bw.finish();
}
