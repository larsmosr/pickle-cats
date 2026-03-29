/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { ApiFromModules, FilterApi, FunctionReference } from 'convex/server'
import type * as auth from '../auth.js'
import type * as gameDays from '../gameDays.js'
import type * as games from '../games.js'
import type * as groups from '../groups.js'
import type * as players from '../players.js'

declare const fullApi: ApiFromModules<{
  auth: typeof auth
  gameDays: typeof gameDays
  games: typeof games
  groups: typeof groups
  players: typeof players
}>

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, 'public'>>

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, 'internal'>>

export declare const components: {}
