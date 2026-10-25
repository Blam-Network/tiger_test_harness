import {
  DTYPE_BLOB,
  DTYPE_BYTE,
  DTYPE_INT64,
  DTYPE_UINT32,
  DTYPE_UINT64,
  MSG_LOBBY_TASK_REPLY,
  MSG_LSG_CONNECTION_ID,
} from "./constants";
import { writeI32LE } from "./util";

interface TypedRead<T> {
  next: Buffer;
  value: T;
}

export function readTypedByte(buf: Buffer): TypedRead<number> | null {
  if (buf.length < 2 || buf[0] !== DTYPE_BYTE) {
    return null;
  }
  return { value: buf[1]!, next: buf.subarray(2) };
}

export function peekTypedByte(buf: Buffer): number | null {
  return readTypedByte(buf)?.value ?? null;
}

export function readTypedU32(buf: Buffer): TypedRead<number> | null {
  if (buf.length < 5 || buf[0] !== DTYPE_UINT32) {
    return null;
  }
  return {
    value: buf.readUInt32LE(1),
    next: buf.subarray(5),
  };
}

export function readTypedU64(buf: Buffer): TypedRead<bigint> | null {
  if (buf.length < 9 || buf[0] !== DTYPE_UINT64) {
    return null;
  }
  return {
    value: buf.readBigUInt64LE(1),
    next: buf.subarray(9),
  };
}

function writeTypedByte(value: number): Buffer {
  return Buffer.from([DTYPE_BYTE, value & 0xff]);
}

export function writeTypedU32(value: number): Buffer {
  const b = Buffer.alloc(5);
  b[0] = DTYPE_UINT32;
  b.writeUInt32LE(value >>> 0, 1);
  return b;
}

export function writeTypedU64(value: bigint): Buffer {
  const b = Buffer.alloc(9);
  b[0] = DTYPE_UINT64;
  b.writeBigUInt64LE(value, 1);
  return b;
}

export function writeTypedI64(value: bigint): Buffer {
  const b = Buffer.alloc(9);
  b[0] = DTYPE_INT64;
  b.writeBigInt64LE(value, 1);
  return b;
}

// blob = type 0x13 | typed-uint32 length | raw bytes
export function readTypedBlob(buf: Buffer): TypedRead<Buffer> | null {
  if (buf.length < 6 || buf[0] !== DTYPE_BLOB) {
    return null;
  }
  const size = readTypedU32(buf.subarray(1));
  if (!size || size.next.length < size.value) {
    return null;
  }
  return {
    value: size.next.subarray(0, size.value),
    next: size.next.subarray(size.value),
  };
}

export function writeTypedBlob(data: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from([DTYPE_BLOB]),
    writeTypedU32(data.length),
    data,
  ]);
}

// Wire: u32le size | u8 enc=0 | u8 type=4 | u8 dtype=10 | u64le connectionId
// size counts everything after the size field.
export function buildConnectionIdFrame(connectionId: bigint): Buffer {
  const body = Buffer.alloc(1 + 1 + 1 + 8);
  body[0] = 0;
  body[1] = MSG_LSG_CONNECTION_ID;
  body[2] = DTYPE_UINT64;
  body.writeBigUInt64LE(connectionId, 3);
  return Buffer.concat([writeI32LE(body.length), body]);
}

// BD_LOBBY_SERVICE_TASK_REPLY (type 1), typed:
//   u64 transactionId | u32 error=0 | u8 taskId
//   [| u32 numResults | u32 numResults | objects...]
export function buildTaskReplyFrame(
  transactionId: bigint,
  taskId: number,
  resultObjects: Buffer[]
): Buffer {
  const parts: Buffer[] = [
    writeTypedU64(transactionId),
    writeTypedU32(0),
    writeTypedByte(taskId & 0xff),
  ];

  if (resultObjects.length > 0) {
    const n = resultObjects.length >>> 0;
    parts.push(writeTypedU32(n));
    parts.push(writeTypedU32(n));
    parts.push(...resultObjects);
  } else {
    parts.push(writeTypedU32(0));
  }

  const body = Buffer.concat([
    Buffer.from([0]),
    Buffer.from([MSG_LOBBY_TASK_REPLY]),
    Buffer.concat(parts),
  ]);
  return Buffer.concat([writeI32LE(body.length), body]);
}
