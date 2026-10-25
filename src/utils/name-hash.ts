import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";

// fnv1(""): the basis itself, the "no name" sentinel wherever a row carries
// an optional name hash.
export const k_empty_name_hash = fnv1("");
