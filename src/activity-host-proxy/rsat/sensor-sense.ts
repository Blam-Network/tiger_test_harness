// The client's SensorSenseUpdate (class 6): the update's rows, led by a byte
// in some builds. venus_portal_1's first update on the live build is 0x80,
// then initial 0, checksums 0, and 16 rows of portal_common's players[0..15]
// (1 + 54-bit ref + 1 + the 222-bit player sense + 32-bit sequence each).
//
// A row's sense body is not length-prefixed, so each one is decoded with the
// sense schema its sensor definition names (src/content); a row whose schema
// has no decoder, or a kind-34 component list with entries, ends the walk
// (truncated).

import { BitReader } from "@blamnetwork/rsat";
import { activityBundleItemType } from "../../content/row-types";
import { activityHostBuild } from "../versions";
import type { ReportedPlayerState } from "./sensor-auth-fields";

export interface SenseRow {
  bundle: number;
  sense?: unknown;
  sequence: number;
  typeId: number;
  typeIndex: number;
}

interface SensePeek {
  initial: boolean;
  rows: SenseRow[];
  truncated: boolean;
}

// A Player row's report of its own state, which the host adopts as the row's
// authority.
export interface SenseReport {
  // The client says its player is dead.
  dead: boolean;
  state: ReportedPlayerState;
  // The sense's second member, adopted the same way.
  state2?: ReportedPlayerState;
}

const MAX_ROWS = 512;

// A row whose sense schema has no decoder.
const NO_DECODER = new Error("no sense decoder");

// The client ref's width on the wire: the bundle, a 6-bit type and a 16-bit
// index.
const CLIENT_REF_BITS = 54;
// A row header: the next-row bit and the bundle.
const ROW_HEADER_BITS = 33;

function readBits(payload: Buffer, bit: number, count: number): number {
  let value = 0;
  for (let i = 0; i < count; i++) {
    const at = bit + i;
    const byte = payload[at >> 3] ?? 0;
    value = value * 2 + ((byte >> (7 - (at & 7))) & 1);
  }
  return value >>> 0;
}

// The next bit offset at or after `from` where "1 + bundle" (a row header)
// starts, or -1. A body's bits never repeat a header at 33 aligned bits by
// accident.
function findRowHeader(payload: Buffer, from: number, bundle: number): number {
  const last = payload.length * 8 - ROW_HEADER_BITS - 22;
  for (let bit = from; bit <= last; bit++) {
    if (
      readBits(payload, bit, 1) === 1 &&
      readBits(payload, bit + 1, 32) === bundle
    ) {
      return bit;
    }
  }
  return -1;
}

function readerAt(payload: Buffer, bit: number): BitReader {
  const br = new BitReader(payload);
  for (let i = 0; i < bit; i++) {
    br.readBit();
  }
  return br;
}

// `senseSchema` names a row's sense schema (bundle, type, index).
export function peekSensorSenseUpdate(
  payload: Buffer,
  senseSchema: (
    bundle: number,
    typeId: number,
    typeIndex: number
  ) => number | undefined
): SensePeek {
  const rows: SenseRow[] = [];
  if (payload.length < 1) {
    return { initial: false, rows, truncated: false };
  }
  const { decoders, leadsWithByte, readClientRef, resyncs } =
    activityHostBuild().sensor.sense;
  let br = new BitReader(payload);
  if (leadsWithByte) {
    br.readNumber(8);
  }
  const initial = br.readBit() === 1;
  br.readBit();
  let truncated = false;
  while (rows.length < MAX_ROWS) {
    const rowStart = br.bitPos;
    let row: SenseRow | undefined;
    try {
      if (br.readBit() !== 1) {
        break;
      }
      const ref = readClientRef(br);
      row = {
        bundle: ref.bundle >>> 0,
        sequence: 0,
        typeId: ref.typeId,
        typeIndex: ref.typeIndex,
      };
      if (br.readBit() === 1) {
        const schema = senseSchema(row.bundle, row.typeId, row.typeIndex);
        const decoder = schema === undefined ? undefined : decoders.get(schema);
        if (!decoder) {
          throw NO_DECODER;
        }
        row.sense = decoder.decode(br);
      }
      row.sequence = br.readNumber(32) >>> 0;
      rows.push(row);
    } catch (error) {
      truncated = true;
      if (row && (resyncs || error === NO_DECODER)) {
        rows.push(row);
      }
      // A body that can't be read ends the walk, unless the build's rows can be
      // found again: then it resumes at the next row header after this row's
      // ref.
      if (!(resyncs && row)) {
        break;
      }
      const next = findRowHeader(
        payload,
        rowStart + 1 + CLIENT_REF_BITS,
        row.bundle
      );
      if (next < 0) {
        break;
      }
      br = readerAt(payload, next);
    }
  }
  return { initial, rows, truncated };
}

interface MonitorCount {
  bundle: number;
  count: number;
  typeIndex: number;
}

export function playerMonitorCounts(peek: SensePeek): MonitorCount[] {
  return peek.rows.flatMap((row) => {
    if (row.typeId !== activityBundleItemType().PlayerMonitor || !row.sense) {
      return [];
    }
    return [
      {
        bundle: row.bundle,
        count: activityHostBuild().sensor.sense.monitorCount(row.sense),
        typeIndex: row.typeIndex,
      },
    ];
  });
}

interface SquadAlive {
  alive: number;
  bundle: number;
  typeIndex: number;
}

// Squad sense: members at their firing area, not a live count (a squad
// killed on the way in never reports it above 0). Absent in an update means
// unchanged, so only rows that carry it are reported.
export function squadAliveCounts(peek: SensePeek): SquadAlive[] {
  return peek.rows.flatMap((row) => {
    if (row.typeId !== activityBundleItemType().Squad || !row.sense) {
      return [];
    }
    const alive = activityHostBuild().sensor.sense.squadAlive(row.sense);
    return alive === undefined
      ? []
      : [{ alive, bundle: row.bundle, typeIndex: row.typeIndex }];
  });
}

interface SquadTally {
  bundle: number;
  tally: number[];
  typeIndex: number;
}

// Squad sense: the per-cell death tally of the squad's current epoch, one
// cell per roster slot. The client sends it with its first sense of the row
// ([0, 0] for a two-body squad) and bumps a cell as that body dies (2.3.1
// capture, sq_m0_fallen_2). Roster minus tally is alive_count()'s primary
// source in the script host; the alive count alone stalls when the Fallen
// die before reaching their firing area.
export function squadTallies(peek: SensePeek): SquadTally[] {
  return peek.rows.flatMap((row) => {
    if (row.typeId !== activityBundleItemType().Squad || !row.sense) {
      return [];
    }
    const tally = activityHostBuild().sensor.sense.squadTally(row.sense);
    return tally === undefined
      ? []
      : [{ bundle: row.bundle, tally, typeIndex: row.typeIndex }];
  });
}

interface ActorBoundFlags {
  bundle: number;
  // ActorSense [9] is the "spent" edge - true once a named member has died,
  // failed or been destroyed since its epoch (2.3.1 capture: [10] flips as
  // the Walker dies, cosmo_portal_1) - and [10] is true from the spawn.
  typeIndex: number;
  unknown9: boolean;
  unknown10: boolean;
}

// A named member's own death is not in its squad's tally (the tally counts the
// anonymous cells), so a squad of named members reads alive until this edge
// says otherwise: the Devils' Lair's Walker and Sepiks.
export function actorBoundFlags(peek: SensePeek): ActorBoundFlags[] {
  return peek.rows.flatMap((row) => {
    if (row.typeId !== activityBundleItemType().Actor || !row.sense) {
      return [];
    }
    return [
      {
        bundle: row.bundle,
        typeIndex: row.typeIndex,
        ...activityHostBuild().sensor.sense.actorBound(row.sense),
      },
    ];
  });
}

interface ActorDropAck {
  bundle: number;
  // Absent when the update did not carry it: the last drop id stands.
  dropId?: number;
  inProgress: boolean;
  typeIndex: number;
}

// The drop an Actor row has taken: the id the client has kicked off, and
// whether it is still under way ("drop #N complete" clears it).
export function actorDropAcks(peek: SensePeek): ActorDropAck[] {
  const { sense } = activityHostBuild().sensor;
  return peek.rows.flatMap((row) => {
    const drop =
      row.typeId === activityBundleItemType().Actor && row.sense
        ? sense.actorDrop?.(row.sense)
        : undefined;
    return drop
      ? [{ bundle: row.bundle, typeIndex: row.typeIndex, ...drop }]
      : [];
  });
}

interface ActorStanding {
  bundle: number;
  epoch?: number;
  standing: boolean;
  typeIndex: number;
}

// Whether an Actor row's combatant has an actor under the epoch it took.
export function actorStandings(peek: SensePeek): ActorStanding[] {
  const { sense } = activityHostBuild().sensor;
  return peek.rows.flatMap((row) => {
    const standing =
      row.typeId === activityBundleItemType().Actor && row.sense
        ? sense.actorStanding?.(row.sense)
        : undefined;
    return standing
      ? [{ bundle: row.bundle, typeIndex: row.typeIndex, ...standing }]
      : [];
  });
}

interface ActorCommandScriptProgress {
  bundle: number;
  cookieRunning?: number;
  heartbeat?: number;
  pcReached?: number;
  typeIndex: number;
}

// The command script an Actor row runs, as far as the client has got.
export function actorCommandScriptProgress(
  peek: SensePeek
): ActorCommandScriptProgress[] {
  const { sense } = activityHostBuild().sensor;
  return peek.rows.flatMap((row) => {
    const progress =
      row.typeId === activityBundleItemType().Actor && row.sense
        ? sense.actorCommandScript?.(row.sense)
        : undefined;
    return progress
      ? [{ bundle: row.bundle, typeIndex: row.typeIndex, ...progress }]
      : [];
  });
}

interface InteractableUse {
  bundle: number;
  typeIndex: number;
  used: boolean;
  usedStamp: number;
}

// The mission-interactable latch of an Object row. The client raises its
// interaction incident too, but the latch is state, so a use still reaches
// the host if that incident is missed.
export function interactableUses(peek: SensePeek): InteractableUse[] {
  const { sense } = activityHostBuild().sensor;
  return peek.rows.flatMap((row) => {
    const latch =
      row.typeId === activityBundleItemType().Object && row.sense
        ? sense.interactable?.(row.sense)
        : undefined;
    return latch
      ? [{ bundle: row.bundle, typeIndex: row.typeIndex, ...latch }]
      : [];
  });
}

interface ObjectDeviceReport {
  bundle: number;
  position: number;
  positionStamp: number;
  typeIndex: number;
}

// The device of an Object row as the client holds it, for the rows whose
// sense carries one.
export function objectDeviceReports(peek: SensePeek): ObjectDeviceReport[] {
  const { sense } = activityHostBuild().sensor;
  return peek.rows.flatMap((row) => {
    const device =
      row.typeId === activityBundleItemType().Object && row.sense
        ? sense.objectDevice?.(row.sense)
        : undefined;
    return device
      ? [{ bundle: row.bundle, typeIndex: row.typeIndex, ...device }]
      : [];
  });
}

interface ObjectAlive {
  alive: boolean;
  bundle: number;
  typeIndex: number;
}

export function objectAliveFlags(peek: SensePeek): ObjectAlive[] {
  const { sense } = activityHostBuild().sensor;
  return peek.rows.flatMap((row) => {
    if (row.typeId !== activityBundleItemType().Object || !row.sense) {
      return [];
    }
    const alive = sense.objectAlive?.(row.sense);
    return alive === undefined
      ? []
      : [{ alive, bundle: row.bundle, typeIndex: row.typeIndex }];
  });
}

interface HealthFraction {
  bundle: number;
  current: number;
  max: number;
  typeIndex: number;
}

// A Health row's current and maximum, -1 for both while its ref is unresolved.
export function healthFractions(peek: SensePeek): HealthFraction[] {
  const { sense } = activityHostBuild().sensor;
  return peek.rows.flatMap((row) => {
    const health =
      row.typeId === activityBundleItemType().Health && row.sense
        ? sense.health?.(row.sense)
        : undefined;
    return health
      ? [{ bundle: row.bundle, typeIndex: row.typeIndex, ...health }]
      : [];
  });
}
