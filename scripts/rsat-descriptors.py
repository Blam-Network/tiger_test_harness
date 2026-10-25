#!/usr/bin/env python3
# Dumps the RSAT schema descriptors from a PS4 Destiny eboot (plaintext ELF, x86-64).
# Layout notes: docs/v40662_14_05_19_1414_pubalpha/rsat-descriptors.md
#
#   python scripts/rsat-descriptors.py eboot.bin --out rsat-descriptors.json

import argparse
import hashlib
import json
import re
import struct

STRUCT_DEF = 0x8080010A  # meta schema of a struct definition (self-describing)
HEADER_SIZE = 0x78
MEMBER_SIZE = 0x28

KIND_NAMES = {
    0: "none",  # no wire bits (in-memory only, e.g. the def's own sid field)
    1: "nested",
    2: "bool",
    3: "i8",
    4: "i16",
    5: "i32",
    6: "u64",
    7: "u8",
    8: "u16",
    9: "u32",
    10: "u64b",  # second 64-bit kind, same codec as 6
    11: "real32",
    12: "raw64",
    24: "variant",  # 6-bit kind tag, then that kind's codec
}
INT_KINDS = {3: (True, 8), 4: (True, 16), 5: (True, 32), 7: (False, 8), 8: (False, 16), 9: (False, 32), 6: (False, 64), 10: (False, 64)}


class Image:
    def __init__(self, data):
        self.data = data
        if data[:4] != b"\x7fELF" or data[4] != 2 or data[5] != 1:
            raise SystemExit("not a 64-bit little-endian ELF")
        phoff = self.q(0x20)
        phnum = self.h(0x38)
        self.loads, self.dynamic, self.dynlib = [], None, None
        for i in range(phnum):
            p_type, _, off, va, _, filesz, memsz, _ = struct.unpack_from("<IIQQQQQQ", data, phoff + 56 * i)
            if p_type == 1:
                self.loads.append((va, off, filesz, memsz))
            elif p_type == 2:
                self.dynamic = (off, filesz)
            elif p_type == 0x61000000:  # PT_SCE_DYNLIBDATA
                self.dynlib = off
        self.relocs = self._relocs()

    def q(self, off):
        return struct.unpack_from("<Q", self.data, off)[0]

    def h(self, off):
        return struct.unpack_from("<H", self.data, off)[0]

    def off(self, va):
        for base, off, filesz, _ in self.loads:
            if base <= va < base + filesz:
                return off + va - base
        return None

    def read(self, va, n):
        o = self.off(va)
        return self.data[o:o + n] if o is not None else bytes(n)

    def u32(self, va):
        return struct.unpack("<I", self.read(va, 4))[0]

    def u64(self, va):
        return struct.unpack("<Q", self.read(va, 8))[0]

    def cstr(self, va):
        o = self.off(va)
        return self.data[o:self.data.index(b"\0", o)].decode("latin1")

    def _relocs(self):
        # pointers in .data are zero in the file; R_X86_64_RELATIVE entries fill them at load
        if not self.dynamic or self.dynlib is None:
            return {}
        tags = {}
        off, size = self.dynamic
        for i in range(0, size, 16):
            tag, val = struct.unpack_from("<qQ", self.data, off + i)
            tags.setdefault(tag, val)
        rela, relasz = tags.get(0x6100002F), tags.get(0x61000031)  # DT_SCE_RELA / RELASZ
        out = {}
        if rela is None:
            return out
        for i in range(relasz // 24):
            where, info, addend = struct.unpack_from("<QQq", self.data, self.dynlib + rela + 24 * i)
            if info & 0xFFFFFFFF == 8:
                out[where] = addend
        return out

    def segments(self):
        for va, off, filesz, _ in self.loads:
            yield va, self.data[off:off + filesz]


def find_registry(img):
    # schema memory: u64 count then count x {i64 self-relative record offset, i16 table, u16 index, u32 0}
    best = None
    for va, seg in img.segments():
        n = len(seg) // 8
        words = struct.unpack_from("<%dQ" % n, seg)
        for i in range(0, n - 9):
            count = words[i]
            if not 1000 <= count <= 0x6000:
                continue
            ok = True
            for k in range(4):
                rel, tail = words[i + 1 + 2 * k], words[i + 2 + 2 * k]
                if not (0 < rel < 0x1000000 and tail >> 32 == 0 and tail & 0xFFFF < 3 and (tail >> 16) & 0xFFFF < 0x2000):
                    ok = False
                    break
            if ok and (best is None or count > best[1]):
                best = (va + 8 * i, count)
    if not best:
        raise SystemExit("schema registry not found")
    return best


def member(img, va):
    off, packed, dirty, weight, kind, optional, pad, sid = struct.unpack("<IIIfbBHI", img.read(va, 0x18))
    params = img.read(va + 0x18, 16)
    p = struct.unpack("<4I", params)
    m = {
        "offset": off,
        "packedOffset": packed,
        "dirtyIndex": dirty,
        "weight": weight,  # f32 at +0x0C, 0.5 almost everywhere; true name unknown
        "kind": kind,
        "kindName": KIND_NAMES.get(kind, f"kind{kind}"),
        "optional": bool(optional),
        "nested": f"{sid:08x}" if sid != 0xFFFFFFFF else None,
        "params": [f"{x:08x}" for x in p],
        "raw": img.read(va, MEMBER_SIZE).hex(),
    }
    if pad:
        m["pad"] = pad
    if kind in INT_KINDS:
        m.update(signed=INT_KINDS[kind][0], bias=p[0], bits=p[1])
    elif kind == 11:
        lo, hi = struct.unpack("<ff", params[:8])
        m.update(min=lo, max=hi, bits=p[2], quantized=0 < p[2] < 32)
    elif kind == 1 and params[0] == 1:
        m["array"] = {"countOffset": p[1]}
    return m


def descriptor(img, va, handle, handles):
    size = img.u64(va)
    hdr = img.read(va, HEADER_SIZE)
    checksum, hash2, unk10, base = struct.unpack_from("<IIQI", hdr, 8)
    sizes = list(struct.unpack_from("<4I", hdr, 0x1C))
    aligns = list(struct.unpack_from("<4I", hdr, 0x2C))
    rel = img.u64(va + 0x70)
    d = {
        "address": f"0x{va:x}",
        "recordSize": size,
        "table": (handle >> 13) & 3,
        "index": handle & 0x1FFF,
        "checksum": f"{checksum:08x}",
        "hash2": f"{hash2:08x}",
        "base": f"{base:08x}" if base != 0xFFFFFFFF else None,
        # four per-platform layouts: [0] equals the x360 .schmr size, [3] the PS4 definition size;
        # [1] (64-bit) and [2] (32-bit) are platforms not identified
        "sizes": sizes,
        "aligns": aligns,
        "flags": [f"{x:08x}" for x in struct.unpack_from("<4I", hdr, 0x3C)],  # +0x48 holds a 0x64/0x68 ordinal
        "header": hdr.hex(),
    }
    if unk10:
        d["unknown10"] = unk10
    end = va + size
    defva = va + 0x70 + rel if rel and rel < size else None
    attr_end = defva - 4 if defva else end
    attrs = img.read(va + HEADER_SIZE, max(0, attr_end - va - HEADER_SIZE))
    if attrs:
        # tagged objects between the header and the definition (base links, aliases); kept raw
        d["attributes"] = attrs.hex()
        d["attributeTypes"] = [f"{w:08x}" for (w,) in struct.iter_unpack("<I", attrs[: len(attrs) // 4 * 4]) if w in handles]
    if defva is None:
        d["members"] = []
        return d
    deftype = img.u32(defva - 4)
    count, sid, size64, packed, dirty_bits = struct.unpack("<QIIII", img.read(defva, 0x18))
    if deftype != STRUCT_DEF or sid != handle:
        raise SystemExit(f"{handle:08x}: unexpected definition {deftype:08x}/{sid:08x} at 0x{defva:x}")
    if defva + 0x18 + count * MEMBER_SIZE > end:
        raise SystemExit(f"{handle:08x}: members overrun record")
    d.update(definition=f"0x{defva:x}", size64=size64, packedSize=packed, dirtyBits=dirty_bits)
    d["members"] = [member(img, defva + 0x18 + MEMBER_SIZE * i) for i in range(count)]
    tail = defva + 0x18 + count * MEMBER_SIZE
    if tail < end:
        d["trailing"] = img.read(tail, end - tail).hex()
    return d


def resolve_arrays(cat):
    for d in cat.values():
        ms = d["members"]
        for m in ms:
            a = m.get("array")
            if not a:
                continue
            counts = [i for i, c in enumerate(ms) if c["offset"] == a["countOffset"] and c is not m]
            if counts:
                c = ms[counts[0]]
                a["countMember"] = counts[0]
                a["lengthBits"] = c.get("bits")
            container = cat.get(m["nested"])
            if container:
                a["max"] = len(container["members"])
                kinds = {(e["kind"], e["nested"], e.get("bits"), e.get("bias"), e["optional"]) for e in container["members"]}
                a["uniformElements"] = len(kinds) == 1


def ah_messages(img, by_checksum):
    # cmp-free switch: mov rax, mask; bt rax, rdi; jnb; movsxd rax, edi; lea rcx, table; jmp [rcx+rax*8]
    sw = re.compile(rb"\x48\xB8(.{8})\x48\x0F\xA3\xF8\x73.\x48\x63\xC7\x48\x8D\x0D(.{4})\xFF\x24\xC1", re.S)
    names = re.compile(rb"\x48\x63\xC7\x48\x8D\x0D(.{4})\x48\x8B\x04\xC1\xC3", re.S)
    stub = re.compile(rb"\x48\x8D\x05(.{4})\x48\x8B\x00\x8B\x00\xC3", re.S)
    va, seg = next(img.segments())
    sm = list(sw.finditer(seg))
    if len(sm) != 1:
        return None
    m = sm[0]
    mask = struct.unpack("<Q", m.group(1))[0]
    lea = va + m.start() + 19
    table = lea + 7 + struct.unpack("<i", m.group(2))[0]
    # message name getter sits just before the switch function
    nm = None
    for n in names.finditer(seg, max(0, m.start() - 0x40), m.start()):
        nm = va + n.start() + 3 + 7 + struct.unpack("<i", n.group(1))[0]
    # {&class_handle_global, hash} pairs; the static class table that schema_system_initialize matches
    hash_of = {}
    for where, target in img.relocs.items():
        h = img.u32(where + 8)
        if h in by_checksum and img.u32(where + 12) == 0:
            hash_of.setdefault(target, h)
    out = []
    count = mask.bit_length()
    for i in range(count):
        e = {"id": i, "name": img.cstr(img.relocs[nm + 8 * i]) if nm and nm + 8 * i in img.relocs else None}
        if mask >> i & 1:
            s = img.relocs.get(table + 8 * i)
            sb = img.read(s, 14) if s else b""
            sm2 = stub.match(sb)
            if sm2:
                slot = s + 7 + struct.unpack("<i", sm2.group(1))[0]
                g = img.relocs.get(slot)
                h = hash_of.get(g)
                e.update({"stub": f"0x{s:x}", "global": f"0x{g:x}" if g else None, "checksum": f"{h:08x}" if h else None})
                e["schema"] = by_checksum.get(h)
        out.append(e)
    return {"nameTable": f"0x{nm:x}" if nm else None, "switch": f"0x{va + m.start():x}", "jumpTable": f"0x{table:x}", "messages": out}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("eboot")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    data = open(args.eboot, "rb").read()
    img = Image(data)
    reg, count = find_registry(img)
    entries = []
    for k in range(count):
        e = reg + 8 + 16 * k
        rel, table, index = struct.unpack("<qhH", img.read(e, 12))
        entries.append((0x80800000 | table << 13 | index, e + rel))
    handles = {h for h, _ in entries}
    cat = {}
    for h, va in sorted(entries, key=lambda x: x[1]):
        cat[f"{h:08x}"] = descriptor(img, va, h, handles)
    resolve_arrays(cat)
    by_checksum = {int(d["checksum"], 16): k for k, d in cat.items()}
    out = {
        "source": {"sha256": hashlib.sha256(data).hexdigest(), "registry": f"0x{reg:x}", "count": count},
        "kinds": {str(k): v for k, v in KIND_NAMES.items()},
        "activityHostMessages": ah_messages(img, by_checksum),
    }
    # one descriptor per line keeps the file diffable without tripling its size
    body = json.dumps(out, indent=1)[:-2]
    lines = [f" {json.dumps(k)}: {json.dumps(v, separators=(',', ':'))}" for k, v in sorted(cat.items())]
    with open(args.out, "w") as f:
        f.write(body + ',\n "descriptors": {\n' + ",\n".join(lines) + "\n }\n}\n")
    print(f"{count} descriptors, {sum(1 for d in cat.values() if d['members'])} with members -> {args.out}")


if __name__ == "__main__":
    main()
