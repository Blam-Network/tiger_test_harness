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

// A kind-34 member: its 80800046 header, a kind-23 present bit and the 32-bit
// class handle, then the body in that class's schema. A body's length is only
// known from its schema, so an unlisted class throws.
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
  // 8080405E @0x2357d00, size 0x8
  const MachineId = rsat.schema(0x8080405e, {
    bytes: rsat.repeat(rsat.u8(), 8),
  });

  // 80804008 @0x1fd21c0, size 0x80
  const SessionDisplayChars = rsat.schema(0x80804008, {
    chars: rsat.repeat(rsat.i8(), 128),
  });

  // 80804056 @0x2307f50, size 0x80
  const SessionDisplay = rsat.schema(0x80804056, {
    text: rsat.nested(SessionDisplayChars),
  });

  // 80800C02 @0x21adab0, size 0x28
  const JoinIdentity = rsat.schema(0x80800c02, {
    machine: rsat.nested(MachineId),
    player: rsat.nested(MachineId),
    account: rsat.u64(),
    character: rsat.u64(),
    unknown4: rsat.u64(),
  });

  // 80800AF6 @0x20c6730, size 0xb8
  const JoinRequestAuth = rsat.schema(0x80800af6, {
    unknown0: rsat.optional(rsat.u8({ size: 4, bias: 0 })),
    displayName: rsat.optional(rsat.nested(SessionDisplay)),
    unknown2: rsat.optional(rsat.u64()),
    unknown3: rsat.optional(rsat.u64()),
    unknown4: rsat.optional(rsat.u64()),
    unknown5: rsat.optional(rsat.u64()),
    unknown6: rsat.optional(rsat.i32()),
    machine: rsat.optional(rsat.nested(MachineId)),
  });

  // 80800E66 @0x23c8500, size 0xf8
  const JoinRequest = rsat.schema(0x80800e66, {
    nonce: rsat.u32(),
    sessionId: rsat.u64(),
    identity: rsat.nested(JoinIdentity),
    auth: rsat.nested(JoinRequestAuth),
    unknown4: rsat.bool(),
  });

  // 80800A33 @0x2014420, size 0x198
  const JoinResult = rsat.schema(0x80800a33, {
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
  });

  // 80804050 @0x22afb10, size 0x40
  const BubbleStates = rsat.schema(0x80804050, {
    states: rsat.repeat(rsat.i8(), 64),
  });

  // 808043A5 @0x23904f0, size 0x28
  const ActivityNameChars = rsat.schema(0x808043a5, {
    chars: rsat.repeat(rsat.i8(), 40),
  });

  // 8080409D @0x1fa5f10, size 0x28
  const ActivityName = rsat.schema(0x8080409d, {
    text: rsat.nested(ActivityNameChars),
  });

  // 80800CE7 @0x2270ff0, size 0x30
  const Unknown80800CE7 = rsat.schema(0x80800ce7, {
    unknown0: rsat.u32(),
    unknown1: opaqueKind(34),
  });

  // 808052E7 @0x21c9b00, size 0x970
  const WorldHandles = rsat.schema(0x808052e7, {
    handles: rsat.array(rsat.nested(Unknown80800CE7), {
      lengthBits: 6,
      max: 50,
    }),
  });

  // 80800C97 @0x2229530, size 0x9c0
  const WorldOptions = rsat.schema(0x80800c97, {
    valid: rsat.bool(),
    handles: rsat.nested(WorldHandles),
    unk2: rsat.u32(),
    unknown3: rsat.bool(),
    worldServerTime: rsat.u64(),
    activityId: rsat.i16(),
    unknown6: rsat.i16(),
    activityName: rsat.nested(ActivityName),
  });

  // 80800B62 @0x2127800, size 0xa20
  const GlobalActivityStateBody = rsat.schema(0x80800b62, {
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

  // 80800E43 @0x23a8dc0, size 0xa20
  const GlobalActivityState = rsat.schema(0x80800e43, {
    state: rsat.nested(GlobalActivityStateBody),
  });

  // 80800D35 @0x22b2f60, size 0x8
  const Unknown80800D35 = rsat.schema(0x80800d35, {
    unknown0: rsat.bool(),
    unknown1: rsat.f32(),
  });

  // 80800D8E @0x22f9a20, size 0x8
  const WorldGlobalsState = rsat.schema(0x80800d8e, {
    unknown0: rsat.nested(Unknown80800D35),
  });

  // 808043BB @0x23ae450, size 0x84
  const Unknown808043BB = rsat.schema(0x808043bb, {
    unknown0: rsat.array(rsat.u8(), { lengthBits: 8, max: 128 }),
  });

  // 80800AEF @0x20c1f40, size 0x90
  const Unknown80800AEF = rsat.schema(0x80800aef, {
    unknown0: rsat.u8(),
    unknown1: rsat.i8({ size: 2, bias: 1 }),
    unknown2: rsat.nested(Unknown808043BB),
    unknown3: rsat.u64(),
  });

  // 80800B24 @0x20f1660, size 0xa0
  const Unknown80800B24 = rsat.schema(0x80800b24, {
    unknown0: rsat.i32(),
    unknown1: rsat.i32(),
    unknown2: rsat.i8({ size: 2, bias: 1 }),
    unknown3: rsat.u8(),
    unknown4: rsat.nested(Unknown80800AEF),
  });

  // 80800EC2 @0x2427040, size 0x148
  const Unknown80800EC2 = rsat.schema(0x80800ec2, {
    unknown0: rsat.optional(rsat.nested(Unknown80800B24)),
    unknown1: rsat.optional(rsat.nested(Unknown80800B24)),
    unknown2: rsat.optional(rsat.u32()),
    unknown3: rsat.optional(rsat.u8()),
    unknown4: rsat.optional(rsat.u8()),
    unknown5: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
  });

  // 80800EAE @0x24125a0, size 0xc
  const Unknown80800EAE = rsat.schema(0x80800eae, {
    unknown0: rsat.i8({ size: 3, bias: 1 }),
    unknown1: rsat.u8(),
    unknown2: rsat.i32(),
    unknown3: rsat.u8(),
  });

  // 80800DD4 @0x233e3b0, size 0x10
  const Unknown80800DD4 = rsat.schema(0x80800dd4, {
    unknown0: rsat.u8(),
    unknown1: rsat.i32(),
    unknown2: rsat.u32(),
    unknown3: rsat.u32({ size: 20, bias: 0 }),
  });

  // 80800D6E @0x22dee00, size 0x18
  const Unknown80800D6E = rsat.schema(0x80800d6e, {
    unknown0: rsat.i8({ size: 3, bias: 1 }),
    unknown1: rsat.nested(Unknown80800DD4),
    unknown2: rsat.i32(),
  });

  // 80800CE8 @0x2271b50, size 0x228
  const ClientAuthoritativeData = rsat.schema(0x80800ce8, {
    identity: rsat.optional(rsat.nested(JoinRequestAuth)),
    transition: rsat.optional(rsat.nested(Unknown80800EC2)),
    hardWipe: rsat.optional(rsat.nested(Unknown80800EAE)),
    teleport: rsat.optional(rsat.nested(Unknown80800D6E)),
  });

  // 80800AF7 @0x20c7050, size 0x258
  const MembershipSlot = rsat.schema(0x80800af7, {
    identity: rsat.optional(rsat.nested(JoinIdentity)),
    auth: rsat.optional(rsat.nested(ClientAuthoritativeData)),
    unknown2: rsat.optional(rsat.i8({ size: 4, bias: 1 })),
  });

  // 80805425 @0x23d8b20, size 0x2ee0
  const Unknown80805425 = rsat.schema(0x80805425, {
    unknown0: rsat.repeat(rsat.nested(MembershipSlot), 20),
  });

  // 80800E14 @0x23793e0, size 0x18
  const Unknown80800E14 = rsat.schema(0x80800e14, {
    unknown0: rsat.u8(),
    unknown1: rsat.i8({ size: 2, bias: 1 }),
    unknown2: rsat.i8({ size: 5, bias: 1 }),
    unknown3: rsat.bool(),
  });

  // 80805435 @0x23fa030, size 0x14
  const Unknown80805435 = rsat.schema(0x80805435, {
    unknown0: rsat.repeat(rsat.u8(), 20),
  });

  // 80800C72 @0x220ac10, size 0xb0
  const Unknown80800C72 = rsat.schema(0x80800c72, {
    unknown0: rsat.u8(),
    unknown1: rsat.u32({ size: 20, bias: 0 }),
    unknown2: rsat.nested(Unknown80805435),
    unknown3: rsat.nested(Unknown808043BB),
    unknown4: rsat.u64(),
  });

  // 80800C43 @0x21e5760, size 0xd8
  const Unknown80800C43 = rsat.schema(0x80800c43, {
    unknown0: rsat.i32(),
    unknown1: rsat.i8({ size: 2, bias: 1 }),
    unknown2: rsat.nested(Unknown80800E14),
    unknown3: rsat.u32({ size: 20, bias: 0 }),
    unknown4: rsat.nested(Unknown80800C72),
  });

  // 808051AB @0x1fd7440, size 0x21c0
  const Unknown808051AB = rsat.schema(0x808051ab, {
    unknown0: rsat.repeat(rsat.nested(Unknown80800C43), 40),
  });

  // 80800B58 @0x211f890, size 0x3
  const Unknown80800B58 = rsat.schema(0x80800b58, {
    unknown0: rsat.u8(),
    unknown1: rsat.u8(),
    unknown2: rsat.i8({ size: 3, bias: 1 }),
  });

  // 80800BCB @0x2182770, size 0x24
  const Unknown80800BCB = rsat.schema(0x80800bcb, {
    unknown0: rsat.i8({ size: 2, bias: 1 }),
    unknown1: rsat.nested(Unknown80800DD4),
    unknown2: rsat.nested(Unknown80800DD4),
  });

  // 80800B11 @0x20dcc70, size 0x21f0
  const Unknown80800B11 = rsat.schema(0x80800b11, {
    unknown0: rsat.nested(Unknown808051AB),
    unknown1: rsat.nested(Unknown80800B58),
    unknown2: rsat.nested(Unknown80800BCB),
    unknown3: rsat.optional(rsat.nested(MachineId)),
  });

  // 80800ACF @0x20a5780, size 0x50e8
  const ReplicateMembership = rsat.schema(0x80800acf, {
    generation: rsat.u32(),
    unk: rsat.u32(),
    clients: rsat.nested(Unknown80805425),
    pahRegions: rsat.optional(rsat.nested(Unknown80800B11)),
    unknown4: rsat.optional(rsat.u32({ size: 20, bias: 0 })),
    unknown5: rsat.optional(rsat.u32({ size: 20, bias: 0 })),
    unknown6: rsat.optional(rsat.u32({ size: 20, bias: 0 })),
  });

  // 80800B57 @0x211f3c0, size 0xc
  const AuthoritySlot = rsat.schema(0x80800b57, {
    machine: rsat.optional(rsat.nested(MachineId)),
    sequence: rsat.optional(rsat.u16()),
    unknown2: rsat.bool(),
  });

  // 808053B2 @0x230c1c0, size 0x30c
  const Unknown808053B2 = rsat.schema(0x808053b2, {
    unknown0: rsat.repeat(rsat.nested(AuthoritySlot), 65),
  });

  // 80800CC8 @0x224d7c0, size 0x310
  const AuthorityTable = rsat.schema(0x80800cc8, {
    unknown0: rsat.optional(rsat.i32()),
    slots: rsat.nested(Unknown808053B2),
  });

  // 80800486 @0x2093da0, size 0x8
  const SensorClientRef = rsat.schema(0x80800486, {
    bundle: rsat.u32(),
    typeId: rsat.i8({ size: 6, bias: 1 }),
    typeIndex: rsat.i16(),
  });

  // 80800909 @0x23e1d30, size 0x9a0
  const LifetimeAuth = rsat.schema(0x80800909, {
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

  // 80804199 @0x20e7bb0, size 0x24
  const PlayerFlags = rsat.schema(0x80804199, {
    flags: rsat.array(rsat.u32(), { lengthBits: 4, max: 8 }),
  });

  // 80800621 @0x21c4890, size 0x38
  const PlayerIdentity = rsat.schema(0x80800621, {
    key: rsat.u64(),
    unknown1: rsat.u64(),
    faction: rsat.i8({ size: 6, bias: 3 }),
    activityFlags: rsat.nested(PlayerFlags),
  });

  // 80800540 @0x211a500, size 0xc: the 40662's player state with two of its
  // three bools and without its trailing i8:2.
  const Unknown80800540 = rsat.schema(0x80800540, {
    unknown0: rsat.i32(),
    unknown1: rsat.u32(),
    unknown2: rsat.bool(),
    unknown3: rsat.bool(),
    unknown4: rsat.i8({ size: 3, bias: 1 }),
  });

  // 80802613 @0x21dc4e0, size 0x8
  const Unknown80802613 = rsat.schema(0x80802613, {
    unknown0: rsat.f32(),
    unknown1: rsat.bool(),
    unknown2: rsat.bool(),
    unknown3: rsat.bool(),
  });

  // 808024EA @0x2168920, size 0x58
  const PlayerAuth = rsat.schema(0x808024ea, {
    unknown0: rsat.nested(Unknown80800540),
    unknown1: rsat.nested(Unknown80802613),
    identity: rsat.nested(PlayerIdentity),
    flag: rsat.bool(),
    unknown4: rsat.i32(),
  });

  // 808044CE @0x21b1870, size 0x1c
  const TemperamentList = rsat.schema(0x808044ce, {
    tags: rsat.array(rsat.u32(), { lengthBits: 3, max: 6 }),
  });

  // 80804252 @0x21c89f0, size 0x24: one i32 per squad cell, the squad
  // auth's roster and the squad sense's tally
  const SquadCells = rsat.schema(0x80804252, {
    cells: rsat.array(rsat.i32(), { lengthBits: 4, max: 8 }),
  });

  // 8080082A @0x2336390, size 0x68
  const SquadAuth = rsat.schema(0x8080082a, {
    ref0: rsat.optional(rsat.nested(SensorClientRef)),
    ref1: rsat.optional(rsat.nested(SensorClientRef)),
    temperaments: rsat.optional(rsat.nested(TemperamentList)),
    roster: rsat.optional(rsat.nested(SquadCells)),
    epoch: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    bindingGeneration: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown6: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    // Never read by the squad in 40662. A retail capture sends the task's
    // +0xC here ([12] there).
    unknown7: rsat.optional(rsat.i32({ size: 6, bias: 1 })),
    // The index of ref0's task the squad is linked under; -1 for none.
    task: rsat.optional(rsat.i32({ size: 5, bias: 1 })),
    killPolicy: rsat.i8({ size: 2, bias: 1 }),
    carrierCargo: rsat.i8({ size: 3, bias: 1 }),
  });

  // 808040B6, size 0x18: an Objective's slots, one optional 7-bit state per
  // task.
  const ObjectiveSlots = rsat.schema(0x808040b6, {
    slots: rsat.optionsArray(rsat.i8({ size: 7, bias: 0 }), 24),
  });

  // 808004D0, size 0x1c: the Objective auth. [1] is the reset generation
  // reset() bumps (true name unknown).
  const ObjectiveAuth = rsat.schema(0x808004d0, {
    slots: rsat.optional(rsat.nested(ObjectiveSlots)),
    resetGeneration: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  });

  // 8080433A @0x2300b20, size 0x10
  const Unknown8080433A = rsat.schema(0x8080433a, {
    unknown0: rsat.repeat(rsat.f32(), 4),
  });

  // 8080076F @0x22a79b0, size 0x14
  const Unknown8080076F = rsat.schema(0x8080076f, {
    unknown0: rsat.u32(),
    unknown1: rsat.nested(Unknown8080433A),
  });

  // 808040E0 @0x200a8a0, size 0x54
  const Unknown808040E0 = rsat.schema(0x808040e0, {
    unknown0: rsat.array(rsat.nested(Unknown8080076F), {
      lengthBits: 3,
      max: 4,
    }),
  });

  // 80800815 @0x2324510, size 0x84
  const Unknown80800815 = rsat.schema(0x80800815, {
    unknown0: rsat.i32({ size: 31, bias: 0 }),
    unknown1: rsat.u8({ size: 4, bias: 0 }),
    unknown2: rsat.u8({ size: 4, bias: 0 }),
    unknown3: rsat.nested(TemperamentList),
    unknown4: rsat.nested(SensorClientRef),
    unknown5: rsat.i32({ bias: 1 }),
    unknown6: rsat.nested(Unknown808040E0),
  });

  // 8080436F @0x2352bb0, size 0x808
  const Unknown8080436F = rsat.schema(0x8080436f, {
    unknown0: rsat.array(rsat.optional(opaqueKind(38)), {
      lengthBits: 6,
      max: 32,
    }),
  });

  // 808004E8 @0x20d4780, size 0x810
  const Unknown808004E8 = rsat.schema(0x808004e8, {
    unknown0: rsat.i32({ size: 31, bias: 0 }),
    unknown1: rsat.i32({ size: 6, bias: 0 }),
    unknown2: rsat.nested(Unknown8080436F),
  });

  // 80804256 @0x21ca230, size 0x44
  const Unknown80804256 = rsat.schema(0x80804256, {
    unknown0: rsat.array(rsat.nested(SensorClientRef), {
      lengthBits: 4,
      max: 8,
    }),
  });

  // 80800789 @0x22bae40, size 0x48
  const Unknown80800789 = rsat.schema(0x80800789, {
    unknown0: rsat.nested(Unknown80804256),
    unknown1: rsat.i32({ size: 31, bias: 0 }),
  });

  // 80800844 @0x234af70, size 0x8e8
  const ActorAuth = rsat.schema(0x80800844, {
    killEpoch: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    killed: rsat.i8({ size: 2, bias: 1 }),
    carried: rsat.i8({ size: 3, bias: 1 }),
    place: rsat.bool(),
    behaviour: rsat.optional(rsat.nested(Unknown80800815)),
    script: rsat.optional(rsat.nested(Unknown808004E8)),
    drop: rsat.optional(rsat.nested(Unknown80800789)),
  });

  // 80800436 @0x2056bb0, size 0x8
  const PlayerTriggerAuth = rsat.schema(0x80800436, {
    enabled: rsat.bool(),
    armStamp: rsat.i32(),
  });

  // 808006CA @0x2230c00, size 0xc
  const PlayerMonitorAuth = rsat.schema(0x808006ca, {
    filter: rsat.nested(SensorClientRef),
    unknown1: rsat.i32(),
  });

  // 80802225 @0x205e200, size 0xc: the Passenger auth (type 37,
  // skiff_passenger, dropship_passenger). The client logs it as "should be
  // bound to '%s', cookie #%d": the cookie, then the row it rides.
  const PassengerAuth = rsat.schema(0x80802225, {
    cookie: rsat.i32({ size: 31, bias: 0 }),
    binding: rsat.nested(SensorClientRef),
  });

  // 80800599 @0x2152550, size 0xc
  const PlayerMonitorSense = rsat.schema(0x80800599, {
    any: rsat.bool(),
    all: rsat.bool(),
    count: rsat.i32(),
    unknown3: rsat.i32(),
  });

  // 80802BD5 @0x2429e80, size 0x8
  const SequenceVariable = rsat.schema(0x80802bd5, {
    name: rsat.u32(),
    value: rsat.u32(),
  });

  // 80804B26 @0x20fd5d0, size 0x18: three pairs, not a counted list.
  const SequenceVariables = rsat.schema(0x80804b26, {
    pairs: rsat.repeat(rsat.nested(SequenceVariable), 3),
  });

  // 8080297F @0x233d260, size 0x28
  const SequenceAuth = rsat.schema(0x8080297f, {
    startTick: rsat.i32(),
    playingId: rsat.u8(),
    variables: rsat.nested(SequenceVariables),
    viewers: rsat.nested(SensorClientRef),
  });

  // 8080035F @0x1fa73b0, size 0x10
  const Unknown8080035F = rsat.schema(0x8080035f, {
    unknown0: rsat.optional(rsat.i32({ size: 6, bias: 0 })),
    unknown1: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown2: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown3: rsat.bool(),
  });

  // 808005AF @0x2165110, size 0x34
  const ActorSense = rsat.schema(0x808005af, {
    unknown0: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown1: rsat.optional(rsat.f32()),
    unknown2: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown3: rsat.optional(rsat.nested(Unknown8080035F)),
    unknown4: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown5: rsat.i8({ size: 2, bias: 1 }),
    unknown6: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown7: rsat.optional(f32q(0, 1, 4)),
    unknown8: rsat.optional(f32q(0, 1, 4)),
    unknown9: rsat.bool(),
    unknown10: rsat.bool(),
  });

  // 80804117 @0x203f280, size 0x18
  const Unknown80804117 = rsat.schema(0x80804117, {
    unknown0: rsat.optionsArray(rsat.i8({ size: 6, bias: 0 }), 24),
  });

  // 80800848 @0x234dc50, size 0x1a
  const Unknown80800848 = rsat.schema(0x80800848, {
    unknown0: rsat.optional(rsat.i8({ size: 7, bias: 0 })),
    unknown1: rsat.u8({ size: 1, bias: 0 }),
    unknown2: rsat.optional(rsat.nested(Unknown80804117)),
  });

  // 808041A4 @0x20f9530, size 0x270
  const Unknown808041A4 = rsat.schema(0x808041a4, {
    unknown0: rsat.repeat(rsat.nested(Unknown80800848), 24),
  });

  // 8080080F @0x2321630, size 0x278
  const ObjectiveSense = rsat.schema(0x8080080f, {
    table: rsat.optional(rsat.nested(Unknown808041A4)),
    unknown1: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown2: rsat.optional(rsat.u32()),
  });

  // 808040DB @0x2001f70, size 0x8
  const Unknown808040DB = rsat.schema(0x808040db, {
    unknown0: rsat.u32(),
    unknown1: rsat.u32(),
  });

  // 8080208C @0x1faee30, size 0x18: an Object auth's device component, the
  // element the Object (808007B4 [3]) and ObjectSense component vecs carry for
  // an object with a device. Power, lock and position are each a pair {stamp,
  // value}; 40662's triples have an i32 between the two (0 in every retail
  // capture). Taken for the 40662's 8080279A by its place in the class
  // registration list, ahead of its sense twin.
  const ObjectDeviceComponent = rsat.schema(0x8080208c, {
    powerStamp: rsat.i32(),
    power: rsat.f32(),
    lockStamp: rsat.i32(),
    lock: rsat.f32(),
    positionStamp: rsat.i32(),
    position: rsat.f32(),
  });

  // 808008F5: an ObjectFilter predicate naming one row. The 2-bit mode: 0 adds
  // the match, 1 removes it. In a retail capture of_ghostlight holds
  // {0, sq_nux_ghost__ghost} while the Ghost lights the breach up.
  const ObjectFilterRowPredicate = rsat.schema(0x808008f5, {
    mode: rsat.i8({ size: 2, bias: 1 }),
    item: rsat.nested(SensorClientRef),
  });

  // 808006C6 @0x222e280, size 0xc: every member of a Squad row, the row
  // predicate's squad form (ff's 808006E5 by class checksum). In a retail
  // capture of_ultra_servitor holds {0, sq_bossbattle_boss01} while Sepiks
  // Prime's performance shield is up.
  const ObjectFilterSquadMembersPredicate = rsat.schema(0x808006c6, {
    mode: rsat.i8({ size: 2, bias: 1 }),
    item: rsat.nested(SensorClientRef),
  });

  // 8080092C @0x23ff870, size 0x8: the players-with-activity-flag predicate,
  // the second handler the "object filter predicates" registration installs.
  // It walks the Player slots and keeps those whose flag list holds the u32. In
  // a retail capture the cosmo_portal_1 filter for the refinery's hack console
  // is {0, 1C450A3D} from the world entry.
  const ObjectFilterActivityFlagPredicate = rsat.schema(0x8080092c, {
    mode: rsat.i8({ size: 2, bias: 1 }),
    flag: rsat.u32(),
  });

  // 80802148 @0x2004b70, size 0x14: an Object auth's mission-interactable
  // component. mode 1 = m_enabled false, usable by the players the filter
  // admits; 2 = m_enabled true, everyone (the weapon chest); 0 = keep. Then the
  // trailing stamp/bool "used" latch (true names unknown). The hack console is
  // {1, sp_placement_array._object_filter, 0, false} from its creation to the
  // end of the strike (retail capture).
  const ObjectInteractableComponent = rsat.schema(0x80802148, {
    mode: rsat.i8({ size: 2, bias: 1 }),
    filter: rsat.nested(SensorClientRef),
    usedStamp: rsat.i32(),
    used: rsat.bool(),
  });

  // 808027D3 @0x22955b0, size 0x18: the device component's sense twin, the
  // client's own power, lock and position pairs in the auth's layout.
  const ObjectDeviceSense = rsat.schema(0x808027d3, {
    powerStamp: rsat.i32(),
    power: rsat.f32(),
    lockStamp: rsat.i32(),
    lock: rsat.f32(),
    positionStamp: rsat.i32(),
    position: rsat.f32(),
  });

  // 80802022 @0x1f83d80, size 0x8: the mission-interactable's sense twin,
  // the client's used latch and its stamp (40662 keeps the newer stamp).
  const ObjectInteractableSense = rsat.schema(0x80802022, {
    used: rsat.bool(),
    usedStamp: rsat.i32(),
  });

  // 80804113 @0x203bd90, size 0xd0: an Object's component vec, up to three
  // components (80804150, kind 34 each).
  const Unknown80804113 = rsat.schema(0x80804113, {
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

  // 8080035C @0x1fa6410, size 0xf0
  const ObjectSense = rsat.schema(0x8080035c, {
    unknown0: rsat.i32(),
    alive: rsat.bool(),
    unknown2: rsat.i32(),
    unknown3: rsat.nested(Unknown808040DB),
    components: rsat.nested(Unknown80804113),
  });

  // 80800460 @0x2077430, size 0x8
  const HopOnSense = rsat.schema(0x80800460, {
    unknown0: rsat.i32(),
    unknown1: rsat.bool(),
  });

  // 808022A0 @0x2090340, size 0xc
  const Type37Sense = rsat.schema(0x808022a0, {
    unknown0: rsat.i32({ size: 31, bias: 0 }),
    unknown1: rsat.nested(SensorClientRef),
  });

  // 80800A89 @0x2069f90, size 0x1c
  const ObjectiveCountdown = rsat.schema(0x80800a89, {
    unknown0: rsat.bool(),
    unknown1: rsat.i32(),
    unknown2: rsat.i32(),
    unknown3: rsat.i32(),
    unknown4: rsat.i32(),
    unknown5: rsat.i32(),
    unknown6: rsat.f32(),
  });

  // 80800705 @0x22580f0, size 0x24
  // The same clock the objective countdown carries, a progress-bar bool and
  // the bar's offset.
  const TimerAuth = rsat.schema(0x80800705, {
    options: rsat.nested(ObjectiveCountdown),
    progressBar: rsat.bool(),
    barOffsetSeconds: rsat.i32(),
  });

  // 80800479 @0x208c1c0, size 0x20: the hard_wipe_globals row (type 34).
  // The bool is whether a hard wipe is enabled (the phase scripts set it);
  // 40662 has a second, HUD-only bool after it. The i8:2 has no reader there.
  const HardWipeGlobalsAuth = rsat.schema(0x80800479, {
    enabled: rsat.bool(),
    unknown1: rsat.i8({ size: 2, bias: 1 }),
    countdown: rsat.nested(ObjectiveCountdown),
  });

  // 808041EB @0x2147730, size 0x60
  const Unknown808041EB = rsat.schema(0x808041eb, {
    unknown0: rsat.optionsArray(f32q(0, 2040, 7), 24),
  });

  // 80800797 @0x22c8270, size 0xa0
  const SquadSense = rsat.schema(0x80800797, {
    unknown0: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown1: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unknown2: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    alive: rsat.optional(rsat.i32({ size: 6, bias: 0 })),
    unknown4: rsat.bool(),
    unknown5: rsat.bool(),
    unknown6: rsat.bool(),
    unknown7: rsat.bool(),
    unknown8: rsat.bool(),
    unknown9: rsat.optional(f32q(0, 2040, 7)),
    tally: rsat.optional(rsat.nested(SquadCells)),
    unknown11: rsat.optional(rsat.nested(Unknown808041EB)),
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
    Unknown80800CE7,
    WorldHandles,
    WorldOptions,
    GlobalActivityStateBody,
    GlobalActivityState,
    Unknown80800D35,
    WorldGlobalsState,
    Unknown808043BB,
    Unknown80800AEF,
    Unknown80800B24,
    Unknown80800EC2,
    Unknown80800EAE,
    Unknown80800DD4,
    Unknown80800D6E,
    ClientAuthoritativeData,
    MembershipSlot,
    Unknown80805425,
    Unknown80800E14,
    Unknown80805435,
    Unknown80800C72,
    Unknown80800C43,
    Unknown808051AB,
    Unknown80800B58,
    Unknown80800BCB,
    Unknown80800B11,
    ReplicateMembership,
    AuthoritySlot,
    Unknown808053B2,
    AuthorityTable,
    SensorClientRef,
    LifetimeAuth,
    PlayerFlags,
    PlayerIdentity,
    Unknown80800540,
    Unknown80802613,
    PlayerAuth,
    TemperamentList,
    SquadCells,
    SquadAuth,
    ObjectiveSlots,
    ObjectiveAuth,
    Unknown8080433A,
    Unknown8080076F,
    Unknown808040E0,
    Unknown80800815,
    Unknown8080436F,
    Unknown808004E8,
    Unknown80804256,
    Unknown80800789,
    ActorAuth,
    PlayerTriggerAuth,
    PlayerMonitorAuth,
    PlayerMonitorSense,
    PassengerAuth,
    SequenceVariable,
    SequenceVariables,
    SequenceAuth,
    Unknown8080035F,
    ActorSense,
    Unknown80804117,
    Unknown80800848,
    Unknown808041A4,
    ObjectiveSense,
    Unknown808040DB,
    ObjectDeviceComponent,
    ObjectFilterRowPredicate,
    ObjectFilterSquadMembersPredicate,
    ObjectFilterActivityFlagPredicate,
    ObjectInteractableComponent,
    ObjectDeviceSense,
    ObjectInteractableSense,
    Unknown80804113,
    ObjectSense,
    HopOnSense,
    Type37Sense,
    ObjectiveCountdown,
    TimerAuth,
    HardWipeGlobalsAuth,
    Unknown808041EB,
    SquadSense,
  };
}

export type AhSchemas = ReturnType<typeof defineAhSchemas>;

export type PlayerStateValue = rsat.Infer<AhSchemas["Unknown80800540"]>;
export type PlayerState2Value = rsat.Infer<AhSchemas["Unknown80802613"]>;
