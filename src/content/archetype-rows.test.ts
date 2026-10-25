// Every Encounter row the scripts declare as an archetype member, across
// every activity with a table: who owns it (the host runs one instance per
// row, its bundle's scripts') and who else declares it. Only a declaration
// the ownership rule cannot reconcile fails.
import {
  type ActivityBundleTag,
  type CompiledBsFile,
  loadScriptFolder,
  missionNamespaces,
  parseBungieScript,
  resolveInstanceField,
  scriptStem,
} from "@blamnetwork/bullshcript/destiny1/common";
import { expect, it } from "vitest";
import {
  compiledScripts,
  scriptFolder,
} from "../activity-host-proxy/script-host/compiled-scripts";
import { describeWithPackages } from "../test-support/build";
import { activityIds, activityName } from "./activities";
import { withChildScripts } from "./child-scripts";
import { activityBundles, bundleTags } from "./index";
import { activityBundleItemType } from "./row-types";

const ARRAY_OF = /^(?:static_array|dynamic_array)<(\w+)(?:,\s*\d+)?>$/;
const ARRAY_PROBE = 16;

const hex = (value: number) =>
  `0x${(value >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;

interface Declaration {
  activity: string;
  // the archetype the row runs (its childScript); none, the host runs none
  archetype?: string;
  // the explicit bind's identifier as written, when it binds a string
  bind?: string;
  // the bundle the declaring script speaks for (a mission: its root's)
  bundle: number;
  field: string;
  load: number;
  root: boolean;
  row: { bundle: number; name: string; typeIndex: number };
  script: string;
  type: string;
}

const scriptTexts = () =>
  new Map(
    loadScriptFolder(scriptFolder()).files.map((file) => [file.path, file.text])
  );

// A script's archetype members with their bind literals, from its source.
function archetypeMembers(text: string, path: string) {
  const set = compiledScripts();
  const members: {
    bind?: string;
    isArray: boolean;
    name: string;
    type: string;
  }[] = [];
  for (const decl of parseBungieScript(text, path).decls) {
    for (const member of decl.members) {
      if (member.kind !== "field") {
        continue;
      }
      const element = ARRAY_OF.exec(member.type.text)?.[1];
      const type = element ?? member.type.text;
      if (!set.archetypeScript(type)) {
        continue;
      }
      const literal = member.bind?.[0];
      members.push({
        bind: literal?.kind === "string" ? literal.value : undefined,
        isArray: element !== undefined,
        name: member.name,
        type,
      });
    }
  }
  return members;
}

// The fields a member names: itself, or its array's indices with a row.
function memberFields(
  name: string,
  isArray: boolean,
  resolve: (field: string) => unknown
): string[] {
  if (!isArray) {
    return [name];
  }
  const fields: string[] = [];
  for (let i = 0; i < ARRAY_PROBE && resolve(`${name}[${i}]`); i++) {
    fields.push(`${name}[${i}]`);
  }
  return fields;
}

function activityNames(): string[] {
  const names = new Set<string>();
  for (const id of activityIds()) {
    const name = activityName(id);
    if (name) {
      names.add(name);
    }
  }
  return [...names];
}

interface ActivityScript {
  bundle: number;
  file: CompiledBsFile;
  namespaces: string[];
  // a mission: the phase its root declares it as
  phase?: string;
  root: boolean;
  tags: readonly ActivityBundleTag[];
}

// The activity's scripts in the host's load order (each bundle's root, then
// the missions the roots reference), with what each resolves against.
function activityScripts(
  tags: readonly ActivityBundleTag[],
  destination: string
): ActivityScript[] {
  const set = compiledScripts();
  const roots: ActivityScript[] = [];
  const missions: ActivityScript[] = [];
  const seen = new Set<number>();
  for (const tag of tags) {
    const file = set.scriptByBundle(tag.bundle, destination);
    if (!file || seen.has(tag.bundle >>> 0)) {
      continue;
    }
    seen.add(tag.bundle >>> 0);
    roots.push({
      bundle: tag.bundle,
      file,
      namespaces: [],
      root: true,
      tags: [
        ...tags.filter((t) => t.bundle === tag.bundle),
        ...tags.filter((t) => t.bundle !== tag.bundle),
      ],
    });
    const rootMembers = set.schemaFor(file.path).members;
    for (const mission of set.missionScripts(file)) {
      const stem = scriptStem(mission.path);
      missions.push({
        bundle: tag.bundle,
        file: mission,
        namespaces: missionNamespaces(stem, rootMembers),
        phase: rootMembers.find((member) => member.type === stem)?.name,
        root: false,
        tags,
      });
    }
  }
  return [...roots, ...missions];
}

const rowKey = (activity: string, row: { bundle: number; typeIndex: number }) =>
  `${activity}|${hex(row.bundle)}:${row.typeIndex}`;

function declarations(): Declaration[] {
  const texts = scriptTexts();
  const declared: Declaration[] = [];
  for (const activity of activityNames()) {
    const table = activityBundles(activity);
    if (!table) {
      continue;
    }
    const tags = withChildScripts(
      bundleTags(activity),
      table.destination,
      compiledScripts()
    );
    activityScripts(tags, table.destination).forEach((script, load) => {
      const text = texts.get(script.file.path) ?? "";
      for (const member of archetypeMembers(text, script.file.path)) {
        const resolve = (field: string) =>
          resolveInstanceField(script.tags, "", field, script.namespaces);
        for (const field of memberFields(
          member.name,
          member.isArray,
          resolve
        )) {
          const row = resolve(field);
          if (row?.typeId !== activityBundleItemType().Encounter) {
            continue;
          }
          declared.push({
            activity,
            archetype: tags
              .find((t) => t.bundle === row.bundle)
              ?.rows.find(
                (r) => r.typeId === row.typeId && r.typeIndex === row.typeIndex
              )?.childScript,
            bind: member.bind,
            bundle: script.bundle,
            field,
            load,
            root: script.root,
            row: {
              bundle: row.bundle,
              name: row.name,
              typeIndex: row.typeIndex,
            },
            script: script.file.path,
            type: member.type,
          });
        }
      }
    });
  }
  return declared;
}

// The owner the host picks: a script of the row's bundle (its root, then its
// missions), else the first declarer in load order.
function ownerOf(declarers: readonly Declaration[]): Declaration {
  const byLoad = [...declarers].sort((a, b) => a.load - b.load);
  return (
    byLoad.find((d) => d.bundle === d.row.bundle && d.root) ??
    byLoad.find((d) => d.bundle === d.row.bundle) ??
    byLoad[0]
  );
}

const where = (d: Declaration) => `${d.script} ${d.field}`;

describeWithPackages(
  "archetype rows across the scripts",
  { timeout: 300_000 },
  () => {
    it("gives every declared archetype row one owner", () => {
      const declared = declarations();
      const rows = new Map<string, Declaration[]>();
      for (const d of declared) {
        const key = rowKey(d.activity, d.row);
        rows.set(key, [...(rows.get(key) ?? []), d]);
      }
      expect(declared.length).toBeGreaterThan(0);

      const conflicts: string[] = [];
      for (const [key, declarers] of rows) {
        const owner = ownerOf(declarers);
        // a script of the row's own bundle owns it when any declares it
        if (declarers.some((d) => d.bundle === d.row.bundle)) {
          expect(owner.bundle, key).toBe(owner.row.bundle);
        }
        // every declarer runs the row's archetype, under one bind
        const binds = new Set(
          declarers.flatMap((d) => (d.bind ? [d.bind] : []))
        );
        const mismatched = declarers.some(
          (d) => owner.archetype !== undefined && d.type !== owner.archetype
        );
        if (mismatched || binds.size > 1) {
          conflicts.push(
            `${key} runs ${owner.archetype}: ${declarers
              .map(
                (d) =>
                  `${where(d)} ${d.type}${d.bind ? ` bind(${d.bind})` : ""}`
              )
              .join("; ")}`
          );
        }
      }
      expect(conflicts).toEqual([]);
    });
  }
);
