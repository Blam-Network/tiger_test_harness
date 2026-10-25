// Reads an activity's scenario_client and bundles off the disc packages:
// scenario_client -> bubble slice descriptors -> client blueprint sets ->
// activity bundles, each with its rows and the sensor hosts its lookup groups
// list. The neutral activity-table.ts builds the bundle table from them.
//
// An Encounter row's archetype is not in the packages (41375 ships no
// encounter hosts); child-scripts.ts takes it from the compiled scripts.
import type { ActivityBundleItemTypes } from "@blamnetwork/bullshcript/destiny1/common";
import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { k_empty_name_hash } from "../../../../utils/name-hash";
import type {
  BundleSource,
  ScenarioClient,
  SensorHostSource,
} from "../../../model/activity-source";
import type { ActivityNavPoint } from "../../../types";
import type { ContentReaders } from "../../content-build";
import type { Packages } from "./package-set";

const NONE = 0xff_ff_ff_ff;

// Scenario client tag class (80800616); the packages name each activity's
// scenario "<activity>:scenario_client".
const SCENARIO_CLIENT_CLASS = 0x80_80_06_16;

// A NavPoint row's bundle has one row group host of type 808008B0 whose
// entries name them ({name, row, slice set}), and whose instance data holds a
// 0x30-byte record per row: fnv1 of the name first, the position at +0x20.
const NAV_POINT_SET = 0x80_80_08_b0;
const NAV_POINT_RECORD_POSITION = 0x20;

// The package set's scenario_client tag for an activity: the one named
// "<activity>:scenario_client", the name the client resolves it by. Its family
// checksum is fnv1 of the activity name.
function scenarioTagFor(set: any, activityName: string) {
  const named = set.find_named_tag(`${activityName}:scenario_client`);
  return named && named.class_hash >>> 0 === SCENARIO_CLIENT_CLASS
    ? (named.hash as number) >>> 0
    : undefined;
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
): Pick<
  ContentReaders,
  "activityBundle" | "activityScenario" | "commandScripts"
> {
  const readHost = (host: Buffer, definition: unknown, offset?: number): any =>
    packages().g.read_definition(host, definition as any, offset);
  const read = (tag: number, definition: unknown, offset?: number): any =>
    readHost(packages().set.read_tag(tag), definition, offset);

  // Every sensor host a bundle's lookup groups list, by row index: its head
  // (row, slice set, schemas, identifier) and the definition behind it.
  function sensorHosts(bundle: any): HostEntry[] {
    const { g, set } = packages();
    const hosts: HostEntry[] = [];
    for (const group of bundle.lookup_groups) {
      for (const { tag } of group.lookups) {
        const host = set.read_tag(read(tag, g.s_activity_lookup).host_tag);
        const { definition } = g.host_offsets(host);
        let head: any;
        try {
          head = readHost(host, g.s_sensor_host_definition, definition);
        } catch {
          continue;
        }
        const type = head.sensor.row >>> 24;
        if (type === 0 || head.sensor.bundle !== bundle.bundle) {
          continue;
        }
        hosts.push({
          definition,
          head,
          host,
          index: head.sensor.row & 0xff_ff,
          type,
        });
      }
    }
    return hosts;
  }

  function hostFacts({
    definition,
    host,
    type,
  }: HostEntry): Partial<SensorHostSource> {
    const { g } = packages();
    if (type === itemType.Squad) {
      // The squad definition's members' name hashes, one per cell (its member
      // entries, read at def+0x1C by sub_824C70F0).
      const { squad } = readHost(
        host,
        g.s_squad_sensor_host_definition,
        definition
      );
      return {
        squadMembers: read(squad, g.s_squad_definition).members.map(
          (member: { archetype: number }) => member.archetype >>> 0
        ),
      };
    }
    if (type === itemType.Actor) {
      // The cell a named Actor row fills (the actor definition's +0x50, where
      // sub_825D4780 places it).
      const actor = readHost(
        host,
        g.s_actor_sensor_host_definition,
        definition
      );
      return {
        actor: { squad: actor.squad.row & 0xff_ff, cell: actor.unknown50 },
      };
    }
    if (type === itemType.Objective) {
      // An Objective row's AI tasks (its sensor host definition's tasks
      // block): a squad is linked under one by SquadAuth [10] and the client
      // hands it a firing area set from the task's options. The names block
      // has the unnamed root first, so tasks[i] is task_names[i + 1]. The
      // influencer is the task's +0xC, sent beside the index.
      const objective = readHost(
        host,
        g.s_objective_sensor_host_definition,
        definition
      );
      return {
        tasks: objective.tasks.map((task: any, i: number) => ({
          influencer: task.unknown0c,
          name: objective.task_names[i + 1]?.hash ?? k_empty_name_hash,
        })),
      };
    }
    if (type === itemType.Sequence) {
      // A Sequence row's asset and length: the objective archetypes'
      // _incoming_sequence / _completion_sequence rows have none and can never
      // play (the real server never starts them), and a line's length is what
      // its is_done() waits.
      const sequence = readHost(
        host,
        g.s_sequence_sensor_host_definition,
        definition
      );
      return {
        sequence: {
          blueprint: sequence.sequence !== NONE,
          duration: sequence.duration,
        },
      };
    }
    return {};
  }

  // A bundle's NavPoint rows and where they are. NavPoint rows have no
  // sensor, see NAV_POINT_SET.
  function navPoints(bundle: any): ActivityNavPoint[] {
    const { g, set } = packages();
    const points: ActivityNavPoint[] = [];
    for (const group of bundle.lookup_groups) {
      for (const { tag } of group.lookups) {
        const host = set.read_tag(read(tag, g.s_activity_lookup).host_tag);
        const { definition } = g.host_offsets(host);
        if (
          definition < 4 ||
          host.readUInt32BE(definition - 4) !== NAV_POINT_SET
        ) {
          continue;
        }
        const rowGroup = readHost(host, g.s_row_group_definition, definition);
        for (const entry of rowGroup.entries) {
          if (entry.row.bundle !== bundle.bundle) {
            continue;
          }
          const key = Buffer.alloc(4);
          key.writeUInt32BE(fnv1(entry.name));
          const at = host.indexOf(key, definition);
          if (at < 0 || at + NAV_POINT_RECORD_POSITION + 12 > host.length) {
            continue;
          }
          const p = at + NAV_POINT_RECORD_POSITION;
          points.push({
            sliceSet: entry.slice_set,
            typeIndex: entry.row.row & 0xff_ff,
            x: host.readFloatBE(p),
            y: host.readFloatBE(p + 4),
            z: host.readFloatBE(p + 8),
          });
        }
      }
    }
    return points.sort((a, b) => a.typeIndex - b.typeIndex);
  }

  return {
    // The live host sends no command scripts (its actor auth has no atoms yet).
    commandScripts: () => [],
    activityBundle(tag): BundleSource {
      const { g } = packages();
      const bundle = read(tag, g.s_activity_bundle);
      return {
        bundle: bundle.bundle,
        rows: bundle.rows.map((row: any) => ({
          name: row.name,
          nameHash: fnv1(row.name),
          typeId: row.type,
        })),
        hosts: sensorHosts(bundle).map(
          (entry): SensorHostSource => ({
            typeId: entry.type,
            index: entry.index,
            identifier: entry.head.identifier,
            auth:
              entry.head.auth_schema === NONE
                ? undefined
                : entry.head.auth_schema,
            sense:
              entry.head.sense_schema === NONE
                ? undefined
                : entry.head.sense_schema,
            sliceSet: entry.head.slice_set,
            ...hostFacts(entry),
          })
        ),
        navPoints: navPoints(bundle),
      };
    },

    activityScenario(activityName): ScenarioClient | undefined {
      const { g, set } = packages();
      const scenarioTag = scenarioTagFor(set, activityName);
      if (scenarioTag === undefined) {
        return;
      }
      const scenario = read(scenarioTag, g.s_scenario_client);
      const tagsOf = (list: { tag: number }[]) => list.map(({ tag }) => tag);
      return {
        tag: scenarioTag,
        familyChecksum: scenario.family_checksum,
        privateChecksum: scenario.private_checksum,
        publicChecksum: scenario.public_checksum,
        bubbles: scenario.bubbles.map((bubble: any) =>
          bubble.states.map((state: any) => {
            const descriptor = read(state.descriptor, g.s_slice_descriptor);
            const blueprints = read(
              descriptor.blueprint_set,
              g.s_client_blueprint_set
            );
            return {
              region: state.region_name_hash,
              public: state.mode !== 0,
              // A later state's +0x04 is fnv1 of the phase row's name.
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
