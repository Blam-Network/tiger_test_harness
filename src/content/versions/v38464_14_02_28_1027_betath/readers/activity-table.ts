// Reads an activity's scenario_client and bundles off the disc packages:
// scenario_client -> bubble slice descriptors -> client blueprint sets ->
// activity bundles, each with its rows and the sensor hosts its lookup groups
// list. The neutral activity-table.ts builds the bundle table from them.
//
// An Encounter row's archetype is not in the packages (the pre-alpha ships no
// encounter hosts); child-scripts.ts takes it from the compiled scripts.
//
// The tags are 64-bit and little endian, and a row reference is {bundle,
// type, index} rather than the 360's packed word. The host header is the 360
// alpha's widened; the sensor heads and the definitions read here are laid
// out as the Alpha Trial's.
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

// A NavPoint row's bundle has one row group host of type 8080088A whose
// entries name them ({name, row, slice set}), and whose instance data holds a
// 0x20-byte record per row: fnv1 of the name and the row index, then the
// position at +0x10 (x y z, w 1).
const NAV_POINT_RECORD_POSITION = 0x10;

// The package set's scenario_client tag for an activity: the one named
// "<activity>:scenario_client", the name the client resolves it by. Its family
// checksum is fnv1 of the activity name.
function scenarioTagFor(g: Packages["g"], set: any, activityName: string) {
  const named = set.find_named_tag(`${activityName}:scenario_client`);
  return named && named.class_hash >>> 0 === g.k_scenario_client_class
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
        const { type, index } = head.sensor;
        if (type === 0 || head.sensor.bundle !== bundle.bundle) {
          continue;
        }
        hosts.push({ definition, head, host, index, type });
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
      // The squad definition's members' name hashes, one per cell.
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
      // The cell a named Actor row fills (the live build's +0x50, widened).
      const actor = readHost(
        host,
        g.s_actor_sensor_host_definition,
        definition
      );
      return {
        actor: { squad: actor.squad.index, cell: actor.unknown74 },
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
          host.readUInt32LE(definition - 4) !==
            g.k_nav_point_set_definition_type
        ) {
          continue;
        }
        const rowGroup = readHost(host, g.s_row_group_definition, definition);
        for (const entry of rowGroup.entries) {
          if (entry.row.bundle !== bundle.bundle) {
            continue;
          }
          const key = Buffer.alloc(4);
          key.writeUInt32LE(fnv1(entry.name));
          const at = host.indexOf(key, definition);
          if (at < 0 || at + NAV_POINT_RECORD_POSITION + 12 > host.length) {
            continue;
          }
          const p = at + NAV_POINT_RECORD_POSITION;
          points.push({
            sliceSet: entry.slice_set,
            typeIndex: entry.row.index,
            x: host.readFloatLE(p),
            y: host.readFloatLE(p + 4),
            z: host.readFloatLE(p + 8),
          });
        }
      }
    }
    return points.sort((a, b) => a.typeIndex - b.typeIndex);
  }

  return {
    // The host sends no command scripts (its actor auth has no atoms yet).
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
      const scenarioTag = scenarioTagFor(g, set, activityName);
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
