// An Encounter row's archetype (the class its row runs: simple_encounter,
// trigger_volume_objective...). 41375 ships no encounter hosts, so the
// compiled scripts stand in for the packages: a script declares the Encounter
// rows of its bundle as class instances, so a row runs the archetype of the
// member named like it.
//
// A build whose rows carry the name hash alone (the alpha's) gets the names
// back the same way: a script declares every row of its bundle as a member, so
// a row whose hash is the hash of a declared path has that name. The host
// finds the namespaces its rows are grouped by (phase02.), the actors an
// instance's squads stand, and its objectives' squads by those names.
//
// Not part of the cached package tables: a rebuild of the scripts changes the
// declarations.
import {
  type CompiledScriptSet,
  fnv1,
  missionNamespaces,
  scriptStem,
} from "@blamnetwork/bullshcript/destiny1/common";
import { activityBundleItemType } from "./row-types";

// What the resolution needs of a bundle table: the tags of either kind.
interface BundleRows {
  bundle: number;
  rows: readonly {
    childScript?: string;
    name?: string;
    nameHash: number;
    typeId: number;
  }[];
}

type ScriptSet = Pick<
  CompiledScriptSet,
  "archetypeScript" | "missionScripts" | "schemaFor" | "scriptByBundle"
>;

type ScriptMember = ReturnType<ScriptSet["schemaFor"]>["members"][number];

const ARRAY_OF = /^(?:static_array|dynamic_array)<(\w+)(?:,\s*\d+)?>$/;

// The members that name rows: hosts, archetype instances and arrays of them.
const ROW_MEMBER_KINDS: ReadonlySet<string> = new Set([
  "class_instance",
  "dynamic_array",
  "handle",
  "object",
  "static_array",
]);

// A script's row members by name: the archetype a member declares, none for
// a host row.
type DeclaredRows = Map<string, string | undefined>;

// The archetype a member declares: a class instance of it, or an array of
// them (static_array<u_event_countdown, 2>). Members whose type is no
// archetype (hosts, structs) declare none.
function memberArchetype(
  set: ScriptSet,
  member: ScriptMember
): string | undefined {
  const type = ARRAY_OF.exec(member.type)?.[1] ?? member.type;
  const declared =
    member.kind === "class_instance" ||
    member.kind === "static_array" ||
    member.kind === "dynamic_array";
  return declared && set.archetypeScript(type) ? type : undefined;
}

// A bundle's declared members, and each mission's own by the phase it runs
// as.
interface BundleScope {
  members: DeclaredRows;
  phases: Map<string, DeclaredRows>;
}

// Adds the members of `members` not declared yet; one declared as a host in
// one script and an archetype instance in another is the instance.
function addRows(
  into: DeclaredRows,
  members: Iterable<ScriptMember>,
  set: ScriptSet
) {
  for (const member of members) {
    if (!ROW_MEMBER_KINDS.has(member.kind)) {
      continue;
    }
    const type = memberArchetype(set, member);
    if (
      !into.has(member.name) ||
      (type && into.get(member.name) === undefined)
    ) {
      into.set(member.name, type);
    }
  }
}

function scriptMembers(
  set: ScriptSet,
  script: NonNullable<ReturnType<ScriptSet["scriptByBundle"]>>,
  into: DeclaredRows
): DeclaredRows {
  for (const decl of script.decls) {
    if (decl.kind === "class") {
      addRows(into, set.schemaFor(script.path, decl.name).members, set);
    }
  }
  return into;
}

// The archetype members of the scripts that declare a bundle's rows: the
// bundle's own script (its hash is fnv1 of the file name), and for an
// activity root its missions', whose phases' rows they declare.
function declaredBy(
  set: ScriptSet,
  bundle: number,
  destination: string
): BundleScope {
  const members: DeclaredRows = new Map();
  const phases = new Map<string, DeclaredRows>();
  const file = set.scriptByBundle(bundle, destination);
  if (!file) {
    return { members, phases };
  }
  scriptMembers(set, file, members);
  const rootMembers = set.schemaFor(file.path).members;
  for (const mission of set.missionScripts(file)) {
    scriptMembers(set, mission, members);
    const [phase] = missionNamespaces(scriptStem(mission.path), rootMembers);
    if (phase !== undefined && !phases.has(phase)) {
      phases.set(phase, scriptMembers(set, mission, new Map()));
    }
  }
  return { members, phases };
}

// An archetype's own row members, by name.
function declaredByArchetype(set: ScriptSet, archetype: string): DeclaredRows {
  const declared: DeclaredRows = new Map();
  const file = set.archetypeScript(archetype);
  addRows(declared, file ? set.schemaFor(file.path).members : [], set);
  return declared;
}

// The name and the archetype of each row, by the name hash. A row named for
// the member that declares it ("obj_y", "pf_event_countdown_dropship[0]")
// runs that member's type; one under a prefab instance
// ("pf_event_countdown_dropship[0].pf_preset") is a member of that instance's
// archetype. A phase's rows are named under it ("phase_x.obj_y") and look in
// the mission running as that phase first. Rows carry the hash alone in some
// builds, so each name a row can have is hashed.
function rowsByName(
  set: ScriptSet,
  scope: BundleScope,
  rows: ReadonlySet<number>
): Map<number, { archetype?: string; name: string }> {
  const found = new Map<number, { archetype?: string; name: string }>();
  // An instance's row has to exist for its members' to; an array's elements
  // are the ones with rows.
  const walk = (prefix: string, members: DeclaredRows) => {
    for (const [member, type] of members) {
      const names = [`${prefix}${member}`];
      for (let i = 0; rows.has(fnv1(`${prefix}${member}[${i}]`)); i++) {
        names.push(`${prefix}${member}[${i}]`);
      }
      for (const name of names) {
        const hash = fnv1(name);
        if (!rows.has(hash)) {
          continue;
        }
        if (!found.has(hash)) {
          found.set(hash, { archetype: type, name });
        }
        if (type) {
          walk(`${name}.`, declaredByArchetype(set, type));
        }
      }
    }
  };
  walk("", scope.members);
  for (const [phase, members] of scope.phases) {
    walk(`${phase}.`, members);
    walk(`${phase}.`, scope.members);
  }
  return found;
}

// The tags with each Encounter row's childScript set from the scripts, and
// the name of a row that carries its hash alone where a script declares it;
// a row no member declares, or in a bundle with no script, stays as it is.
export function withChildScripts<T extends BundleRows>(
  tags: readonly T[],
  destination: string,
  set: ScriptSet
): T[] {
  // a bundle loaded as several tags is declared once
  const scopes = new Map<number, BundleScope>();
  return tags.map((tag) => {
    let scope = scopes.get(tag.bundle);
    if (!scope) {
      scope = declaredBy(set, tag.bundle, destination);
      scopes.set(tag.bundle, scope);
    }
    if (scope.members.size === 0) {
      return tag;
    }
    const declared = rowsByName(
      set,
      scope,
      new Set(tag.rows.map((row) => row.nameHash >>> 0))
    );
    return {
      ...tag,
      rows: tag.rows.map((row) => {
        const found = declared.get(row.nameHash >>> 0);
        const childScript =
          row.typeId === activityBundleItemType().Encounter
            ? found?.archetype
            : undefined;
        return {
          ...row,
          ...(row.name === undefined && found ? { name: found.name } : {}),
          ...(childScript ? { childScript } : {}),
        };
      }),
    } as T;
  });
}
