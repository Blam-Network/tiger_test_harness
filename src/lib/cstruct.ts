import { CFieldType, c } from "@craftycodie/cstruct";

/** Dotted IPv4 as a 4-byte integer. Reserved bytes use `{ padAfter: 2 }`. */
export class CstructIPv4<
  const O extends c.FieldOptions = {},
> extends CFieldType<string, O> {
  getSize(): number {
    return 4;
  }

  read(buffer: Buffer, offset: number, endian: c.Endian): string {
    const value =
      endian === "little"
        ? buffer.readUInt32LE(offset)
        : buffer.readUInt32BE(offset);
    return intToIpv4(value);
  }

  write(buffer: Buffer, offset: number, value: string, endian: c.Endian): void {
    const packed = ipv4ToInt(value);
    if (endian === "little") {
      buffer.writeUInt32LE(packed, offset);
    } else {
      buffer.writeUInt32BE(packed, offset);
    }
  }
}

export const cstructIPv4 = <const O extends c.FieldOptions = {}>(options?: O) =>
  new CstructIPv4(options);

export function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => Number(p));
  const valid = parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
  if (parts.length !== 4 || !valid) {
    throw new Error(`invalid IPv4 address '${ip}'`);
  }
  return (
    ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  );
}

function intToIpv4(value: number): string {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ].join(".");
}
