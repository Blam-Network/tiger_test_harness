// Reads `count` bits (MSB first, big-endian) from `bit` of the payload.
export function readBits(payload: Buffer, bit: number, count: number): number {
  let value = 0;
  for (let i = 0; i < count; i++) {
    const at = bit + i;
    const byte = payload[at >> 3] ?? 0;
    value = value * 2 + ((byte >> (7 - (at & 7))) & 1);
  }
  return value;
}
