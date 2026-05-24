/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as checklist from "../checklist.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as github from "../github.js";
import type * as githubConnections from "../githubConnections.js";
import type * as scans from "../scans.js";
import type * as tokenSource from "../tokenSource.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  checklist: typeof checklist;
  constants: typeof constants;
  crons: typeof crons;
  github: typeof github;
  githubConnections: typeof githubConnections;
  scans: typeof scans;
  tokenSource: typeof tokenSource;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
