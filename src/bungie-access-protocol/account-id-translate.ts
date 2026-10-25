import type { PlatformAccount } from "./versions/bap-build";

// Account id translation (BAP 0x17/0x18), big endian. Request: u16 count, u16
// reserved, then count platform ids. Response: u16 count, u8 account type,
// u8 0xFF, the platform ids again, then an investment account soid for each.
// A platform id is the build's own bytes: an 8-byte id on the Xbox 360, the
// 36-byte PSN account nest on the PS4 (as login_account carries it).

export function parseAccountIdTranslateRequest(
  body: Buffer,
  account: PlatformAccount
): Buffer[] {
  if (body.length < 4) {
    return [];
  }
  const max = Math.floor((body.length - 4) / account.idBytes);
  const count = Math.min(body.readUInt16BE(0), max);
  return Array.from({ length: count }, (_, i) =>
    body.subarray(4 + i * account.idBytes, 4 + (i + 1) * account.idBytes)
  );
}

export function buildAccountIdTranslateResponse(
  platformIds: readonly Buffer[],
  investmentSoid: bigint,
  account: PlatformAccount
): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt16BE(platformIds.length, 0);
  head[2] = account.type;
  head[3] = 0xff;
  const soids = Buffer.alloc(8 * platformIds.length);
  for (let i = 0; i < platformIds.length; i++) {
    soids.writeBigUInt64BE(investmentSoid, i * 8);
  }
  return Buffer.concat([head, ...platformIds, soids]);
}
