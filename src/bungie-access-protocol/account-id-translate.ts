import { c } from "@craftycodie/cstruct";

/** Request header: count + reserved u16 (ids follow). */
const AccountIdTranslateRequestHeader = c.struct({
  count: c.u16(),
  reserved: c.u16(),
});

export function parseAccountIdTranslateRequest(body: Buffer): bigint[] {
  if (body.length < 4) {
    return [];
  }
  const header = c.read(AccountIdTranslateRequestHeader, body, "big");
  const max = Math.floor((body.length - 4) / 8);
  const n = Math.min(header.count >>> 0, max);
  if (n <= 0) {
    return [];
  }
  const AccountIdTranslateRequestIds = c.struct({
    platformIds: c.array(c.u64(), n),
  });
  return c.read(AccountIdTranslateRequestIds, body, 4, "big").platformIds;
}

export function buildAccountIdTranslateResponse(
  platformIds: readonly bigint[],
  investmentSoid: bigint
): Buffer {
  const n = platformIds.length;
  const AccountIdTranslateResponse = c.struct({
    count: c.u16(),
    // Seem to be magic values (encode: sub_82B7FB48; decode assert: sub_82B7FED0 via sub_82B7F798).
    unknown02: c.u8(), // v4nguard reckon this might be an account ID type (PS3 PSN = 7, Steam = 12)
    unknown03: c.u8(),
    platformIds: c.array(c.u64(), n),
    investmentSoids: c.array(c.u64(), n),
  });
  return c.write(
    AccountIdTranslateResponse,
    {
      count: n,
      unknown02: 1, // Xbox 360 I guess???
      unknown03: 0xff,
      platformIds: [...platformIds],
      investmentSoids: Array.from({ length: n }, () => investmentSoid),
    },
    "big"
  );
}
