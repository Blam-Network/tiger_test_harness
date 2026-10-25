# IDAPython: names virtual functions after the class whose vtable introduces
# them, from the eboot's Itanium RTTI. sub_D6E270 in c_debug_director's vtable
# becomes c_debug_director::sub_D6E270. Run it from File > Script file in an
# IDB of a PS4 Destiny eboot (betath, ff, Alpha Trial).
#
# - Only default names (sub_XXXX) are touched; a name you gave stays.
# - A function in several vtables belongs to the most-base class among them,
#   the one that introduced it. One shared by unrelated classes (a common
#   `ret` stub, or identical bodies the linker folded) is left alone.
# - Vtables and typeinfos get Class::vftable / Class::typeinfo when unnamed.
# - IDA never found most virtual functions (nothing pointed at them), so a
#   slot whose target no function holds becomes a function first.
# - DRY_RUN = True prints what it would do without renaming.
#
# IDA loads the eboot without applying its SCE relocations, so the pointers
# in vtables and typeinfos read as 0. The script reads them from the ELF:
# the IDB's input file, or one you pick.
import os
import struct
from collections import Counter, defaultdict

import ida_bytes
import ida_funcs
import ida_kernwin
import ida_name
import ida_nalt
import ida_segment

DRY_RUN = globals().get("DRY_RUN", False)
NAME_TABLES = globals().get("NAME_TABLES", True)

R_X86_64_64 = 1
R_X86_64_RELATIVE = 8
PT_LOAD = 1
PT_SCE_RELRO = 0x61000010
PT_DYNAMIC = 2
PT_SCE_DYNLIBDATA = 0x61000000
DT_SCE_RELA = 0x6100002F
DT_SCE_RELASZ = 0x61000031


def elf_path():
    path = ida_nalt.get_input_file_path()
    if path and os.path.exists(path):
        return path
    return ida_kernwin.ask_file(False, "*.elf;*.bin", "The eboot this IDB was made from")


# {offset: target} for RELATIVE relocations, {offset: symbol index} for 64-bit
# symbol ones (imports, such as the abi typeinfo vtables and the pure virtual
# stub).
def read_relocations(path):
    with open(path, "rb") as f:
        d = f.read()
    (phoff,) = struct.unpack_from("<Q", d, 0x20)
    (phnum,) = struct.unpack_from("<H", d, 0x38)
    ph = [struct.unpack_from("<IIQQQQQQ", d, phoff + i * 56) for i in range(phnum)]
    dyn = next(p for p in ph if p[0] == PT_DYNAMIC)
    dynlib = next(p for p in ph if p[0] == PT_SCE_DYNLIBDATA)[2]
    tags = defaultdict(list)
    for i in range(0, dyn[5], 16):
        t, v = struct.unpack_from("<QQ", d, dyn[2] + i)
        tags[t].append(v)
    rel, sym = {}, {}
    start, size = tags[DT_SCE_RELA][0], tags[DT_SCE_RELASZ][0]
    for i in range(0, size, 24):
        offset, info, addend = struct.unpack_from("<QQq", d, dynlib + start + i)
        kind = info & 0xFFFFFFFF
        if kind == R_X86_64_RELATIVE:
            rel[offset] = addend
        elif kind == R_X86_64_64:
            sym[offset] = info >> 32
    return rel, sym


def cstring(ea):
    raw = ida_bytes.get_bytes(ea, 512)
    if not raw:
        return None
    raw = raw.split(b"\0")[0]
    try:
        return raw.decode()
    except UnicodeDecodeError:
        return None


def pretty(mangled):
    if not mangled or not (mangled[0].isdigit() or mangled[0] == "N"):
        return None
    shown = ida_name.demangle_name("_ZTS" + mangled, 0)
    prefix = "`typeinfo name for'"
    if shown and shown.startswith(prefix):
        return shown[len(prefix) :]
    return None


# The code segment also holds the read-only data (strings, tables).
def in_code(ea):
    seg = ida_segment.getseg(ea)
    if seg is None or seg.type != ida_segment.SEG_CODE:
        return False
    return not ida_bytes.is_data(ida_bytes.get_flags(ea))


# A typeinfo is {abi vtable (import), name, ...}; the abi classes are the
# three imports most often followed by a name pointer.
def find_typeinfos(rel, sym):
    named = {}
    for at, s in sym.items():
        target = rel.get(at + 8)
        if target is None:
            continue
        name = pretty(cstring(target))
        if name:
            named[at] = (s, name)
    abi = Counter(s for s, _ in named.values())
    kinds = {s for s, n in abi.most_common(3) if n >= 10}
    return {at: name for at, (s, name) in named.items() if s in kinds}


# si: one base at +16. vmi: flags u32 at +16, count u32 at +20, then
# {base, offset_flags} pairs from +24. class: none.
def base_classes(typeinfos, rel):
    bases = {}
    for ti in typeinfos:
        if rel.get(ti + 16) in typeinfos:
            bases[ti] = [rel[ti + 16]]
            continue
        found = []
        count = ida_bytes.get_dword(ti + 20)
        if 0 < count < 64:
            for j in range(count):
                b = rel.get(ti + 24 + 16 * j)
                if b in typeinfos:
                    found.append(b)
        bases[ti] = found
    return bases


def ancestors(ti, bases, memo):
    if ti not in memo:
        seen = {ti}
        for b in bases.get(ti, []):
            seen |= ancestors(b, bases, memo)
        memo[ti] = seen
    return memo[ti]


# A vtable is {offset_to_top, typeinfo, slots...}. A typeinfo pointer inside
# another typeinfo (a base) is not one.
def find_vtables(typeinfos, bases, rel, sym):
    inside = set()
    for ti, bs in bases.items():
        inside.add(ti + 16)
        for j in range(len(bs)):
            inside.add(ti + 24 + 16 * j)
    heads = []
    for at, target in rel.items():
        if target in typeinfos and at not in inside:
            top = struct.unpack("<q", struct.pack("<Q", ida_bytes.get_qword(at - 8)))[0]
            if at - 8 not in rel and -0x100000 < top <= 0:
                heads.append((at + 8, target, top))

    def slot(p):
        target = rel.get(p)
        return target if target is not None and in_code(target) else None

    # The pure virtual stub is an import: the one most often sitting between
    # two function slots.
    gaps = Counter()
    for start, _, _ in heads:
        p = start
        while slot(p) is not None:
            p += 8
        if p in sym and p not in typeinfos and slot(p + 8) is not None:
            gaps[sym[p]] += 1
    pure = gaps.most_common(1)[0][0] if gaps and gaps.most_common(1)[0][1] >= 5 else None

    tables = []
    for start, ti, top in heads:
        slots, p = [], start
        while True:
            f = slot(p)
            if f is not None:
                slots.append(f)
            elif pure is None or p in typeinfos or sym.get(p) != pure:
                break
            p += 8
        tables.append((start, ti, top, slots))
    return tables


# A name an earlier run of this script gave as Class__x is redone as Class::x.
def ours(ea, name):
    flat = ida_name.validate_name(name, ida_name.VNT_IDENT).replace("::", "__")
    return ida_name.get_name(ea) == flat


def unnamed(ea, name):
    if ours(ea, name):
        return True
    return not ida_name.get_name(ea) or ida_bytes.has_dummy_name(ida_bytes.get_flags(ea))


# Template arguments can't go in a name; '::' can. SN_NOCHECK would turn
# '::' into '__' where ':' isn't a name character.
def rename(ea, name):
    name = ida_name.validate_name(name, ida_name.VNT_IDENT)
    if DRY_RUN:
        return True
    return ida_name.set_name(ea, name, ida_name.SN_NOWARN)


def main():
    path = elf_path()
    if not path:
        print("vtable names: no ELF, nothing done")
        return
    rel, sym = read_relocations(path)
    typeinfos = find_typeinfos(rel, sym)
    bases = base_classes(typeinfos, rel)
    tables = find_vtables(typeinfos, bases, rel, sym)
    owners = defaultdict(set)
    for _, ti, _, slots in tables:
        for f in slots:
            owners[f].add(ti)

    named = shared = kept = created = inside = 0
    examples = []
    memo = {}
    for f, classes in owners.items():
        holder = ida_funcs.get_func(f)
        if holder is not None and holder.start_ea != f:
            # Inside a function IDA already has: its bounds are wrong, leave it.
            inside += 1
            continue
        # The introducing class is the one every other holder derives from.
        owner = [
            c for c in classes if all(c in ancestors(o, bases, memo) for o in classes)
        ]
        if len(owner) != 1:
            shared += 1
            continue
        if holder is None:
            if not DRY_RUN and not ida_funcs.add_func(f):
                continue
            created += 1
        current = ida_name.get_name(f) if holder is not None else f"sub_{f:X}"
        new = f"{typeinfos[owner[0]]}::sub_{f:X}"
        if not current.startswith("sub_") and not ours(f, new):
            kept += 1
            continue
        if rename(f, new):
            named += 1
            if len(examples) < 10:
                examples.append(new)

    tables_named = 0
    if NAME_TABLES:
        for start, ti, top, _ in tables:
            label = "vftable" if top == 0 else f"vftable_{-top:x}"
            name = f"{typeinfos[ti]}::{label}"
            if unnamed(start, name) and rename(start, name):
                tables_named += 1
        for ti, name in typeinfos.items():
            name = f"{name}::typeinfo"
            if unnamed(ti, name):
                rename(ti, name)

    verb = "would name" if DRY_RUN else "named"
    print(
        f"vtable names: {len(typeinfos)} typeinfos, {len(tables)} vtables, "
        f"{len(owners)} virtual functions; {verb} {named}, "
        f"{shared} shared by unrelated classes (left), {kept} already named (left), "
        f"{inside} inside another function (left), {created} made functions, "
        f"{tables_named} vtables {verb}"
    )
    for e in examples:
        print("  ", e)


# IDA shows a name's ':' as '_' unless ':' is a name character, which it
# isn't by default for these eboots. This lasts for the IDA session; put the
# same line in idapythonrc.py to keep it.
colon = ord(":")
ida_name.set_cp_validity(ida_name.UCDR_NAME, colon, colon + 1, True)
main()
