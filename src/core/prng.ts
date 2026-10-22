/**
 * Deterministic PRNG Implementation (Mulberry32) & Independent Random Streams.
 * Fast, seedable, 32-bit generator guaranteeing deterministic replayability.
 *
 * @module core/prng
 */

/** Supported independent pseudo-random stream channels. */
export type RngStream = 'click' | 'combat' | 'events' | 'council'

/**
 * Derives a deterministic 32-bit unsigned seed for an independent stream from a master seed.
 * Uses 32-bit FNV-1a hashing over `${seed}:${stream}`.
 *
 * @param seed - Master run seed.
 * @param stream - Target stream identifier.
 * @returns Deterministic 32-bit unsigned integer seed.
 */
export function deriveStreamSeed(seed: number, stream: RngStream): number {
  const payload = `${seed}:${stream}`
  let hash = 0x811c9dc5
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * State container interface holding stream states.
 */
export interface HasRngStreams {
  rngStreams: Record<RngStream, number>
}

/**
 * Executes an operation with a designated state PRNG stream, updating stream state atomically.
 *
 * @param state - Game state containing rngStreams.
 * @param stream - Target stream identifier.
 * @param fn - Callback receiving the PRNG instance.
 * @returns Result produced by the callback.
 */
export function withStatePrng<T>(
  state: HasRngStreams,
  stream: RngStream,
  fn: (prng: PRNG) => T,
): T {
  const prng = new PRNG(state.rngStreams[stream])
  const result = fn(prng)
  state.rngStreams[stream] = prng.getState()
  return result
}

/**
 * Mulberry32 32-bit Pseudo-Random Number Generator.
 */
export class PRNG {
  private state: number

  /**
   * Initializes Mulberry32 with an unsigned 32-bit integer seed.
   *
   * @param seed - Initial integer seed.
   */
  constructor(seed: number) {
    this.state = seed >>> 0
  }

  /**
   * Generates a pseudo-random floating point number in [0, 1).
   *
   * @returns Deterministic pseudo-random number.
   */
  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /**
   * Generates a pseudo-random floating point number within [min, max).
   *
   * @param min - Lower bound (inclusive).
   * @param max - Upper bound (exclusive).
   * @returns Value within [min, max).
   */
  public nextBetween(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /**
   * Generates an integer in [min, max] inclusive.
   *
   * @param min - Minimum integer.
   * @param max - Maximum integer.
   * @returns Random integer.
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.nextBetween(min, max + 1))
  }

  /**
   * Retrieves the internal state representation for serialization.
   *
   * @returns State unsigned 32-bit integer.
   */
  public getState(): number {
    return this.state
  }

  /**
   * Restores internal state from a serialized state.
   *
   * @param state - Serialized state integer.
   */
  public setState(state: number): void {
    this.state = state >>> 0
  }
}
