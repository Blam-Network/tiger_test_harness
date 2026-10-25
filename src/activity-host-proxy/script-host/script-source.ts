// A destination's bundle scripts, from the compiled set (compiled-scripts.ts),
// as the script tags the host reads.
import {
  type CompiledBsFile,
  fnv1,
  formatScriptTag,
  type ScriptSource,
} from "@blamnetwork/bullshcript/destiny1/common";

import { compiledScripts } from "./compiled-scripts";

const WORD = 4;

interface Scripts {
  // A bundle tag's own script, under the bundle tag's id.
  scriptFor: (bundleTag: number) => number | undefined;
  scripts: ScriptSource;
}

interface ScriptEntry {
  file: CompiledBsFile;
  // Script tags the chunk references, which is how the runtime reaches an
  // activity root's missions and the archetypes its rows run (Link B).
  refs: readonly string[];
}

// Nothing links a bundle to a script tag, but a bundle's hash is the
// fnv1 of its script file's name (scriptByBundle, in the activity's
// destination folder), so each bundle with an authored file runs it, keyed
// by the bundle's tag id. A bundle loaded as
// several tags (venus_portal_1's strike bundle, one copy per strike bubble)
// runs its script once, under its first tag.
//
// Missions and archetypes have no bundle of their own. Each stands in under
// the fnv1 of its path, and the chunk of the bundle script that uses it is
// followed by those tags: an activity root's missions (missionScripts), then
// the archetypes its bundle's Encounter rows run (childScript). Each tag also answers its
// decl's compiled schema: the thread startup flags and member defaults the
// host builds the instance from.
export function scriptSource(
  bundles: readonly {
    bundle: number;
    rows?: readonly { childScript?: string }[];
    tag: number;
  }[],
  destination: string
): Scripts {
  const files = new Map<string, ScriptEntry>();
  const idOf = (file: CompiledBsFile) => formatScriptTag(fnv1(file.path));
  const seen = new Set<number>();
  // the build as it is now: a later swap is for the next host
  const set = compiledScripts();
  for (const { bundle, rows, tag } of bundles) {
    const file = set.scriptByBundle(bundle, destination);
    if (!file || seen.has(bundle >>> 0)) {
      continue;
    }
    seen.add(bundle >>> 0);
    const uses = [
      ...set.missionScripts(file),
      ...(rows ?? []).flatMap((row) => {
        const archetype =
          row.childScript && set.archetypeScript(row.childScript);
        return archetype ? [archetype] : [];
      }),
    ];
    for (const used of uses) {
      files.set(idOf(used), { file: used, refs: [] });
    }
    files.set(formatScriptTag(tag), {
      file,
      refs: [...new Set(uses.map(idOf))],
    });
  }
  const chunks = new Map<string, Uint8Array>();
  return {
    scriptFor: (bundleTag) =>
      files.has(formatScriptTag(bundleTag)) ? bundleTag : undefined,
    scripts: {
      read: (tagId) => {
        const entry = files.get(tagId);
        if (!entry) {
          return;
        }
        let chunk = chunks.get(tagId);
        if (!chunk) {
          chunk = withReferences(set.chunkFor(entry.file.path), entry.refs);
          chunks.set(tagId, chunk);
        }
        return chunk;
      },
      schema: (tagId) => {
        const entry = files.get(tagId);
        return entry ? set.schemaFor(entry.file.path) : undefined;
      },
      tags: () => [...files.keys()],
    },
  };
}

// The chunk, padded to a word, then each referenced tag as a big-endian
// word: scriptReferences reads every aligned word that names a known tag.
function withReferences(
  chunk: Uint8Array,
  refs: readonly string[]
): Uint8Array {
  if (refs.length === 0) {
    return chunk;
  }
  const padded = Math.ceil(chunk.length / WORD) * WORD;
  const out = new Uint8Array(padded + refs.length * WORD);
  out.set(chunk);
  const view = new DataView(out.buffer);
  refs.forEach((ref, i) => {
    view.setUint32(padded + i * WORD, Number.parseInt(ref, 16));
  });
  return out;
}
