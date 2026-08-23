import { c } from "@craftycodie/cstruct";

/** Wire body: `[u8 family_type][u64be root_soid]` (9B). */
const SubscribeRequest = c.struct({
  familyType: c.u8(),
  rootSoid: c.u64(),
});

export type SubscribeRequestValue = c.infer<typeof SubscribeRequest>;

export function parseSubscribeRequest(
  body: Buffer
): SubscribeRequestValue | null {
  if (body.length !== c.sizeof(SubscribeRequest)) {
    return null;
  }
  return c.read(SubscribeRequest, body, "big");
}
