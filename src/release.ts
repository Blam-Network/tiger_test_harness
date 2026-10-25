// Entry of the release executable (scripts/release.mjs): everything it reads
// is embedded, so it only has to put the state it writes beside the
// executable and unpack the native Prisma engine before the CLI starts.
import { dirname } from "node:path";
import { extractEngine } from "./embedded-engine";

process.chdir(dirname(process.execPath));
process.env.PRISMA_QUERY_ENGINE_LIBRARY = extractEngine();

require("./cli");
