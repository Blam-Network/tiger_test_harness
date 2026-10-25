// A ControlPoint row is a compiled command script: the atoms (a command and
// the condition that ends it) a script's execute() on the row hands an actor,
// which the host sends whole in the actor's auth. The row's lookup entry points
// at its sensor host instance, whose definition holds the atoms. This is the
// dropships' flight paths and the Fallen ship's exit.
import type {
  ActivityBundleItemTypes,
  CommandScriptAtom,
  CommandScriptCommand,
  CommandScriptEndCondition,
  ControlPointCommandScript,
} from "@blamnetwork/bullshcript/destiny1/common";
import type { ContentReaders } from "../../content-build";
import type { Packages } from "./package-set";

// An unset row reference is {empty name hash, FF00FFFF}.
const NO_ROW = 0xff_00_ff_ff;

// A point no row names: the empty name hash with no type, as the client
// reads it.
const EMPTY_NAME_HASH = 0x81_1c_9d_c5;

interface Reference {
  bundle: number;
  typeId: number;
  typeIndex: number;
}

export function commandScriptReaders(
  packages: () => Packages,
  itemType: ActivityBundleItemTypes
): Pick<ContentReaders, "commandScripts"> {
  const byTag = new Map<number, ControlPointCommandScript[]>();

  const rowReference = (
    host: Buffer,
    offset: number
  ): Reference | undefined => {
    const { g } = packages();
    const ref = g.s_row_reference.read(host, offset, "big");
    return ref.row >>> 0 === NO_ROW
      ? undefined
      : {
          bundle: ref.bundle >>> 0,
          typeId: ref.row >>> 24,
          typeIndex: ref.row & 0xff_ff,
        };
  };

  const pointOf = (host: Buffer, offset: number): Reference =>
    rowReference(host, offset) ?? {
      bundle: EMPTY_NAME_HASH,
      typeId: -1,
      typeIndex: -1,
    };

  // The command of a wire kind (the order of k_command_classes), undefined
  // for a class this build doesn't know.
  function readCommand(
    host: Buffer,
    kind: number,
    at: number
  ): CommandScriptCommand | undefined {
    const { g } = packages();
    switch (kind) {
      case 0: {
        const command = g.s_snap_to_command.read(host, at, "big");
        return { kind, point: pointOf(host, at), index: command.index };
      }
      case 1:
        return {
          kind,
          name: g.s_named_command.read(host, at, "big").name >>> 0,
        };
      case 2:
        return {
          kind,
          seconds: g.s_sleep_command.read(host, at, "big").seconds,
        };
      case 3: {
        const command = g.s_move_command.read(host, at, "big");
        return {
          kind,
          point: pointOf(host, at),
          index: command.index,
          stop: command.stop !== 0,
        };
      }
      case 4:
        return { kind };
      case 5: {
        const command = g.s_flag_command.read(host, at, "big");
        return { kind, which: command.which, value: command.value };
      }
      case 6: {
        const command = g.s_temperament_command.read(host, at, "big");
        return {
          kind,
          temperament: command.temperament,
          add: command.add !== 0,
        };
      }
      case 7: {
        const command = g.s_set_channel_command.read(host, at, "big");
        return { kind, channel: command.channel >>> 0, values: command.values };
      }
      case 8: {
        const command = g.s_face_command.read(host, at, "big");
        return { kind, point: pointOf(host, at), index: command.index };
      }
      case 9: {
        const command = g.s_ability_command.read(host, at, "big");
        const point = rowReference(host, at + 8);
        return {
          kind,
          name: command.name >>> 0,
          argument: command.argument >>> 0,
          ...(point ? { point } : {}),
          slot: command.slot,
          index: command.index,
        };
      }
      default:
        return;
    }
  }

  // The condition that ends a command, by its wire kind.
  function readEndCondition(
    host: Buffer,
    kind: number,
    at: number
  ): CommandScriptEndCondition | undefined {
    const { g } = packages();
    switch (kind) {
      case 0:
      case 1:
        return { kind };
      case 2:
        return {
          kind,
          seconds: g.s_timed_end_condition.read(host, at, "big").seconds,
        };
      default:
        return;
    }
  }

  function atomsOf(host: Buffer, definition: number): CommandScriptAtom[] {
    const { g } = packages();
    const atoms: CommandScriptAtom[] = [];
    for (const atom of g.read_command_script(host, definition)) {
      const command = readCommand(host, atom.command_kind, atom.command_offset);
      const end = readEndCondition(
        host,
        atom.condition_kind,
        atom.condition_offset
      );
      if (command && end) {
        atoms.push({ ...command, end });
      }
    }
    return atoms;
  }

  return {
    commandScripts(tag) {
      const known = byTag.get(tag);
      if (known) {
        return known;
      }
      const { g, set } = packages();
      const bundle = g.read_definition(set.read_tag(tag), g.s_activity_bundle);
      const lookupTag: number | undefined = bundle.lookups[0]?.tag;
      const lookup =
        lookupTag === undefined
          ? undefined
          : g.read_definition(set.read_tag(lookupTag), g.s_activity_lookup);
      const entryOf = new Map<number, any>(
        (lookup?.rows ?? []).map((entry: any) => [entry.name_hash, entry])
      );
      const scripts: ControlPointCommandScript[] = [];
      bundle.rows.forEach((row: any, typeIndex: number) => {
        const entry = entryOf.get(row.name_hash);
        if (row.type !== itemType.ControlPoint || !entry) {
          return;
        }
        const host: Buffer = set.read_tag(entry.host_tag);
        const { definition } = g.read_definition(
          host,
          g.s_sensor_host_instance,
          entry.record_offset
        );
        // The definition can sit in another tag than its instance.
        const holder: Buffer =
          definition.tag >>> 0 === entry.host_tag >>> 0
            ? host
            : set.read_tag(definition.tag);
        scripts.push({
          atoms: atomsOf(holder, definition.offset),
          bundle: bundle.bundle >>> 0,
          typeIndex,
        });
      });
      byTag.set(tag, scripts);
      return scripts;
    },
  };
}
