// Canned values the activity host sends where a real server would compute or
// store them.

// FNV-1 of "default", the spawn point every bubble tag lists first. An
// activity name hash matches no spawn point, and the guest falls back to entry
// [0] of the first registered spawn tag, which in a single-bubble activity can
// be outside the map.
export const SPAWN_TRANSITION_DEFAULT = 0x2ea8fb98;

// Client TOD init denominator. worldServerTime / this = day fraction.
export const GAS_SECONDS_PER_DAY = 3600;
// 10:00. 0 is midnight.
export const GAS_TIME_OF_DAY_FRACTION = 10 / 24;

// Global activity state world options member 6, sent -1.
export const GAS_UNKNOWN6 = -1;

// The world globals state's tick interval in milliseconds: 30 ticks a second.
export const WORLD_GLOBALS_TICK_MS = 1000 / 30;

// Join result members 8 and 9 (the join handler copies them into the activity
// client): 9 is the keepalive interval in ms (the client sends class 15 when
// nothing was sent for that long; 0 made it send one every frame), 8 the
// window, in ms, a peer counts as recently heard. The 2.3.1 capture sends 500
// for both.
export const JOIN_RECENT_WINDOW_MS = 500;
export const JOIN_KEEPALIVE_INTERVAL_MS = 500;
export const JOIN_REPLICATION_EPOCH = 1;

// The player key a row carries before a join has named a character.
export const DEFAULT_PLAYER_KEY = 0x0000_0002_0000_0002n;

// The "complete_action" name (9A5F60C9) every captured Machine row sends.
export const MACHINE_COMPLETE_ACTION = 0x9a_5f_60_c9;
