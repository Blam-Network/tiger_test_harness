// Client schemas, from the eboot's schema registry (scripts/rsat-descriptors.py
// dumps it): record address, PS4 size and checksum. Unnamed fields are
// unknownN, their member index in the record.

import { type RsatField, type RsatSchema, rsat } from "@blamnetwork/rsat";

// kind 11 real32 quantized: p0 min, p1 max, p2 bits. Decode returns the
// interval's lower edge; 0 and 2^bits-1 are exactly min and max.
function f32q(min: number, max: number, bits: number): RsatField<number> {
  const steps = 2 ** bits;
  const step = (max - min) / (steps - 2);
  return {
    encode(bw, value) {
      let q = Math.min(
        Math.max(Math.floor((value - min) / step) + 1, 1),
        steps - 2
      );
      if (value <= min) {
        q = 0;
      } else if (value >= max) {
        q = steps - 1;
      }
      bw.write(q, bits);
    },
    decode(br) {
      const q = br.readNumber(bits);
      if (q === 0) {
        return min;
      }
      return q === steps - 1 ? max : min + (q - 1) * step;
    },
  };
}

// A member kind whose wire form is not verified (13 point, 24 object handle,
// 33/34, 37). Only reachable through arrays and optionals the server sends
// empty or absent.
function opaqueKind(kind: number): RsatField<never> {
  return {
    encode() {
      throw new Error(`kind ${kind} member is not encodable`);
    },
    decode() {
      throw new Error(`kind ${kind} member is not decodable`);
    },
  };
}

// A component of an Object's vec, in the class its handle names.
interface ObjectComponentValue {
  schema: number;
  value: Record<string, unknown>;
}

// A kind-34 member (decoder 0x157D1B0): its 80800046 header, a kind-23 present
// bit and the 32-bit class handle, then the body in that class's schema. A
// body's length is only known from its schema, so an unlisted class throws.
function objectComponent(
  classes: readonly RsatSchema<Record<string, unknown>>[]
): RsatField<ObjectComponentValue | undefined> {
  const byHandle = new Map(classes.map((c) => [c.hash >>> 0, c]));
  const schemaOf = (handle: number) => {
    const schema = byHandle.get(handle >>> 0);
    if (!schema) {
      throw new Error(`object component 0x${handle.toString(16)} not listed`);
    }
    return schema;
  };
  return {
    encode(bw, component) {
      bw.writeBit(component ? 1 : 0);
      if (component) {
        bw.write(component.schema >>> 0, 32);
        schemaOf(component.schema).encode(bw, component.value);
      }
    },
    decode(br) {
      if (!br.readBit()) {
        return;
      }
      const schema = br.readNumber(32) >>> 0;
      return { schema, value: schemaOf(schema).decode(br) };
    },
  };
}

// Schemas register by id when this runs, so only the build's loader calls it.
export function defineAhSchemas() {
  // 8080405E @0x19c2468, size 0x8
  const MachineId = rsat.schema(0x8080405e, {
    bytes: rsat.repeat(rsat.u8(), 8),
  });

  // 80804008 @0x18d3a38, size 0x80
  const SessionDisplayChars = rsat.schema(0x80804008, {
    chars: rsat.repeat(rsat.i8(), 128),
  });

  // 80804056 @0x19223b0, size 0x80
  const SessionDisplay = rsat.schema(0x80804056, {
    text: rsat.nested(SessionDisplayChars),
  });

  // 80800C2D @0x18907e0, size 0x28
  const JoinIdentity = rsat.schema(0x80800c2d, {
    machine: rsat.nested(MachineId),
    player: rsat.nested(MachineId),
    account: rsat.u64(),
    character: rsat.u64(),
    unknown4: rsat.u64(),
  });

  // 80800B1F @0x188aa10, size 0xb8
  const JoinRequestAuth = rsat.schema(0x80800b1f, {
    unknown0: rsat.optional(rsat.u8({ size: 4, bias: 0 })),
    displayName: rsat.optional(rsat.nested(SessionDisplay)),
    unknown2: rsat.optional(rsat.u64()),
    unknown3: rsat.optional(rsat.u64()),
    unknown4: rsat.optional(rsat.u64()),
    unknown5: rsat.optional(rsat.u64()),
    unknown6: rsat.optional(rsat.i32()),
    unknown7: rsat.optional(rsat.i32()),
    machine: rsat.optional(rsat.nested(MachineId)),
  });

  // 80800E98 @0x19092e0, size 0xf8
  const JoinRequest = rsat.schema(0x80800e98, {
    nonce: rsat.u32(),
    sessionId: rsat.u64(),
    identity: rsat.nested(JoinIdentity),
    auth: rsat.nested(JoinRequestAuth),
    unknown4: rsat.bool(),
    unknown5: rsat.u16(),
  });

  // 80800A58 @0x18933b0, size 0x198
  const JoinResult = rsat.schema(0x80800a58, {
    request: rsat.nested(JoinRequest),
    result: rsat.i8({ size: 3, bias: 1 }),
    sessionDisplay: rsat.nested(SessionDisplay),
    replicationEpoch: rsat.u32(),
    unk4: rsat.i32(),
    unk5: rsat.u32(),
    activityTime: rsat.i32(),
    flag: rsat.u8(),
    unknown8: rsat.u16(),
    unknown9: rsat.u16(),
    unknown10: rsat.u32(),
  });

  // 80804050 @0x1994f78, size 0x40
  const BubbleStates = rsat.schema(0x80804050, {
    states: rsat.repeat(rsat.i8(), 64),
  });

  // 808043A6 @0x19d3e58, size 0x28
  const ActivityNameChars = rsat.schema(0x808043a6, {
    chars: rsat.repeat(rsat.i8(), 40),
  });

  // 8080409F @0x1997390, size 0x28
  const ActivityName = rsat.schema(0x8080409f, {
    text: rsat.nested(ActivityNameChars),
  });

  // 80800D17 @0x19193c8, size 0x30
  const Unknown80800D17 = rsat.schema(0x80800d17, {
    unknown0: rsat.u32(),
    unknown1: opaqueKind(34),
  });

  // 8080533D @0x1869690, size 0x970
  const WorldHandles = rsat.schema(0x8080533d, {
    handles: rsat.array(rsat.nested(Unknown80800D17), {
      lengthBits: 6,
      max: 50,
    }),
  });

  // 80800CC5 @0x18ce7a0, size 0x9c0
  const WorldOptions = rsat.schema(0x80800cc5, {
    valid: rsat.bool(),
    handles: rsat.nested(WorldHandles),
    unk2: rsat.u32(),
    unknown3: rsat.bool(),
    worldServerTime: rsat.u64(),
    activityId: rsat.i16(),
    unknown6: rsat.i16(),
    activityName: rsat.nested(ActivityName),
  });

  // 80800B8F @0x1975808, size 0xa20
  const GlobalActivityStateBody = rsat.schema(0x80800b8f, {
    valid: rsat.bool(),
    scenario: rsat.bool(),
    draining: rsat.bool(),
    instanceId: rsat.u64(),
    bubbleCount: rsat.i32(),
    bubbleStates: rsat.nested(BubbleStates),
    initialSlice: rsat.i32(),
    spawnTransitionName: rsat.u32(),
    activityChecksum: rsat.u32(),
    world: rsat.nested(WorldOptions),
  });

  // 80800E76 @0x189cad0, size 0xa20
  const GlobalActivityState = rsat.schema(0x80800e76, {
    state: rsat.nested(GlobalActivityStateBody),
  });

  // 80800D68 @0x1996128, size 0x8
  const Unknown80800D68 = rsat.schema(0x80800d68, {
    unknown0: rsat.bool(),
    unknown1: rsat.f32(),
  });

  // 80800DC1 @0x1866fa0, size 0x8
  const WorldGlobalsState = rsat.schema(0x80800dc1, {
    unknown0: rsat.nested(Unknown80800D68),
  });

  // 808043BC @0x18774c0, size 0x84
  const Unknown808043BC = rsat.schema(0x808043bc, {
    unknown0: rsat.array(rsat.u8(), { lengthBits: 8, max: 128 }),
  });

  // 80800B18 @0x19029e0, size 0x90
  const Unknown80800B18 = rsat.schema(0x80800b18, {
    unknown0: rsat.u8(),
    unknown1: rsat.i8({ size: 2, bias: 1 }),
    unknown2: rsat.nested(Unknown808043BC),
    unknown3: rsat.u64(),
  });

  // 80800D82 @0x1881460, size 0xa0
  const Unknown80800D82 = rsat.schema(0x80800d82, {
    unknown0: rsat.i32(),
    unknown1: rsat.u32(),
    unknown2: rsat.i32(),
    unknown3: rsat.i8({ size: 2, bias: 1 }),
    unknown4: rsat.i8({ size: 2, bias: 1 }),
    unknown5: rsat.optional(rsat.u8()),
    unknown6: rsat.optional(rsat.nested(Unknown80800B18)),
  });

  // 80800D9F @0x1884050, size 0x148
  const Unknown80800D9F = rsat.schema(0x80800d9f, {
    unknown0: rsat.optional(rsat.nested(Unknown80800D82)),
    unknown1: rsat.optional(rsat.nested(Unknown80800D82)),
    unknown2: rsat.optional(rsat.u8()),
    unknown3: rsat.optional(rsat.u8()),
    unknown4: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
  });

  // 80800C21 @0x189c210, size 0x8
  const Unknown80800C21 = rsat.schema(0x80800c21, {
    unknown0: rsat.i8({ size: 3, bias: 1 }),
    unknown1: rsat.u8(),
    unknown2: rsat.i32(),
  });

  // 80800E0A @0x187b9e0, size 0xc
  const Unknown80800E0A = rsat.schema(0x80800e0a, {
    unknown0: rsat.u8(),
    unknown1: rsat.i32(),
    unknown2: rsat.u32(),
  });

  // 80800D9E @0x18a0a10, size 0x14
  const Unknown80800D9E = rsat.schema(0x80800d9e, {
    unknown0: rsat.i8({ size: 3, bias: 1 }),
    unknown1: rsat.nested(Unknown80800E0A),
    unknown2: rsat.i32(),
  });

  // 80800C56 @0x19c1ea8, size 0x220
  const ClientAuthoritativeData = rsat.schema(0x80800c56, {
    identity: rsat.optional(rsat.nested(JoinRequestAuth)),
    transition: rsat.optional(rsat.nested(Unknown80800D9F)),
    hardWipe: rsat.optional(rsat.nested(Unknown80800C21)),
    teleport: rsat.optional(rsat.nested(Unknown80800D9E)),
  });

  // 80800A39 @0x18b35d0, size 0x250
  const MembershipSlot = rsat.schema(0x80800a39, {
    identity: rsat.optional(rsat.nested(JoinIdentity)),
    auth: rsat.optional(rsat.nested(ClientAuthoritativeData)),
    unknown2: rsat.optional(rsat.i8({ size: 4, bias: 1 })),
  });

  // 808052FE @0x191c458, size 0x2e40
  const Unknown808052FE = rsat.schema(0x808052fe, {
    unknown0: rsat.repeat(rsat.nested(MembershipSlot), 20),
  });

  // 80800E4A @0x19a1990, size 0x18
  const Unknown80800E4A = rsat.schema(0x80800e4a, {
    unknown0: rsat.u8(),
    unknown1: rsat.i8({ size: 2, bias: 1 }),
    unknown2: rsat.i8({ size: 5, bias: 1 }),
    unknown3: rsat.bool(),
  });

  // 80805491 @0x19f7778, size 0x14
  const Unknown80805491 = rsat.schema(0x80805491, {
    unknown0: rsat.repeat(rsat.u8(), 20),
  });

  // 80800C9F @0x18ae970, size 0xb0
  const Unknown80800C9F = rsat.schema(0x80800c9f, {
    unknown0: rsat.u8(),
    unknown1: rsat.u32({ size: 20, bias: 0 }),
    unknown2: rsat.nested(Unknown80805491),
    unknown3: rsat.nested(Unknown808043BC),
    unknown4: rsat.u64(),
  });

  // 80800C6F @0x1889b30, size 0xd8
  const Unknown80800C6F = rsat.schema(0x80800c6f, {
    unknown0: rsat.i32(),
    unknown1: rsat.i8({ size: 2, bias: 1 }),
    unknown2: rsat.nested(Unknown80800E4A),
    unknown3: rsat.u32({ size: 20, bias: 0 }),
    unknown4: rsat.nested(Unknown80800C9F),
  });

  // 808051FE @0x1974d98, size 0x21c0
  const Unknown808051FE = rsat.schema(0x808051fe, {
    unknown0: rsat.repeat(rsat.nested(Unknown80800C6F), 40),
  });

  // 80800C93 @0x189af60, size 0x8
  const Unknown80800C93 = rsat.schema(0x80800c93, {
    unknown0: rsat.u8(),
    unknown1: rsat.i8({ size: 3, bias: 1 }),
    unknown2: rsat.i32(),
  });

  // 80800BF9 @0x19aa160, size 0x10
  const Unknown80800BF9 = rsat.schema(0x80800bf9, {
    unknown0: rsat.i8({ size: 3, bias: 1 }),
    unknown1: rsat.nested(Unknown80800E0A),
  });

  // 80800BD7 @0x1a02408, size 0x21e0
  const Unknown80800BD7 = rsat.schema(0x80800bd7, {
    unknown0: rsat.nested(Unknown808051FE),
    unknown1: rsat.nested(Unknown80800C93),
    unknown2: rsat.nested(Unknown80800BF9),
    unknown3: rsat.optional(rsat.nested(MachineId)),
  });

  // 808009ED @0x189a100, size 0x5038
  const ReplicateMembership = rsat.schema(0x808009ed, {
    generation: rsat.u32(),
    unk: rsat.u32(),
    clients: rsat.nested(Unknown808052FE),
    pahRegions: rsat.optional(rsat.nested(Unknown80800BD7)),
    unknown4: rsat.optional(rsat.u32({ size: 20, bias: 0 })),
    unknown5: rsat.optional(rsat.u32({ size: 20, bias: 0 })),
    unknown6: rsat.optional(rsat.u32({ size: 20, bias: 0 })),
  });

  // 80800B83 @0x18b6bf0, size 0xc
  const AuthoritySlot = rsat.schema(0x80800b83, {
    machine: rsat.optional(rsat.nested(MachineId)),
    sequence: rsat.optional(rsat.u16()),
    unknown2: rsat.bool(),
  });

  // 8080540E @0x18939a0, size 0x30c
  const Unknown8080540E = rsat.schema(0x8080540e, {
    unknown0: rsat.repeat(rsat.nested(AuthoritySlot), 65),
  });

  // 80800CF7 @0x19f1fc0, size 0x310
  const AuthorityTable = rsat.schema(0x80800cf7, {
    unknown0: rsat.optional(rsat.i32()),
    slots: rsat.nested(Unknown8080540E),
  });

  // 808004B1 @0x1898760, size 0x8
  const SensorClientRef = rsat.schema(0x808004b1, {
    bundle: rsat.u32(),
    typeId: rsat.i8({ size: 6, bias: 1 }),
    typeIndex: rsat.i16(),
  });

  // 808008A3 @0x18a3830, size 0x9a0
  const LifetimeAuth = rsat.schema(0x808008a3, {
    state: rsat.i8({ size: 4, bias: 1 }),
    flag1: rsat.bool(),
    phaseIndex: rsat.i32(),
    phaseHash: rsat.u32(),
    field4: rsat.i32(),
    optionOverrides: rsat.nested(WorldHandles),
    unknown6: rsat.i32(),
    unknown7: rsat.i32(),
    unknown8: rsat.u32(),
    timeOfDayLocked: rsat.bool(),
    timeOfDay: rsat.f32(),
  });

  // 8080419A @0x1892dd0, size 0x24
  const PlayerFlags = rsat.schema(0x8080419a, {
    flags: rsat.array(rsat.u32(), { lengthBits: 4, max: 8 }),
  });

  // 80800646 @0x19885e0, size 0x30
  const PlayerIdentity = rsat.schema(0x80800646, {
    key: rsat.u64(),
    unknown1: rsat.u8(),
    faction: rsat.i8({ size: 6, bias: 3 }),
    activityFlags: rsat.nested(PlayerFlags),
  });

  // 80800540 @0x1890940, size 0x10
  const Unknown80800540 = rsat.schema(0x80800540, {
    unknown0: rsat.i32(),
    unknown1: rsat.u32(),
    unknown2: rsat.bool(),
    unknown3: rsat.bool(),
    unknown4: rsat.bool(),
    unknown5: rsat.i8({ size: 3, bias: 1 }),
    unknown6: rsat.i8({ size: 2, bias: 1 }),
  });

  // 80802619 @0x192a2b8, size 0x8
  const Unknown80802619 = rsat.schema(0x80802619, {
    unknown0: rsat.f32(),
    unknown1: rsat.bool(),
    unknown2: rsat.bool(),
    unknown3: rsat.bool(),
  });

  // 808022A5 @0x188d2c0, size 0x50
  const PlayerAuth = rsat.schema(0x808022a5, {
    unknown0: rsat.nested(Unknown80800540),
    unknown1: rsat.nested(Unknown80802619),
    identity: rsat.nested(PlayerIdentity),
    flag: rsat.bool(),
    unknown4: rsat.i32(),
  });

  // 808044CC @0x189b680, size 0x1c
  const TemperamentList = rsat.schema(0x808044cc, {
    tags: rsat.array(rsat.u32(), { lengthBits: 3, max: 6 }),
  });

  // 80804252 @0x1876ed0, size 0x24: one i32 per squad cell, the squad
  // auth's roster and the squad sense's tally
  const SquadCells = rsat.schema(0x80804252, {
    cells: rsat.array(rsat.i32(), { lengthBits: 4, max: 8 }),
  });

  // 8080071E @0x18b9110, size 0x70
  const SquadAuth = rsat.schema(0x8080071e, {
    ref0: rsat.optional(rsat.nested(SensorClientRef)),
    ref1: rsat.optional(rsat.nested(SensorClientRef)),
    temperaments: rsat.optional(rsat.nested(TemperamentList)),
    roster: rsat.optional(rsat.nested(SquadCells)),
    unknown4: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
    epoch: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown6: rsat.optional(rsat.u32()),
    bindingGeneration: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown8: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    // Never read by the squad. A retail capture sends the task's +0xC here
    // ([12] there).
    unknown9: rsat.optional(rsat.i32({ size: 6, bias: 1 })),
    // The index of ref0's task the squad is linked under; -1 for none.
    task: rsat.optional(rsat.i32({ size: 5, bias: 1 })),
    killPolicy: rsat.i8({ size: 2, bias: 1 }),
    carrierCargo: rsat.i8({ size: 3, bias: 1 }),
  });

  // 808040B9, size 0x18: an Objective's slots, one optional 7-bit state per
  // task.
  const ObjectiveSlots = rsat.schema(0x808040b9, {
    slots: rsat.optionsArray(rsat.i8({ size: 7, bias: 0 }), 24),
  });

  // 808004FA, size 0x1c: the Objective auth. [1] is the reset generation
  // reset() bumps (true name unknown).
  const ObjectiveAuth = rsat.schema(0x808004fa, {
    slots: rsat.optional(rsat.nested(ObjectiveSlots)),
    resetGeneration: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  });

  // 8080433C @0x19a5748, size 0x10
  const Unknown8080433C = rsat.schema(0x8080433c, {
    unknown0: rsat.repeat(rsat.f32(), 4),
  });

  // 8080078E @0x199b780, size 0x14
  const Unknown8080078E = rsat.schema(0x8080078e, {
    unknown0: rsat.u32(),
    unknown1: rsat.nested(Unknown8080433C),
  });

  // 808040E5 @0x187a240, size 0x54
  const Unknown808040E5 = rsat.schema(0x808040e5, {
    unknown0: rsat.array(rsat.nested(Unknown8080078E), {
      lengthBits: 3,
      max: 4,
    }),
  });

  // 80800836 @0x18ac840, size 0x84
  const Unknown80800836 = rsat.schema(0x80800836, {
    unknown0: rsat.i32({ size: 31, bias: 0 }),
    unknown1: rsat.u8({ size: 4, bias: 0 }),
    unknown2: rsat.u8({ size: 4, bias: 0 }),
    unknown3: rsat.nested(TemperamentList),
    unknown4: rsat.nested(SensorClientRef),
    unknown5: rsat.i32({ bias: 1 }),
    unknown6: rsat.nested(Unknown808040E5),
  });

  // 80804370 @0x189fec0, size 0x808
  const Unknown80804370 = rsat.schema(0x80804370, {
    unknown0: rsat.array(rsat.optional(opaqueKind(38)), {
      lengthBits: 6,
      max: 32,
    }),
  });

  // 80800512 @0x1869940, size 0x810
  const Unknown80800512 = rsat.schema(0x80800512, {
    unknown0: rsat.i32({ size: 31, bias: 0 }),
    unknown1: rsat.i32({ size: 6, bias: 0 }),
    unknown2: rsat.nested(Unknown80804370),
  });

  // 80804256 @0x1897870, size 0x44
  const Unknown80804256 = rsat.schema(0x80804256, {
    unknown0: rsat.array(rsat.nested(SensorClientRef), {
      lengthBits: 4,
      max: 8,
    }),
  });

  // 808007A9 @0x1a00ff0, size 0x48
  const Unknown808007A9 = rsat.schema(0x808007a9, {
    unknown0: rsat.nested(Unknown80804256),
    unknown1: rsat.i32({ size: 31, bias: 0 }),
  });

  // 80800868 @0x1897300, size 0x8e8
  const ActorAuth = rsat.schema(0x80800868, {
    killEpoch: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    killed: rsat.i8({ size: 2, bias: 1 }),
    carried: rsat.i8({ size: 3, bias: 1 }),
    place: rsat.bool(),
    behaviour: rsat.optional(rsat.nested(Unknown80800836)),
    script: rsat.optional(rsat.nested(Unknown80800512)),
    drop: rsat.optional(rsat.nested(Unknown808007A9)),
  });

  // 80800463 @0x1909d18, size 0x8
  const PlayerTriggerAuth = rsat.schema(0x80800463, {
    enabled: rsat.bool(),
    armStamp: rsat.i32(),
  });

  // 808006EB @0x193ca38, size 0xc
  const PlayerMonitorAuth = rsat.schema(0x808006eb, {
    filter: rsat.nested(SensorClientRef),
    unknown1: rsat.i32(),
  });

  // 80802213 @0x19c76e8, size 0xc: the Passenger auth (type 37,
  // skiff_passenger, dropship_passenger): the cookie, then the row it seats.
  const PassengerAuth = rsat.schema(0x80802213, {
    cookie: rsat.i32({ size: 31, bias: 0 }),
    binding: rsat.nested(SensorClientRef),
  });

  // 808005C3 @0x19db1c0, size 0xc
  const PlayerMonitorSense = rsat.schema(0x808005c3, {
    any: rsat.bool(),
    all: rsat.bool(),
    count: rsat.i32(),
    unknown3: rsat.i32(),
  });

  // 80802986 @0x195cab0, size 0x8
  const SequenceVariable = rsat.schema(0x80802986, {
    name: rsat.u32(),
    value: rsat.u32(),
  });

  // 80805B11 @0x18af620, size 0x1c
  const SequenceVariables = rsat.schema(0x80805b11, {
    pairs: rsat.array(rsat.nested(SequenceVariable), {
      lengthBits: 2,
      max: 3,
    }),
  });

  // 808029A1 @0x1901ec0, size 0x2c
  const SequenceAuth = rsat.schema(0x808029a1, {
    startTick: rsat.i32(),
    playingId: rsat.u8(),
    variables: rsat.nested(SequenceVariables),
    viewers: rsat.nested(SensorClientRef),
  });

  // 8080038A @0x19b0a68, size 0x10
  const Unknown8080038A = rsat.schema(0x8080038a, {
    unknown0: rsat.optional(rsat.i32({ size: 6, bias: 0 })),
    unknown1: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown2: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown3: rsat.bool(),
  });

  // 808005D9 @0x18ad750, size 0x34
  const ActorSense = rsat.schema(0x808005d9, {
    unknown0: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown1: rsat.optional(f32q(0, 2048, 9)),
    unknown2: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown3: rsat.optional(rsat.nested(Unknown8080038A)),
    unknown4: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown5: rsat.i8({ size: 2, bias: 1 }),
    unknown6: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown7: rsat.optional(f32q(0, 1, 4)),
    unknown8: rsat.optional(f32q(0, 1, 4)),
    unknown9: rsat.bool(),
    unknown10: rsat.bool(),
  });

  // 8080411B @0x1980648, size 0x18
  const Unknown8080411B = rsat.schema(0x8080411b, {
    unknown0: rsat.optionsArray(rsat.i8({ size: 6, bias: 0 }), 24),
  });

  // 8080086C @0x1891b20, size 0x1a
  const Unknown8080086C = rsat.schema(0x8080086c, {
    unknown0: rsat.optional(rsat.i8({ size: 7, bias: 0 })),
    unknown1: rsat.u8({ size: 1, bias: 0 }),
    unknown2: rsat.optional(rsat.nested(Unknown8080411B)),
  });

  // 808041A4 @0x199c180, size 0x270
  const Unknown808041A4 = rsat.schema(0x808041a4, {
    unknown0: rsat.repeat(rsat.nested(Unknown8080086C), 24),
  });

  // 80800830 @0x1873740, size 0x278
  const ObjectiveSense = rsat.schema(0x80800830, {
    table: rsat.optional(rsat.nested(Unknown808041A4)),
    unknown1: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown2: rsat.optional(rsat.u32()),
  });

  // 808040E0 @0x18e1588, size 0x8
  const Unknown808040E0 = rsat.schema(0x808040e0, {
    unknown0: rsat.u32(),
    unknown1: rsat.u32(),
  });

  // 8080279A: an Object auth's device component, the element the Object
  // (808007D9 [3]) and ObjectSense component vecs carry for an object with a
  // device. Power, lock and position are each a triple {stamp, i32 of unknown
  // meaning (0 in every capture), value}. The breach lights, control and invis
  // light are {0, 0, 1.0, 0, 0, 0, 0, 0, 0} idle (powered, position 0) and
  // {.., 1, 0, 1.0} once the Ghost has lit the breach up
  // (act_cosmo_m0_highway, 7 of 7 captures).
  const ObjectDeviceComponent = rsat.schema(0x8080279a, {
    powerStamp: rsat.i32(),
    unknown1: rsat.i32(),
    power: rsat.f32(),
    lockStamp: rsat.i32(),
    unknown4: rsat.i32(),
    lock: rsat.f32(),
    positionStamp: rsat.i32(),
    unknown7: rsat.i32(),
    position: rsat.f32(),
  });

  // 8080091D: an ObjectFilter predicate naming one row. The 2-bit mode: 0 adds
  // the match, 1 removes it. In a retail capture of_ghostlight holds
  // {0, sq_nux_ghost__ghost} while the Ghost lights the breach up.
  const ObjectFilterRowPredicate = rsat.schema(0x8080091d, {
    mode: rsat.i8({ size: 2, bias: 1 }),
    item: rsat.nested(SensorClientRef),
  });

  // 808006E5 @0x193d480, size 0xc: every member of a Squad row, the row
  // predicate's squad form. In a retail capture of_ultra_servitor holds
  // {0, sq_bossbattle_boss01} while Sepiks Prime's performance shield is up.
  const ObjectFilterSquadMembersPredicate = rsat.schema(0x808006e5, {
    mode: rsat.i8({ size: 2, bias: 1 }),
    item: rsat.nested(SensorClientRef),
  });

  // 80800952 @0x18d0c80, size 0x8: the players-with-activity-flag predicate,
  // the second handler the "object filter predicates" registration installs.
  // It walks the Player slots and keeps those whose flag list holds the u32. In
  // a retail capture the cosmo_portal_1 filter for the refinery's hack console
  // is {0, 1C450A3D} from the world entry.
  const ObjectFilterActivityFlagPredicate = rsat.schema(0x80800952, {
    mode: rsat.i8({ size: 2, bias: 1 }),
    flag: rsat.u32(),
  });

  // 80802140 @0x19bddf0, size 0x14: an Object auth's mission-interactable
  // component. mode 1 = m_enabled false, usable by the players the filter
  // admits; 2 = m_enabled true, everyone (the weapon chest); 0 = keep. Then the
  // trailing stamp/bool "used" latch (true names unknown). The hack console is
  // {1, sp_placement_array._object_filter, 0, false} from its creation to the
  // end of the strike (retail capture).
  const ObjectInteractableComponent = rsat.schema(0x80802140, {
    mode: rsat.i8({ size: 2, bias: 1 }),
    filter: rsat.nested(SensorClientRef),
    usedStamp: rsat.i32(),
    used: rsat.bool(),
  });

  // 80802A74 @0x188d670, size 0x24: the device component's sense twin, the
  // client's own power, lock and position triples in the auth's layout (the
  // writer 0x9FB890 copies the stamps the auth reader keeps).
  const ObjectDeviceSense = rsat.schema(0x80802a74, {
    powerStamp: rsat.i32(),
    unknown1: rsat.i32(),
    power: rsat.f32(),
    lockStamp: rsat.i32(),
    unknown4: rsat.i32(),
    lock: rsat.f32(),
    positionStamp: rsat.i32(),
    unknown7: rsat.i32(),
    position: rsat.f32(),
  });

  // 80802021 @0x19a9448, size 0x8: the mission-interactable's sense twin,
  // the client's used latch and its stamp (0x8215A0 keeps the newer stamp).
  const ObjectInteractableSense = rsat.schema(0x80802021, {
    used: rsat.bool(),
    usedStamp: rsat.i32(),
  });

  // 80804117 @0x188a2d0, size 0xd0: an Object's component vec, up to three
  // components (80804153, kind 34 each).
  const Unknown80804117 = rsat.schema(0x80804117, {
    unknown0: rsat.array(
      objectComponent([
        ObjectDeviceComponent,
        ObjectInteractableComponent,
        ObjectDeviceSense,
        ObjectInteractableSense,
      ]),
      { lengthBits: 2, max: 3 }
    ),
  });

  // 80800387 @0x18670e0, size 0xf0
  const ObjectSense = rsat.schema(0x80800387, {
    unknown0: rsat.i32(),
    alive: rsat.bool(),
    unknown2: rsat.i32(),
    unknown3: rsat.nested(Unknown808040E0),
    components: rsat.nested(Unknown80804117),
  });

  // 8080048A @0x19f9a20, size 0x8
  const HopOnSense = rsat.schema(0x8080048a, {
    unknown0: rsat.i32(),
    unknown1: rsat.bool(),
  });

  // 8080228D @0x19f0578, size 0xc
  const Type37Sense = rsat.schema(0x8080228d, {
    unknown0: rsat.i32({ size: 31, bias: 0 }),
    unknown1: rsat.nested(SensorClientRef),
  });

  // 80800AB3 @0x1873a60, size 0x1c
  const ObjectiveCountdown = rsat.schema(0x80800ab3, {
    unknown0: rsat.bool(),
    unknown1: rsat.i32(),
    unknown2: rsat.i32(),
    unknown3: rsat.i32(),
    unknown4: rsat.i32(),
    unknown5: rsat.i32(),
    unknown6: rsat.f32(),
  });

  // 80800725 @0x18a9c50, size 0x24
  // The same clock the objective countdown carries, a progress-bar bool and
  // the bar's offset.
  const TimerAuth = rsat.schema(0x80800725, {
    options: rsat.nested(ObjectiveCountdown),
    progressBar: rsat.bool(),
    barOffsetSeconds: rsat.i32(),
  });

  // 808004A4 @0x1905540, size 0x20: the hard_wipe_globals row (type 34).
  // The first bool is whether a hard wipe is enabled (the phase scripts set
  // it); the second only feeds a HUD flag, the third member has no reader.
  const HardWipeGlobalsAuth = rsat.schema(0x808004a4, {
    enabled: rsat.bool(),
    unknown1: rsat.bool(),
    unknown2: rsat.i8({ size: 2, bias: 1 }),
    countdown: rsat.nested(ObjectiveCountdown),
  });

  // 8080439F @0x192d2d0, size 0x60
  const Unknown8080439F = rsat.schema(0x8080439f, {
    unknown0: rsat.optionsArray(f32q(0, 2040, 7), 24),
  });

  // 80800357 @0x19241a8, size 0x9c
  const SquadSense = rsat.schema(0x80800357, {
    unknown0: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown1: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown2: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    alive: rsat.optional(rsat.i32({ size: 6, bias: 0 })),
    unknown4: rsat.optional(f32q(0, 2040, 7)),
    unknown5: rsat.i8({ size: 3, bias: 1 }),
    unknown6: rsat.bool(),
    unknown7: rsat.bool(),
    tally: rsat.optional(rsat.nested(SquadCells)),
    unknown9: rsat.optional(rsat.nested(Unknown8080439F)),
  });

  return {
    MachineId,
    SessionDisplayChars,
    SessionDisplay,
    JoinIdentity,
    JoinRequestAuth,
    JoinRequest,
    JoinResult,
    BubbleStates,
    ActivityNameChars,
    ActivityName,
    Unknown80800D17,
    WorldHandles,
    WorldOptions,
    GlobalActivityStateBody,
    GlobalActivityState,
    Unknown80800D68,
    WorldGlobalsState,
    Unknown808043BC,
    Unknown80800B18,
    Unknown80800D82,
    Unknown80800D9F,
    Unknown80800C21,
    Unknown80800E0A,
    Unknown80800D9E,
    ClientAuthoritativeData,
    MembershipSlot,
    Unknown808052FE,
    Unknown80800E4A,
    Unknown80805491,
    Unknown80800C9F,
    Unknown80800C6F,
    Unknown808051FE,
    Unknown80800C93,
    Unknown80800BF9,
    Unknown80800BD7,
    ReplicateMembership,
    AuthoritySlot,
    Unknown8080540E,
    AuthorityTable,
    SensorClientRef,
    LifetimeAuth,
    PlayerFlags,
    PlayerIdentity,
    Unknown80800540,
    Unknown80802619,
    PlayerAuth,
    TemperamentList,
    SquadCells,
    SquadAuth,
    ObjectiveSlots,
    ObjectiveAuth,
    Unknown8080433C,
    Unknown8080078E,
    Unknown808040E5,
    Unknown80800836,
    Unknown80804370,
    Unknown80800512,
    Unknown80804256,
    Unknown808007A9,
    ActorAuth,
    PlayerTriggerAuth,
    PlayerMonitorAuth,
    PlayerMonitorSense,
    PassengerAuth,
    SequenceVariable,
    SequenceVariables,
    SequenceAuth,
    Unknown8080038A,
    ActorSense,
    Unknown8080411B,
    Unknown8080086C,
    Unknown808041A4,
    ObjectiveSense,
    Unknown808040E0,
    ObjectDeviceComponent,
    ObjectFilterRowPredicate,
    ObjectFilterSquadMembersPredicate,
    ObjectFilterActivityFlagPredicate,
    ObjectInteractableComponent,
    ObjectDeviceSense,
    ObjectInteractableSense,
    Unknown80804117,
    ObjectSense,
    HopOnSense,
    Type37Sense,
    ObjectiveCountdown,
    TimerAuth,
    HardWipeGlobalsAuth,
    Unknown8080439F,
    SquadSense,
  };
}

export type AhSchemas = ReturnType<typeof defineAhSchemas>;

export type PlayerStateValue = rsat.Infer<AhSchemas["Unknown80800540"]>;
export type PlayerState2Value = rsat.Infer<AhSchemas["Unknown80802619"]>;
