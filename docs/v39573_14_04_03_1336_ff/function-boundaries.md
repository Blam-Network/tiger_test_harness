# ff 39573 function boundaries

The function boundaries of the PS4 ff eboot (`39573.14.04.03.1336.ff`, Clang, SCE ELF) are derived from its unwind info. The IDB was then brought to match.

## Method
1. **Unwind info.** PT_GNU_EH_FRAME (`.eh_frame_hdr`) sits at 0x29DF118, with 85,648 sorted table entries. `.eh_frame` runs from 0x26C2D84 to 0x29DF114 and holds 4,518 CIEs and 106,457 FDEs. 20,809 of the FDEs are discarded COMDAT copies: their pc_begin is 0, so it resolves to the field's own address. The other 85,648 are live and match the hdr table exactly. FDE pointers are pcrel sdata4 (0x1B).
2. **Code pointers.** The R_X86_64_RELATIVE relocations (83,597) have 21,331 targets in text. All of them are FDE starts except 154.
3. **Direct references.** Capstone over every FDE range collects `call rel32` targets, tail `jmp`s and rip-relative `lea`. Every call and tail-jmp target is a function start or a PLT stub. No conditional jump leaves its FDE, and no target lands inside an FDE, so there is no hot/cold splitting.
4. **Gaps.** The text between FDEs is 701,984 bytes of padding (multi-byte NOPs, or zeros after a function) and 245 jump tables (25,988 bytes). The rest is 158 functions with no FDE: init_array static initialisers, their atexit destructors (reached via `lea`), NOP-sled-aligned helpers, and `_init` at 0x400020. Each one's bounds come from recursive descent.

Layout: code from 0x400015 to 0x1FA4473, PLT from 0x1FA4478 to 0x1FA6F58, read-only data from **0x1FA6F60**.

## Counts
FDE coverage is 28,195,221 of 28,984,414 text bytes (97.3%). The truth set has 85,806 functions plus 686 PLT entries.

| IDA before (63,090 functions) | count |
|---|---|
| exact | 44,468 |
| missing | 23,672 (664 of them inside merged functions) |
| end too short | 17,166 (16,506 missing the trailing `nop` after a noreturn `__stack_chk_fail` call, 660 excluding an inline jump table) |
| end too long (padding) | 37 |
| merged | 463 |
| bogus, in rodata | 242 |
| bogus, PLT lazy-bind halves | 29 |
| functions with tail chunks | 48, none legitimate |

All of these were applied: 41,657 logged operations. Every owner keeps its start, so names, prototypes, comments and folders stay where they were. Before IDA reanalysed, 85,806 of 85,806 functions matched exactly.

**Result.** IDA's reanalysis dropped 177 functions (137 one-byte `retn` functions and 40 small ones). Running `reapply_ff_bounds.py` restored them, and they stayed after a second analysis. The final count is 86,492 functions: all 85,806 match the truth exactly, plus 686 PLT entries. Nothing is left over. Rerun the reapply script after any full reanalysis. Run it with its own namespace: `exec(open(p).read(), {'BOUNDS': folder, 'PHASE': 'all'})`.

Scratch files are in the session scratchpad under `naming/ff-bounds/`:
- `ff-truth.json`
- `ff-reconciliation.json` and `ff-reconciliation.md`
- `ff-changes-applied.json`
- `reapply_ff_bounds.py`
- `ff-eh-lsda-frames.json`

## Exceptions and frames
- **Personality.** One `zPLR` CIE uses `__gxx_personality_v0` (an import). The other 4,517 CIEs are `zR`, with no personality.
- **LSDAs.** 42 functions have one: 0x157A0B0 to 0x157DBA0 and 0x1F07C90 to 0x1F0A530. All 42 are in the SCE NP Toolkit library (`sce::Toolkit::NP::*` neighbours); the game code is built without exceptions. Between them they have 368 call sites. 31 functions have catch clauses (122 catch actions), and **every one is `catch (...)`**: the type table entries are 0. Many call sites also carry an empty `throw()` exception spec (filter -1). The parsed tables (call sites, then landing pads, actions and types) are in `ff-eh-lsda-frames.json`.
- **Frames.**
  - 60,817 FDEs (71%) use rbp as the CFA register; 24,831 do not.
  - 24,067 never move the CFA past the return address (leaf or thin functions).
  - The prologue `sub rsp` allocation appears in 29,033 functions: median 40 bytes, p90 520, p99 5,176, maximum 307,288 (0x10E1770).
  - Function size: median 142 bytes, p90 664, maximum 262,619.
