// node scripts/link-tiger.mjs
//   Local dev: points vendor/tiger, where CI checks out the tiger submodule,
//   at your own tiger checkout (../tiger, or TIGER_DIR) so web-tiger runs
//   against what you edit and build there. A directory junction on Windows, a
//   symlink elsewhere. Run it instead of `git submodule update`, which would
//   check the pinned commit out in that checkout.
//   Does nothing when vendor/tiger already links there; refuses a vendor/tiger
//   that is a link elsewhere or a folder with files in it.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmdirSync,
  symlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const link = resolve("vendor", "tiger");
const target = resolve(process.env.TIGER_DIR ?? join("..", "tiger"));

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(join(target, "packages", "bullshcript", "package.json"))) {
  fail(`${target} is not a tiger checkout (set TIGER_DIR to yours)`);
}

const stat = lstatSync(link, { throwIfNoEntry: false });
if (stat?.isSymbolicLink()) {
  if (realpathSync(link) !== realpathSync(target)) {
    fail(
      `${link} links to ${realpathSync(link)}, not ${target}: remove the link first (on Windows: cmd /c rmdir vendor\\tiger)`
    );
  }
  console.log(`${link} already links to ${target}`);
} else {
  if (stat) {
    // The empty folder a clone leaves for the submodule; rmdir fails on one with files.
    if (readdirSync(link).length > 0) {
      fail(
        `${link} is a folder with files in it (the submodule checked out?): leaving it alone`
      );
    }
    rmdirSync(link);
  }
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(target, link, "junction");
  console.log(`${link} -> ${target}`);
}

// With the link in place a submodule update would check out the pinned commit
// in the linked checkout.
try {
  execFileSync(
    "git",
    ["config", "--local", "submodule.vendor/tiger.update", "none"],
    { stdio: "ignore" }
  );
} catch {
  console.warn(
    "not a git checkout: don't run `git submodule update` with this link in place"
  );
}
