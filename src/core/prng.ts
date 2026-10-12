/**
 * Deterministic PRNG Implementation (Mulberry32).
 * Fast, seedable, 32-bit generator guaranteeing deterministic replayability.
 *
 * @module core/prng
 */

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
    let t = (this.state += 0x6d2b79f5)
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
