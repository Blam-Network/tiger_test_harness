import { BitWriter } from "@blamnetwork/rsat";

// Per nid: its response schema encoded with status 0 and every other member
// zero or absent (the rsat payload after the 16-bit nid). The bodies come from
// the client's schemas, not the packages; schemas.test.ts checks the ones this
// build's schemas declare against the eboot's catalog,
// server-message-ids.test.ts all of them once the packages are at hand.
interface ZeroReplyBody {
  bits: number;
  hex: string;
}

export const ZERO_REPLY_BODIES: Readonly<Record<number, ZeroReplyBody>> = {
  // In this build's table only (name hash 0xB0DBE267, true name unknown),
  // response 808018C3.
  101: { bits: 41, hex: "180000000000" },
  104: { bits: 42, hex: "180000000000" },
  105: { bits: 36, hex: "1800000000" },
  201: {
    bits: 274,
    hex: "1000000000000000000000000000000000000000000000000000000000000000000000",
  },
  202: { bits: 23, hex: "100000" },
  203: { bits: 9, hex: "1000" },
  204: { bits: 68, hex: "100000000000000000" },
  205: { bits: 10, hex: "1000" },
  206: { bits: 4, hex: "10" },
  207: {
    bits: 260,
    hex: "100000000000000000000000000000000000000000000000000000000000000000",
  },
  303: { bits: 36, hex: "1800000000" },
  304: { bits: 4, hex: "10" },
  305: { bits: 4, hex: "10" },
  402: { bits: 36, hex: "1800000000" },
  403: { bits: 36, hex: "1800000000" },
  404: { bits: 36, hex: "1800000000" },
  405: { bits: 36, hex: "1800000000" },
  501: { bits: 100, hex: "18000000000000000000000000" },
  502: { bits: 36, hex: "1800000000" },
  503: {
    bits: 170,
    hex: "18000000000000000000000000000000000000000000",
  },
  504: { bits: 36, hex: "1800000000" },
  505: { bits: 36, hex: "1800000000" },
  506: { bits: 36, hex: "1800000000" },
  601: {
    bits: 164,
    hex: "180000000800000000000000000000000800000000",
  },
  701: { bits: 36, hex: "1800000000" },
  702: { bits: 36, hex: "1800000000" },
  801: { bits: 36, hex: "1800000000" },
  802: { bits: 36, hex: "1800000000" },
  803: { bits: 36, hex: "1800000000" },
  901: { bits: 36, hex: "1800000000" },
  902: { bits: 36, hex: "1800000000" },
  903: { bits: 36, hex: "1800000000" },
  1101: { bits: 4, hex: "10" },
  1102: { bits: 4, hex: "10" },
  1103: { bits: 36, hex: "1800000000" },
  1201: { bits: 36, hex: "1800000000" },
  1202: { bits: 36, hex: "1800000000" },
  1203: { bits: 36, hex: "1800000000" },
  1205: { bits: 36, hex: "1800000000" },
  1206: { bits: 36, hex: "1800000000" },
  1207: { bits: 36, hex: "1800000000" },
  1208: { bits: 36, hex: "1800000000" },
  1209: { bits: 36, hex: "1800000000" },
  1210: { bits: 36, hex: "1800000000" },
  1211: { bits: 36, hex: "1800000000" },
  1212: { bits: 36, hex: "1800000000" },
  1213: { bits: 36, hex: "1800000000" },
  1214: { bits: 4, hex: "10" },
  1215: { bits: 36, hex: "1800000000" },
  1216: { bits: 36, hex: "1800000000" },
  1217: { bits: 36, hex: "1800000000" },
  1218: { bits: 4, hex: "10" },
  1219: { bits: 36, hex: "1800000000" },
  1220: { bits: 36, hex: "1800000000" },
  1221: { bits: 36, hex: "1800000000" },
  1222: { bits: 36, hex: "1800000000" },
  1223: { bits: 36, hex: "1800000000" },
  1224: { bits: 36, hex: "1800000000" },
  1225: { bits: 4, hex: "10" },
  1226: { bits: 4, hex: "10" },
  1227: { bits: 36, hex: "1800000000" },
  1301: { bits: 4, hex: "10" },
  1302: { bits: 4, hex: "10" },
  1303: { bits: 64, hex: "1002000000000000" },
  1304: { bits: 7, hex: "10" },
  1401: { bits: 36, hex: "1800000000" },
  1501: { bits: 4, hex: "10" },
};

// The response of a nid with status 0 and every other member zero or
// absent, framed like encodeServerMessage: u16 nid, payload, no optional blob.
export function statusReplyBody(networkId: number): Buffer | null {
  const reply = ZERO_REPLY_BODIES[networkId];
  if (!reply) {
    return null;
  }
  const payload = Buffer.from(reply.hex, "hex");
  const bw = new BitWriter(payload.length + 8);
  bw.write(networkId & 0xff_ff, 16);
  for (let i = 0; i < reply.bits; i++) {
    bw.writeBit((payload[i >> 3] >> (7 - (i & 7))) & 1);
  }
  bw.writeBit(0);
  return bw.finish();
}
