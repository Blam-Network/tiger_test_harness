// Reads an activity's scenario_client and bundles off the disc packages. The
// scenario_client names each bubble's bundles by hash (slice descriptor ->
// client blueprint set -> blueprint bundles); the activity bundle tags with
// those hashes are the ones in the package of the activity's scenario_fah, and
// the fah picks between copies of one bundle per bubble. A bundle lists its
// rows, and its lookup finds the sensor host definition of each row. The
// neutral activity-table.ts builds the bundle table from them.
//
// The packages hold hashes only: no row has a name. The squad cells the squad
// hosts keep are not read, nor is the Objective each is authored against (the
// scripts' @objective say it); a squad's members come from its squad template,
// found by the name hash its row shares with it. An Actor row's host names its
// squad but not its cell: the cell is the squad's member the row's import
// identifier names.
import type { ActivityBundleItemTypes } from "@blamnetwork/bullshcript/destiny1/common";
import type {
  BundleSource,
  ObjectiveTaskSource,
  ScenarioClient,
  SensorHostSource,
} from "../../../model/activity-source";
import type { ActivityNavPoint } from "../../../types";
import type { ContentReaders } from "../../content-build";
import type { Packages } from "./package-set";

const NONE = 0xff_ff_ff_ff;

// A sensor or auth schema, none being 0 or all ones.
const schemaOf = (hash: number) =>
  hash === 0 || hash === NONE ? undefined : hash;

interface SquadTemplate {
  members: readonly number[];
  spaceHash: number;
  spawnPoints: readonly { x: number; y: number; z: number }[];
}

interface HostEntry {
  definition: number;
  head: any;
  host: Buffer;
  index: number;
  type: number;
}

export function activityTableReaders(
  packages: () => Packages,
  itemType: ActivityBundleItemTypes
): Pick<ContentReaders, "activityBundle" | "activityScenario"> {
  const hostBytes = new Map<number, Buffer>();
  let bundlesByPackage: Map<number, Map<number, number[]>> | undefined;
  let templatesByName: Map<number, SquadTemplate[]> | undefined;

  const readHost = (host: Buffer, definition: unknown, offset?: number): any =>
    packages().g.read_definition(host, definition as any, offset);
  const read = (tag: number, definition: unknown): any =>
    readHost(packages().set.read_tag(tag), definition);

  function hostOf(tag: number): Buffer {
    let host = hostBytes.get(tag);
    if (!host) {
      host = packages().set.read_tag(tag) as Buffer;
      hostBytes.set(tag, host);
    }
    return host;
  }

  // The tag of a named root of a class, undefined when there is none.
  function namedTag(name: string, classHash: number): number | undefined {
    const { g, set } = packages();
    const named = g.find_named_tag(set, name);
    return named && named.class_hash >>> 0 === classHash >>> 0
      ? (named.hash as number) >>> 0
      : undefined;
  }

  // Every activity bundle tag, by the package it is in and its bundle hash.
  function bundlesIn(pkg: number): Map<number, number[]> {
    const { g, set } = packages();
    if (!bundlesByPackage) {
      bundlesByPackage = new Map();
      for (const { hash } of set.entries_of_class(g.k_activity_bundle_class)) {
        const { bundle } = read(hash, g.s_activity_bundle);
        const inPackage =
          bundlesByPackage.get(g.tag_hash_package(hash)) ?? new Map();
        inPackage.set(bundle, [...(inPackage.get(bundle) ?? []), hash]);
        bundlesByPackage.set(g.tag_hash_package(hash), inPackage);
      }
    }
    return bundlesByPackage.get(pkg) ?? new Map();
  }

  // The squad templates, by name hash. A squad row names its template by hash
  // alone.
  function squadTemplates(): Map<number, SquadTemplate[]> {
    const { g, set } = packages();
    if (!templatesByName) {
      templatesByName = new Map();
      for (const { hash } of set.entries_of_class(g.k_squad_definition_class)) {
        const template = read(hash, g.s_squad_definition);
        const list = templatesByName.get(template.name_hash) ?? [];
        list.push({
          members: template.members.map(
            (member: { archetype: number }) => member.archetype >>> 0
          ),
          spaceHash: template.space_hash,
          spawnPoints: template.spawn_points.map(
            ({ x, y, z }: { x: number; y: number; z: number }) => ({ x, y, z })
          ),
        });
        templatesByName.set(template.name_hash, list);
      }
    }
    return templatesByName;
  }

  // The cells the Actor rows fill, by Actor row index: the squad's member
  // named by the row's import identifier. Actors naming one member take its
  // cells in row order.
  function actorCells(
    hosts: readonly SensorHostSource[],
    squadOf: ReadonlyMap<number, number>,
    members: ReadonlyMap<number, readonly number[]>
  ): void {
    const taken = new Map<string, number>();
    for (const host of hosts) {
      const squad = squadOf.get(host.index);
      if (host.typeId !== itemType.Actor || squad === undefined) {
        continue;
      }
      const key = `${squad}|${host.identifier}`;
      const skip = taken.get(key) ?? 0;
      taken.set(key, skip + 1);
      const cell = (members.get(squad) ?? [])
        .flatMap((member, at) => (member === host.identifier >>> 0 ? [at] : []))
        .at(skip);
      if (cell !== undefined) {
        host.actor = { cell, squad };
      }
    }
  }

  // A bundle's Squad rows' members and spawn points, by row index. A name
  // its templates share is settled by the spaces the bundle's unshared names
  // sit in (the Venus bounty's vex_simple_encounter02._squad[0] has one
  // template per bounty zone); templates that agree need no settling, and
  // ones that never agree on the spawn points give none.
  function squadTemplatesOf(
    squads: readonly { nameHash: number; typeIndex: number }[]
  ): Map<
    number,
    {
      members?: readonly number[];
      spawnPoints?: SquadTemplate["spawnPoints"];
    }
  > {
    const byName = squadTemplates();
    const spaces = new Set<number>();
    for (const { nameHash } of squads) {
      const found = byName.get(nameHash) ?? [];
      if (new Set(found.map((template) => template.spaceHash)).size === 1) {
        spaces.add(found[0].spaceHash);
      }
    }
    // What every template of a pick agrees on, the first pick that does.
    const agreed = <T>(
      picks: readonly (readonly SquadTemplate[])[],
      of: (template: SquadTemplate) => T
    ): T | undefined => {
      for (const pick of picks) {
        if (
          pick.length > 0 &&
          new Set(pick.map((template) => JSON.stringify(of(template)))).size ===
            1
        ) {
          return of(pick[0]);
        }
      }
    };
    const out = new Map<
      number,
      {
        members?: readonly number[];
        spawnPoints?: SquadTemplate["spawnPoints"];
      }
    >();
    for (const { nameHash, typeIndex } of squads) {
      const found = byName.get(nameHash) ?? [];
      const picks = [
        found,
        found.filter((template) => spaces.has(template.spaceHash)),
      ];
      out.set(typeIndex, {
        members: agreed(picks, (template) => template.members),
        spawnPoints: agreed(picks, (template) => template.spawnPoints),
      });
    }
    return out;
  }

  function hostFacts({
    definition,
    host,
    type,
  }: HostEntry): Partial<SensorHostSource> {
    const { g } = packages();
    if (type === itemType.Objective) {
      // The AI task tree, flat and index-addressed the way the tag stores it:
      // the first is the unnamed root.
      const objective = readHost(
        host,
        g.s_objective_sensor_host_definition,
        definition
      );
      // Each task's squad filter and condition are not read: the scripts'
      // @task say them.
      return {
        tasks: objective.tasks.map(
          (task: any): ObjectiveTaskSource => ({
            name: task.name,
            influencer: task.unknown0c,
            priority: task.unknown30,
            firstChild: task.unknown34,
            nextSibling: task.unknown38,
            parent: task.unknown3c,
            capacity: task.unknown4c,
          })
        ),
      };
    }
    if (type === itemType.Sequence) {
      // Whether the sequence has a blueprint (the objective archetypes'
      // placeholder rows and the event incoming rows have none and can never
      // play) and its length in seconds.
      const sequence = readHost(
        host,
        g.s_sequence_sensor_host_definition,
        definition
      );
      return {
        sequence: {
          blueprint: sequence.has_sequence !== 0,
          duration: sequence.duration,
        },
      };
    }
    if (type === itemType.Object) {
      // Where the object stands, which a waypoint on it points at.
      const { x, y, z } = readHost(
        host,
        g.s_object_sensor_host_definition,
        definition
      );
      return [x, y, z].every(Number.isFinite)
        ? { objectPosition: { x, y, z } }
        : {};
    }
    if (type === itemType.Loot) {
      // A loot row's import label is its material hash; its identifier is
      // empty.
      const loot = readHost(host, g.s_loot_sensor_host_definition, definition);
      return { identifier: loot.material_hash };
    }
    return {};
  }

  return {
    activityBundle(tag): BundleSource {
      const { g } = packages();
      const bundle = read(tag, g.s_activity_bundle);
      const lookupTag: number | undefined = bundle.lookups[0]?.tag;
      const lookup =
        lookupTag === undefined
          ? undefined
          : read(lookupTag, g.s_activity_lookup);
      const entryOf = new Map<number, any>(
        (lookup?.rows ?? []).map((entry: any) => [entry.name_hash, entry])
      );
      const hosts: SensorHostSource[] = [];
      // Actor row -> the Squad row it fills a cell of
      const actorSquad = new Map<number, number>();
      const navPoints: ActivityNavPoint[] = [];
      bundle.rows.forEach((row: any, index: number) => {
        const entry = entryOf.get(row.name_hash);
        if (!entry) {
          return;
        }
        // The row's instance in the host tag points at its definition.
        const host = hostOf(entry.host_tag);
        const { definition: pointer } = readHost(
          host,
          g.s_sensor_host_instance,
          entry.record_offset
        );
        let head: any;
        try {
          head = readHost(host, g.s_sensor_host_definition, pointer.offset);
        } catch (error) {
          if (error instanceof g.tag_format_error) {
            return;
          }
          throw error;
        }
        // A script row's definition is no sensor host definition; what reads
        // as one names this row.
        if (
          head.sensor.row >>> 24 !== row.type ||
          (head.sensor.row & 0xff_ff) !== index ||
          head.sensor.bundle !== bundle.bundle
        ) {
          return;
        }
        const entryHost: HostEntry = {
          definition: pointer.offset,
          head,
          host,
          index,
          type: row.type,
        };
        if (row.type === itemType.Actor) {
          const { squad } = readHost(
            host,
            g.s_actor_sensor_host_definition,
            pointer.offset
          );
          if (squad.bundle === bundle.bundle) {
            actorSquad.set(index, squad.row & 0xff_ff);
          }
        }
        hosts.push({
          typeId: row.type,
          index,
          identifier: head.identifier,
          auth: schemaOf(head.auth_schema),
          sense: schemaOf(head.sense_schema),
          sliceSet: head.slice_set,
          ...hostFacts(entryHost),
        });
        if (
          row.type === itemType.NavPoint &&
          pointer.type === g.k_nav_point_sensor_definition_type
        ) {
          const nav = readHost(
            host,
            g.s_nav_point_sensor_host_definition,
            pointer.offset
          );
          if (
            nav.row_name_hash === row.name_hash &&
            [nav.x, nav.y, nav.z].every(Number.isFinite)
          ) {
            navPoints.push({
              sliceSet: nav.slice_set,
              typeIndex: index,
              x: nav.x,
              y: nav.y,
              z: nav.z,
            });
          }
        }
      });
      const templates = squadTemplatesOf(
        bundle.rows
          .map((row: any, typeIndex: number) => ({
            nameHash: row.name_hash,
            type: row.type,
            typeIndex,
          }))
          .filter((row: { type: number }) => row.type === itemType.Squad)
      );
      const members = new Map<number, readonly number[]>();
      for (const [typeIndex, { members: cells }] of templates) {
        if (cells) {
          members.set(typeIndex, cells);
        }
      }
      for (const host of hosts) {
        if (host.typeId === itemType.Squad) {
          host.squadMembers = members.get(host.index);
          const points = templates.get(host.index)?.spawnPoints;
          if (points && points.length > 0) {
            host.squadSpawnPoints = points;
          }
        }
      }
      actorCells(hosts, actorSquad, members);
      return {
        bundle: bundle.bundle,
        rows: bundle.rows.map((row: any) => ({
          nameHash: row.name_hash,
          typeId: row.type,
        })),
        hosts,
        navPoints,
      };
    },

    activityScenario(activityName): ScenarioClient | undefined {
      const { g } = packages();
      const scenarioTag = namedTag(
        `${activityName}:scenario_client`,
        g.k_scenario_client_class
      );
      if (scenarioTag === undefined) {
        return;
      }
      const scenario = read(scenarioTag, g.s_scenario_client);
      const fahTag = namedTag(
        `${activityName}:scenario_fah`,
        g.k_scenario_fah_class
      );
      const fah =
        fahTag === undefined ? undefined : read(fahTag, g.s_scenario_fah);
      const candidates =
        fahTag === undefined
          ? undefined
          : bundlesIn(g.tag_hash_package(fahTag));
      // The bundle tags a blueprint reference names: those with its bundle
      // hash in the fah's package, narrowed to the bubble's own slice tables
      // where it has copies.
      const bundleTags = (
        refs: { tag: number }[],
        bubble: number,
        state: number
      ): number[] =>
        refs.flatMap(({ tag }) => {
          const { bundle } = read(tag, g.s_blueprint_bundle);
          const all: number[] = candidates?.get(bundle) ?? [];
          const own: number[] =
            fah?.bubbles[bubble]?.entries[state]?.slices.map(
              (slice: { tag: number }) => slice.tag
            ) ?? [];
          const picked = all.filter((candidate) => own.includes(candidate));
          return picked.length > 0 ? picked : all;
        });
      return {
        tag: scenarioTag,
        familyChecksum: scenario.family_checksum,
        privateChecksum: scenario.private_checksum,
        publicChecksum: scenario.public_checksum,
        bubbles: scenario.bubbles.map((bubble: any, bubbleIndex: number) =>
          bubble.states.map((state: any, stateIndex: number) => {
            const descriptor = read(state.descriptor, g.s_slice_descriptor);
            const blueprints = read(
              descriptor.blueprint_set,
              g.s_client_blueprint_set
            );
            const tagsOf = (refs: { tag: number }[]) =>
              bundleTags(refs, bubbleIndex, stateIndex);
            return {
              region: state.region_name_hash,
              public: state.mode !== 0,
              // The value the bubble's fah entry shares with its state.
              phase: state.unknown04,
              blueprints: {
                global: tagsOf(blueprints.global_bundles),
                authoritative: tagsOf(blueprints.authoritative_bundles),
                private: tagsOf(blueprints.private_bundles),
              },
            };
          })
        ),
      };
    },
  };
}
