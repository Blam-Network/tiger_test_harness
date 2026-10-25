import type { QueuezObject } from "@blamnetwork/rsat";
import { type BapBaselines, bapBuild } from "../versions";

export type { QueuezObject };

// The family baselines and updates in the active build's client schemas.
const baselines = () => bapBuild().baselines;

export const buildSelfBaselineBody: BapBaselines["buildSelfBaselineBody"] = (
  ...args
) => baselines().buildSelfBaselineBody(...args);

export const buildSelfUpdateBody: BapBaselines["buildSelfUpdateBody"] = (
  ...args
) => baselines().buildSelfUpdateBody(...args);

export const buildPeerUpdateBody: BapBaselines["buildPeerUpdateBody"] = (
  ...args
) => baselines().buildPeerUpdateBody(...args);

export const buildPeerBaselineBody: BapBaselines["buildPeerBaselineBody"] = (
  ...args
) => baselines().buildPeerBaselineBody(...args);

export const buildInspectionBaselineBody: BapBaselines["buildInspectionBaselineBody"] =
  (...args) => baselines().buildInspectionBaselineBody(...args);

export const buildSelectCharacterBaselineBody: BapBaselines["buildSelectCharacterBaselineBody"] =
  (...args) => baselines().buildSelectCharacterBaselineBody(...args);

export const buildRosterBaselineBody: BapBaselines["buildRosterBaselineBody"] =
  (...args) => baselines().buildRosterBaselineBody(...args);

export const buildUniverseBaselineBody: BapBaselines["buildUniverseBaselineBody"] =
  (...args) => baselines().buildUniverseBaselineBody(...args);
