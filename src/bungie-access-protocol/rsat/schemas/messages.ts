import { rsat } from "@blamnetwork/rsat";

/** 80801A2B — status nest used by several responses. */
export const Unknown80801A2B = rsat.schema(0x80801a2b, {
  unknown0: rsat.i32({ size: 3, bias: 1 }),
  unknown1: rsat.i32({ size: 32, bias: 0x80000000 }),
});

/** 808018D0 — server_object. */
export const ServerObject = rsat.schema(0x808018d0, {
  soid: rsat.optional(rsat.u64()),
  unknown1: rsat.optional(rsat.u64()),
  unknown2: rsat.optional(rsat.rawBytes()),
  unknown3: rsat.optional(rsat.rawBytes()),
  unknown4: rsat.optional(rsat.u32()),
});

/** 80801AB0 — login_account response (nid 503). */
export const LoginAccountResponse = rsat.schema(0x80801ab0, {
  unknown0: rsat.nested(Unknown80801A2B),
  accountSoid: rsat.u64(),
  schemaChecksum: rsat.u32({ size: 32, bias: 0 }),
  contentChecksum: rsat.u32({ size: 32, bias: 0 }),
  serverObject: rsat.nested(ServerObject),
});

/** 80801A8D — fetch_family request (nid 206). */
export const FetchFamilyRequest = rsat.schema(0x80801a8d, {
  familyType: rsat.i32({ size: 4, bias: 1 }),
  familyRootSoid: rsat.u64(),
});

/** 80801A8E — fetch_family response (nid 206). */
export const FetchFamilyResponse = rsat.schema(0x80801a8e, {
  unknown0: rsat.i32({ size: 3, bias: 1 }),
});

/** 80801A52 — director_enter_orbit response. */
export const DirectorEnterOrbitResponse = rsat.schema(0x80801a52, {
  unknown0: rsat.nested(Unknown80801A2B),
  serverObject: rsat.nested(ServerObject),
});

/** 80801ABC — profile_set_character_profile response. */
export const ProfileSetCharacterProfileResponse = rsat.schema(0x80801abc, {
  unknown0: rsat.nested(Unknown80801A2B),
});

/** 80800E38 — 36-byte nest (fixed bytes on wire). */
export const AccountUnknown36 = rsat.schema(0x80800e38, {
  bytes: rsat.bytes(36),
});

/** 80804A43 — login_account request inner. */
export const LoginAccountRequestInner = rsat.schema(0x80804a43, {
  unknown: rsat.nested(AccountUnknown36),
  trailing: rsat.u64(),
});

/** 80801AAF — login_account request (nid 503). */
export const LoginAccountRequest = rsat.schema(0x80801aaf, {
  account: rsat.nested(LoginAccountRequestInner),
});

export type LoginAccountResponseValue = rsat.Infer<typeof LoginAccountResponse>;
export type FetchFamilyResponseValue = rsat.Infer<typeof FetchFamilyResponse>;
