# Private activity host lost in cosmo_portal_1 (betath 38464)

2026-10-23. PS4 pre-alpha 38464.14.02.28.1027.betath, native client d1port_betath, IDA `eboot-ida.elf` (headless :13345, read only).
Run: client `staging/d1port_betath/native/out/runs/windowed-20261022T192753Z-exit23.log`, server `logs/start-betath-20261022-221632.out`.
The GPU DCB assert that ended the run comes later and is a separate issue.

## Symptom

Client log 13161-13182:

- `RecordPacket: host socket 10468: receive of 6 bytes failed, host errno 10053 (WSAECONNABORTED)`, then `sys_recvfrom: s = 44 returned error code: 53` (ECONNABORTED).
- `'PRIVATE CURRENT' activity client lost its connection to BAP` -> KTO `error.lost_private_activity_host`.
- KTOBUCKET: `BAP OUT FAH _dead last failure -> '_connection_failure_failed_to_read_unknown'`, and `GAH0 _authenticating` on the same 127.0.0.1:37001.

`_unknown` means the read returned an error. A clean end of stream (recv 0) would read `_connection_failure_failed_to_read_endpoint_closed` (string at 0x2577451).

## Which socket is which

| Server line | Remote | Socket |
|---|---|---|
| 28009-28018 | 127.0.0.3:11599 | FAH, `ah=0xd5216c54308acf05` (rebound after orbit). Client `s = 44`, host socket 10468 |
| 29455-29465 | :4239 | GAH `0x10392b3573819b9e` (cosmo public host) |
| 29584 | :4248 | new GAH0 (matchmaking session 0x...0053). It connected but never sent its start request. Client `sys_socketex` at line 13160 |
| 29669 / 29725 | :32774 / :32775 | FAH again and GAH `0x81a74f760f58bd5d`, both after the KTO (the player's return to cosmo_portal_1) |

`0x81a74f760f58bd5d` only appears after the loss. Its teardown at 30151+ (`read ECONNRESET` on every socket at once) is the client process dying on the GPU assert. It has nothing to do with this loss.

## Sequence (server 29289-29586)

1. 29289 `debugger teleport 5 to 17.0`. The client runs teleport 5 (state 2, 1, 3, 0) and swaps public hosts F902 -> 10392.
2. 29516 `client teleport state=1 id=5` again, after GAH 10392 joined. Then peer_leave on 10392, 4239 closes cleanly, `state=2 id=5`, and the membership refresh says `bubble=none`. The finished teleport is being run a second time (see "Teleport loop" below).
3. 29576-29584: matchmaking createSession 0x...0053, `get_activity_host_proxy`, `client connected 127.0.0.3:4248`.
4. 29585 `client disconnected 127.0.0.3:11599`: the FAH, with **no `socket error` line**.
5. 29586 `client disconnected 4248`: the client's KTO cleanup closing GAH0.

On the client, lines 13160-13161 are adjacent: the new socket is created, and within the same frame (<50 ms) the FAH read fails.

## Q1: who closed the FAH connection

Server: there is no evidence that the server closed it.

- The only places the AH proxy closes a socket are `closeForScriptReload` in `session.ts` (which logs `bullshcript:build: script build: dropped ...`), `debugKick` in `session.ts` (the debugger's `/kick`, not logged on the server) and the frame error in `onData` (logs `activities:host: frame error`). Neither log line is in the log. There is no socket idle timeout and no keepalive close. A start request that would rebind or replace a session never arrived on 4248.
- A `/kick` would have to land inside a window of a few tens of milliseconds, right after 4248 connected. That is very unlikely.

Client: the close started on the client host side.

- Node logs `socket error ... ECONNRESET` whenever the client stack aborts with an RST. That happens at 30151+ when the process dies. For 11599 there is no error, so the server received a FIN. That is a graceful shutdown or close of host socket 10468 by something in the client process.
- On the client, a receive that is pending or follows when the local side shuts down or closes the handle completes as a local disconnect, WSAECONNABORTED (10053). A server-side FIN alone would give recv 0 (`endpoint_closed`), and a server RST would give 10054. 10053 together with a clean close on the server means the client side ended the connection locally.
- The trigger is tied to the new GAH0 socket (same frame). The same GAH reconnect pattern worked five times earlier in this session (28429, 28813, 28926, 29134, 29312) with the FAH alive. So the guest does not deterministically drop the FAH when it opens GAH0.

Runtime paths checked and ruled out:

- Descriptor table: `native/online/descriptors.cpp` closes the host socket once, when the last reference to the File goes (`~File`, :58-61). A guest close while a recv is in flight cannot closesocket under it.
- `sys_netabort` is a stub and would log `(STUBBED)`. Nothing was logged.
- The SHADPS4_LOCAL_IP bind refusal logs at error level. Nothing was logged.

What remains unlogged: guest `sceNetShutdown(44, ...)`, which `patches/fork_edits.py:240-262` makes a real `::shutdown` but logs only at Debug. The other possibility is a stale host handle closed or shut down by another component after Windows reused the value 10468. `PosixSocket::Close` (fork `posix_sockets.cpp:180`) does not set `sock` to INVALID_SOCKET afterwards. The current logs cannot tell these two apart.

Conclusion: the client closed it, not the server. Its own process shut down or closed host socket 10468 gracefully while the game still had a receive pending. This happened the moment the game opened the GAH0 connection during a teleport-driven public host swap. Which call did it (game shutdown or a stale runtime handle) is unproven; see the instrumentation below.

## Q2: "Possible host migration" (274 lines) is benign

This was already worked out in `tower-spawn.md` ("Possible host migration") and holds here.

- `sub_84D4B0` walks the local session's peers in state 10. For each machine id that is in the activity membership (`sub_17F4640`) but missing from the activity client's tracking list (+0x63C8, count +0x63C4, `sub_17DF340`), it logs the fixup and re-adds the id (`sub_17DEE60`).
- The membership receive `sub_17E3D20` clears that list at 0x17E472A whenever the membership's +4 word (`sub_17F35C0`) changes. That word is ReplicateMembership member [1] (`unk`), a host epoch.
- The server sends `unk: values.generation` (`versions/v38464_14_02_28_1027_betath/membership.ts`), so every push clears the list and the fixup fires once per push (MEM-n).
- The field that triggers it is `unk`. The machine id is correct: the fixup only fires because the id 1C:69:7A:73:78:03:0000 was found in the membership.
- It fired 228 times on this FAH over hours without a loss, and 40662 has the same behaviour and plays. It is noise, not the cause.

## Teleport loop (the context of the loss)

- The host teleportation sent in every host's membership comes from the activity instance (`MembershipPushes.push` in `session-membership.ts`, `activityInstanceFor(...).teleport`). So a newly bound GAH carries the finished teleport 5 in its +0x14 slot.
- The client accepts a teleportation when its own id differs from the host's +0x14 id, and the host state is not read (0x9003B7, `debugger-teleport.md`). Each new public activity client starts at id 0, so it accepts teleport 5 again.
- Running it again requests the slice-set transition again, which swaps public hosts again (F902 -> 10392 -> 0x...0053). The FAH died on the third swap.
- Even apart from the socket loss, this is a server bug: one debugger teleport should not keep re-running on every new public host.

## Soul spawn errors

`failed to find a valid location for the player's soul` / `will keep trying each frame` shows up at every world entry in this run (12 pairs, starting at line 2002). Each pair is a retry loop that resolves itself. It is not linked to the loss.

## Fixes

1. Server, teleport loop: `MembershipPushes.push` in `src/activity-host-proxy/session-membership.ts`. Only put the instance teleport in the membership of a host that was bound when the teleport was issued, or while it is still running (states 1, 2). A host bound after it finished gets `teleport: undefined`, so the new activity client has nothing to accept. One way to do this is to record the bound host ids on `instance.teleport` in `RegionCrossing.teleport()` and check them here. This removes the repeated public host swaps that the loss happened in. Covered by the betath membership test.
2. Server, cosmetic: `versions/v38464_14_02_28_1027_betath/membership.ts` (`unk: values.generation`). Keep `unk` constant for the host's life (1) instead of `values.generation`. This ends the "Possible host migration" spam. The other builds' membership.ts do the same thing and want the same change.
3. Runtime, to prove the closer on the next repro (no behaviour change):
   - `native/online/patches/fork_edits.py:251`: the `sys_shutdown` `LOG_DEBUG` -> `LOG_INFO`, adding the native handle.
   - `native/online/descriptors.cpp:60`: log a stream socket's host handle at Info when `~File` closes it.
   - In the fork's `PosixSocket::Close` (via fork_edits): set `sock = INVALID_SOCKET` after `closesocket`, so a second Close or a late operation cannot hit a reused handle value.
4. Server, to tell the two kinds of close apart: the socket `close` handler in the `ActivityHostProxySession` constructor (`session.ts`). Log `end` (peer FIN) separately from a local destroy, and log `hadError` in the close line. Not applied: editing server src restarts the running server.

## Open

- Retail's value of ReplicateMembership [1] has not been checked.
- Whether the game itself calls `sceNetShutdown` on the FAH when GAH0 connects during a host swap. NID imports are not named in the IDB, so its callers were not found.
