import * as dgram from "node:dgram";
import { event_message, event_warning } from "@blamnetwork/datamine";
import { hexPreview } from "./util";

// Demonware's address and NAT type discovery (bdIPDiscoveryClient,
// bdNATTypeDiscoveryClient), which a client runs against
// stun.<region>.demonware.net before it trusts its transport. Packets are
// byte-packed little endian, version 2: a type byte, a u16 version, then the
// body. An address is an IPv4 in network order and a u16 port.
//
// - IP discovery: request [30][2]; reply [30..39][2][the sender's address].
// - NAT type: request [20][2][u8 test]; reply [21][2][the sender's
//   address][the secondary address]. Test 0 starts it, test 3 asks for the
//   reply from the secondary port (it arriving there is an open NAT), test 2
//   is sent to the secondary address.

const PACKET_VERSION = 2;
const IP_DISCOVERY_REQUEST = 30;
const IP_DISCOVERY_REPLY = 31;
const NAT_TYPE_REQUEST = 20;
const NAT_TYPE_REPLY = 21;
const NAT_TEST_REPLY_FROM_SECONDARY = 3;

interface NatAddress {
  address: string;
  port: number;
}

type NatRequest = { kind: "ip_discovery" } | { kind: "nat_type"; test: number };

export function parseNatRequest(packet: Buffer): NatRequest | undefined {
  if (packet.length < 3 || packet.readUInt16LE(1) !== PACKET_VERSION) {
    return;
  }
  if (packet[0] === IP_DISCOVERY_REQUEST && packet.length === 3) {
    return { kind: "ip_discovery" };
  }
  if (packet[0] === NAT_TYPE_REQUEST && packet.length === 4) {
    return { kind: "nat_type", test: packet[3] };
  }
  return;
}

function writeAddress(target: NatAddress): Buffer {
  const octets = target.address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((o) => !(o >= 0 && o <= 255))) {
    throw new Error(`not an IPv4 address: ${target.address}`);
  }
  const out = Buffer.alloc(6);
  Buffer.from(octets).copy(out, 0);
  out.writeUInt16LE(target.port, 4);
  return out;
}

function header(type: number): Buffer {
  const out = Buffer.alloc(3);
  out[0] = type;
  out.writeUInt16LE(PACKET_VERSION, 1);
  return out;
}

export function buildIpDiscoveryReply(sender: NatAddress): Buffer {
  return Buffer.concat([header(IP_DISCOVERY_REPLY), writeAddress(sender)]);
}

export function buildNatTypeReply(
  sender: NatAddress,
  secondary: NatAddress
): Buffer {
  return Buffer.concat([
    header(NAT_TYPE_REPLY),
    writeAddress(sender),
    writeAddress(secondary),
  ]);
}

// Two UDP sockets, the primary and secondary addresses. Every client is told
// its own source address, and test 3 is answered from the secondary port, so
// it finds an open NAT.
export class NatDiscoveryServer {
  private readonly sockets: dgram.Socket[] = [];

  constructor(
    private readonly host: string,
    private readonly ports: { primary: number; secondary: number }
  ) {}

  async listen(): Promise<void> {
    const primary = await this.bind(this.ports.primary);
    const secondary = await this.bind(this.ports.secondary);
    const secondaryAddress = { address: this.host, port: this.ports.secondary };
    for (const socket of [primary, secondary]) {
      socket.on("message", (packet, rinfo) => {
        const sender = { address: rinfo.address, port: rinfo.port };
        const request = parseNatRequest(packet);
        if (!request) {
          event_warning(
            "demonware:nat: unknown packet from %s:%d: %s",
            sender.address,
            sender.port,
            hexPreview(packet)
          );
          return;
        }
        if (request.kind === "ip_discovery") {
          socket.send(
            buildIpDiscoveryReply(sender),
            sender.port,
            sender.address
          );
          return;
        }
        const from =
          request.test === NAT_TEST_REPLY_FROM_SECONDARY ? secondary : socket;
        from.send(
          buildNatTypeReply(sender, secondaryAddress),
          sender.port,
          sender.address
        );
      });
    }
    event_message(
      "demonware:nat: NAT discovery UDP listening on %s:%d and %d",
      this.host,
      this.ports.primary,
      this.ports.secondary
    );
  }

  close(): void {
    for (const socket of this.sockets) {
      socket.close();
    }
  }

  private bind(port: number): Promise<dgram.Socket> {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket("udp4");
      socket.once("error", reject);
      socket.bind(port, this.host, () => {
        this.sockets.push(socket);
        resolve(socket);
      });
    });
  }
}
