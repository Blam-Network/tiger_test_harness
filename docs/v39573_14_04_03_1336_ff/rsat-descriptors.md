# RSAT descriptors, PS4 39573.14.04.03.1336.ff

2026-10-23. `D:/Games/ps4/ff-39573/eboot.bin` (sha256 `c45ad51d…2eb44f`), the decrypted eboot of the "Music Player
Demo" dump (CUSA00515). Plaintext x86-64 ELF, IDA address = ELF vaddr. Catalog: `rsat-descriptors.json` from
`python scripts/rsat-descriptors.py <eboot.bin> --out …`. Record and member layout, walkers and kind codecs are
described in `docs/v40662_14_05_19_1414_pubalpha/rsat-descriptors.md`; the script reads this build unchanged.

## This build
- Registry at **0x1FA70E0**, **17957** handles (tables 0/1/2 hold 6274/4856/6827). 4652 records carry a
  definition (515 of them with no members), 85 array members. sizes[3] equals the definition size in every case.
- `activityHostMessages` is null, as for betath: there is no bit-test switch like the Alpha Trial's sub_710E40.
  The message names are at **0x2C3C040** (43 entries, getter sub_183B290 asserts `id < 0x2B` at 0x183B2A9), the same
  43 names in the same order as the Alpha Trial and betath. Message id → schema is in `signon-demonware.md` §6.

## Against the other builds
- Handles are numbered per build. Compare by `checksum` (the queuez `headerChecksum`), not by handle.
- betath (38464): 16214 checksums in common. Of 4652 ff definitions, 4232 have a betath definition with the same
  checksum and 3652 of those have identical members (nested handles aside, which renumber); 420 checksums are ff
  only, 370 betath only.
- Alpha Trial (40662): only 1728 checksums in common (all at the same handle). The Alpha Trial rehashed its
  schemas; ff is betath's family.
