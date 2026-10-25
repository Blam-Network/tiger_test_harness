# GPU command buffer corruption (betath 38464, d1port_betath)

2026-10-23. PS4 pre-alpha 38464.14.02.28.1027.betath (SDK 0x01500111) in `staging/d1port_betath`. IDA: `eboot.elf` on :13346 (same file as `native/out/eboot.elf`, md5 953517f1...), 1.33 `eboot.bin` on :13339. Renderer source: `d1port/gpu/shadps4/video_core`.

## Symptom

Three stops, all on command words that are no command:

| Run log (`native/out/runs/`) | Uptime | Stop |
|---|---|---|
| `windowed-signalfence-224354.log` (= `20261022T134337Z`) | 1550 s | `pm4_cmds.h:491 SignalFence`: EVENT_WRITE_EOP data select outside 0-4 |
| `windowed-exit23-234139.log` (= `20261022T144133Z`) | 776 s | `pm4_cmds.h:513 SignalFence`: EVENT_WRITE_EOP interrupt select 3 |
| `windowed-exit23-000541.log` (= `20261022T150533Z`) | 1250 s | `liverpool.cpp:994`: PM4 type 0, base 0x3304, count field 0x3F02 |

- The uptimes are 13 to 26 minutes, not hours.
- Every crash came in a GPU-bound stretch. The stats lines right before each crash read 40 to 77 ms frames, 8,600 to 10,900 draws and 41 to 46 submissions a frame. The line "the GPU command thread queued it 36 to 63 ms after the ask" means the parse runs about a frame or more behind the guest's submits. Stage A also waits for stage B about half the time ("stage A waited 46-51%").
- The type-0 header is `0x3F023304`, which is float data (0.5086), not a command.
- The same runs also logged, minutes before their crash:
  - `NextPacket: packet length exceeds remaining submission size. Packet dword count=4545, remaining 6` (000541 at 987 s; also `20261022T140313Z`, count 4526, remaining 6). This is a type-3 header (NOP-sized: 4544 body words) six words before the end of its submission.
  - `sceGnmSubmitCommandBuffersForWorkload: Submitting a null DCB 2` (224354 twice). Both times it came right after `cui:c_surface_allocator: Surface not allocated`.
- Runs are clean apart from these. Disabled optimizations were `mask=24576` (DrawPreparation and DeferredStreamCopies off), with 0 draw-preparation workers.

## How the parse reaches the command buffer

- `sceGnmSubmitCommandBuffers` / `SubmitAndFlip` (`gnmdriver.cpp` PerformSubmit) calls `Liverpool::SubmitGfx(dcb, ccb)` once for each DCB/CCB pair. With `BB_COPY_GPU_BUFFERS` off (the default) the spans point into **guest memory**. SubmitGfx only creates the `ProcessGraphics` coroutine (it starts suspended) and queues it.
- The GPU command thread (stage A) runs the queued tasks in order and reads each packet from guest memory when it reaches it. With the betath GPU-bound, that is tens of milliseconds after the submit. Nested IBs and the CCB (`ProcessCeUpdate`) are read live as well.
- Packets that write guest memory or signal go through the draw pipe (`Rasterizer::RunInOrder`). Their **bytes are copied** into the pipe, and stage B (the draw recording thread) runs them later in stream order. EOP and EOS labels are written by stage B, or deferred to the Vulkan recording thread (RecorderFences). So a label is never written before stage A has parsed the packets before it. The labels are always written later than the parse, not earlier.
- `NotePendingFences` calls `SignalFence` on stage A at parse time (with a logging lambda). So an EOP whose selects are bad in guest memory stops stage A first. Neither crash log says which thread stopped.
- `PM4Type3Header::NumWords` is `(count + 1) & 0x3fff`. A count of 0x3FFF makes a 1-word packet, which is the hardware's NOP pad rule (Mesa `PKT3_NOP_PAD`), so it is not a bug. Every packet advances by `count + 2`, except the PRED_EXEC/COND_EXEC skips, which add their exec counts. I found no packet handled with a fixed size that could misalign a well-formed stream.

## How the betath frees its command memory (IDA :13346)

- **Submission thread** `sub_BF1ED0`: drains a 64-entry record queue (`device+152`, write index +664, read index +668).
  - A record holds up to 32 DCB/CCB chunks (+48 DCB pointers, +304 CCB pointers, +560 / +688 sizes, +36 count, +40 flip flag).
  - Before each submit it spins (300 µs sleeps) until `*label - device[+148] >= 0`. `label` is `qword_2F74F70[4]`, and +148 is the end value of the frame before last. So the guest submits at most about two frames past the last **EOP the GPU wrote**.
  - If a flip submit returns an error it logs "Had to throw away a frame because submit returned a GnmDriver Error". It then rebuilds a minimal DCB in the **same chunk memory** and submits again. A plain submit error is ignored and the record is dropped.
- **Ring memory** for chunks and embedded allocations (`qword_2F74F70`, `sub_C04220` / `sub_C03FD0` / `sub_C03B20` / `sub_C03DA0`):
  - There are 512 segment slots, one per record. A slot holds `seq + 0x80000` while it is open. On close, `sub_C03FD0` sets it to `seq` and appends `EVENT_WRITE_EOP(label := seq)` (`sub_1502410`, header 0xC0044700) to that record's DCB.
  - Segments retire oldest first while `label - slot >= 0`. When it runs short of memory the guest waits in `sub_C03DA0` and logs `graphics:commandbuffer: RUNNING OUT OF GRAPHICS COMMANDBUFFER MEMORY (type %d)`.
  - Records here are begun and closed by one context (`sub_C12690`, `xmmword_30B2D20`), so seq order is the same as submit order.
  - Conclusion: the guest frees command memory through the label written by our EOP, in order. If the only reuse path is this one, it cannot overwrite a DCB that stage A has not parsed yet.
- **Embedded data** (`sub_15011A0`): a NOP header `0xC0001000 | (pad + n) << 16`, a marker `0x6875xxxx`, then the data. These are inline allocations inside the DCB, skipped as NOP payload.
- **Frame pacing** (`sub_BFBF80`, called each frame from `sub_C02460`): `while (flipStatus.gcQueueNum > 2) sleep 1 ms`. 1.33 has the same loop (`sub_7E5450` on :13339, `gcQueueNum < 3`).
- Imports: betath's GNM list adds `sceGnmAreSubmitsAllowed`, `DingDong`, `Map/UnmapComputeQueue`, `RequestFlipAndSubmitDone`, `ValidateCommandBuffers`, `FlushGarlic`, `DeleteEqEvent`, `GetEqEventType/TimeStamp`, the MipStats, Razor and SQ-counter calls, `SetGsRingSizes` and `GetTheTessellationFactorRingBufferBaseAddress` to the 1.33 list. Its submit entry points are the same `SubmitCommandBuffers` / `SubmitAndFlipCommandBuffers` / `SubmitDone`. No compute queue showed up in the logs ("0 dispatches"; the only DingDong caller is `sub_1523500`), and no `0xC0023F00` (INDIRECT_BUFFER) header constant was found in the eboot.

## Divergences found (renderer identical to 1.33's apart from the EOP log change)

1. **gcQueueNum is never above ~1, and that throttle is the guest's pacing.**
   - On hardware, `sceGnmSubmitAndFlipCommandBuffers` queues the flip at submit time, so `gcQueueNum` and `flipPendingNum` count frames the GPU has not reached yet.
   - shadPS4 counts the flip only when stage A parses the patched flip NOP (`sceVideoOutSubmitEopFlip` only registers a GfxFlip handler; `SubmitFlip(is_eop)` increments at the IRQ). It then drops the count at present.
   - So `sub_BFBF80` never waits, and the guest is held back only by the label waits above. Any guest memory recycled by frame count rather than by label can be reused while the parse is still behind. 1.33 has the same code but is not GPU-bound, so it is rarely behind.
   - Not changed yet: it changes pacing for both lineages. It is the first fix to try if the guard (below) shows rewrites.
2. **`SubmitGate` off (patch group 17) and `VoLabelAtSubmit`.** Neither lets the guest touch command memory: the first only stops parking the guest's next submit, and the second clears a display buffer's label early. Their comments assume the guest paces itself on labels. That holds for the ring above, but not for anything paced by gcQueueNum.
3. **`BB_COPY_GPU_BUFFERS` is unsafe as it stands.** It copies into one 2 MiB per-frame buffer that `SubmitDone` rewinds to offset 0. The next frame's submits then overwrite copies that stage A has not parsed yet when it is behind, which is the same corruption. It also asserts past 2 MiB.
4. **Null DCB.** A zero-sized chunk at index 2 makes `sceGnmSubmitCommandBuffers` reject the **whole** record (DCBs 0, 1, ...), and the betath ignores the error.
   - Lost work only, with no corruption: later labels pass the dropped seq.
   - It is unknown whether the 1.50 driver rejects or skips an empty chunk. Worth checking, since the whole frame chunk is lost.
5. **Occlusion landings** (`vk_occlusion_query.cpp`) write `count | bit63` into guest ZPASS blocks up to 3 guest frames late. Guarded by generation and age. The values are small counts, which do not match `0x3F023304`. Unlikely, but logged as source `ZPASS` in BB_WRITE_LOG.

## Most likely cause

Hypothesis (a), command words read after the guest reused their memory, fits best:

- The three bad words are each plausible as newer guest content at an old submission's offset: float data, a NOP header longer than the remainder, and EOP control bits. They are not a misparse of a well-formed stream, since the length math is sound.
- They only appear when stage A runs a frame or more behind the guest.
- The renderer is the same as 1.33's, which is not GPU-bound.

The ring of segments is label-safe as far as I traced it. So the reuse is either through memory the guest recycles by frame count (divergence 1), or through a path not yet found.

It is not pinned statically. Ruling out (b), guest-side bad words or a misparse, and (c)/(d), the draw pipe's copy of the packet being corrupted, needs one run with the guard below.

## Instrumentation and mitigation (applied, unbuilt)

`BB_DCB_GUARD` in `d1port/gpu/shadps4/video_core/amdgpu/liverpool.cpp` and `liverpool.h`, plus `BbWriteLog::DumpRange` in `d1port/gpu/shim/bbport_write_log.{h,cpp}`:

- **SubmitGfx** copies every top-level DCB and CCB inside the guest's submit call (`DcbSnapshot`, one heap copy per submission, freed with its task). It keeps a registry of the last 256 submissions.
- **Default (unset or `1`)**: the parse still reads guest memory, but `memcmp`s each packet with the copy. NOP payloads are excluded because they are embedded data, and so is the REWIND valid bit. On a difference it reports `DCB guard: the guest rewrote this packet after submitting it...` and parses the rest of that submission from the copy, so the stop does not happen.
- **`copy`**: every submission is parsed from its copy. REWIND still polls guest memory.
- **`0`**: off, the old behaviour.
- **Invalid packets** are reported before the existing stop or log: type 0 or 1, unknown opcode (DCB and CCB), EOP with undefined selects at parse time, and a packet longer than its submission. Each report gives:
  - the submission id, its address and size, the packet's dword offset, and the milliseconds since its submit;
  - whether it was parsed from memory or the copy, and how many dwords of guest memory differ from the submitted words (first offset);
  - the 8 words before and 16 after, in memory and in the copy;
  - the last 48 packets parsed (D/C, address, offset, header, opcode, length);
  - with `BB_WRITE_LOG=1|2`, the logged GPU-side writes into that submission's range.
  - Reports are capped at the first 32, then every 256th.
- **`RunEventWriteEop`** (stage B) logs `EVENT_WRITE_EOP with undefined selects on the draw recording thread` when the pipe's copy is bad.
- **Cost**: one memcpy per submission on the guest thread (a few MB per frame), and one memcmp per packet on stage A.

## Build and test

1. Build d1port_betath as usual. The startup log should print `GPU: command buffer guard on: packets checked against the submitted copy`.
2. Play the heavy scenes (orbit, patrol) for 30+ minutes, then `grep -n "DCB guard\|undefined selects" native/out/runs/<run>.log`.
3. Read the outcome:
   - **`the guest rewrote this packet after submitting it`** (no stop): (a) is confirmed, and the guard already keeps the run alive. Next step: fix divergence 1, counting EOP flips in `gcQueueNum`/`flipPendingNum` at `sceVideoOutSubmitEopFlip` time and not double-counting in `SubmitFlip(is_eop)`. Then rerun and expect the reports to stop.
   - **A stop with a guard report that says "parsed from guest memory" and "differs ... in 0 dwords"**: the guest submitted those words, which is (b). The packet trail shows what came before. Check for an indirect buffer ("not inside a guarded submission") and for the null-DCB path.
   - **`undefined selects on the draw recording thread` with no guard report just before it**: the draw pipe's copy was corrupted (c/d). Look at the `vk_draw_pipe.h` ring wrap and `RunInOrder`.
4. For an A/B, run `BB_DCB_GUARD=copy`. For the writer, add `BB_WRITE_LOG=2`: cheap decode-time intents show EOP, WriteData and EOS targets inside the DCB range.

Original files before the edit are in the session scratchpad (`orig/`). The diff touches only `liverpool.cpp`, `liverpool.h` and `bbport_write_log.{h,cpp}`.
