import { universeTime } from "../../stubs/universe-clock";
import {
  directorServerObjectFlags,
  directorUniverseFlagList,
} from "./director-policy";

// The universe ServerObject the login_account and director_enter_orbit
// replies and the universe family baseline carry.
export function serverObject(soid: bigint) {
  return {
    soid,
    unknown1: universeTime(),
    // Activity blacklist (i16 list); sent empty so an absent
    // optional can't leave stale entries in the client's copy.
    unknown2: { unknown0: [] },
    unknown3: directorUniverseFlagList(),
    unknown5: directorServerObjectFlags(),
    unknown4: undefined,
  };
}
