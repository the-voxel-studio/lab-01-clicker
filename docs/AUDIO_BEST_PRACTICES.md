# Browser Game Audio Engine Best Practices & Architecture

This document establishes the architectural standards, performance constraints, Web Audio API patterns, polyphony management, and asset optimization techniques for browser-based games.

---

## 1. Browser Constraints & Autoplay Lifecycle

### 1.1 The Autoplay Policy
Modern browsers (Chrome, Firefox, Safari) strictly block programmatic audio playback until an explicit user interaction occurs on the window (`pointerdown`, `keydown`, or `click`).
- **Initial State:** `AudioContext` is created in `'suspended'` state.
- **Silent Unlock Pattern:** Attach a one-time global event listener to unlock and resume the context on the user's first input:

```typescript
/**
 * Unlocks the global AudioContext on the first explicit user interaction.
 *
 * @param ctx - The inactive AudioContext instance.
 */
export function unlockAudioContext(ctx: AudioContext): void {
  if (ctx.state === 'running') return

  const unlock = async (): Promise<void> => {
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    // Remove listeners once successfully unlocked
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }

  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock, { passive: true })
}
```

### 1.2 Tab Inactive / Visibility Change
Browsers may throttle audio or allow loops to drift out of sync when a tab is minimized or hidden.
- Listen to `document.addEventListener('visibilitychange')`.
- When `document.hidden === true`, ramp down the master gain or suspend the context to conserve user battery and memory.
- When `document.hidden === false`, smoothly ramp up gain back to target level.

---

## 2. Web Audio API vs `<audio>` HTML Element

| Feature | HTML5 `<audio>` Element | Web Audio API (`AudioContext`) |
| :--- | :---: | :---: |
| **Latency** | High (50–150ms delay) | Near-zero (< 10ms hardware buffer) |
| **Rapid SFX Playback** | Glitchy / Fails on fast clicks | Multiple overlapping instances from one decoded buffer |
| **Dynamic Routing** | Volume & Pan only | Arbitrary node graphs (Buses, Filters, Reverb) |
| **Pitch Shifting** | Limited / Broken in older engines | Native `playbackRate.value` and `detune.value` |
| **Best Used For** | Long streaming podcasts/video | **All game SFX, UI clicks, and seamless music loops** |

---

## 3. Audio Graph Architecture (Bus & Routing)

All audio sources route through dedicated sub-mix buses before hitting the `MasterGain` and the `destination`:

```
[SFX Buffer Source] -----> [SFX Gain Node] ----\
[UI Buffer Source] ------> [SFX Gain Node] ------> [Master Gain Node] ----> [AudioDestination]
[Music Buffer Source] ---> [Music Gain Node] --/
```

### Routing Specifications
1. **Master Bus:** Global volume scale `[0.0, 1.0]` and hard mute toggle.
2. **Music Bus:** Dedicated gain for background themes, supporting logarithmic fades.
3. **SFX Bus:** Dedicated gain for gameplay events, unit recruitment, and UI interactions.

---

## 4. Incremental / Clicker Game Audio Pitfalls

Incremental games present unique audio engineering challenges due to high-frequency player inputs (e.g., clicking 10+ times per second).

### 4.1 Clicker Spam & Polyphony Limiting (Voice Stealing)
Triggering dozens of unthrottled audio sources simultaneously causes severe CPU spikes, audio clipping, and acoustic fatigue.
- **Cooldown Throttling:** Enforce a minimum interval (e.g., 40–60ms) between identical sound events.
- **Max Concurrency per Sound:** Allow no more than 3–4 concurrent voices for a single SFX key. If a 5th arrives, stop the oldest active voice immediately (voice stealing).

### 4.2 The Machine-Gun Effect (Acoustic Fatigue)
Repeatedly playing the exact same sample sounds robotic and quickly annoys the player.
- **Pitch Randomization:** Apply a micro-variance on `playbackRate` (e.g., `1.0 ± 0.05`, meaning ±5%) on every trigger.
- **Round-Robin Variation:** If multiple variations exist for an action (e.g. `bookFlip1`, `bookFlip2`, `bookFlip3` or `click1` to `click5`), rotate through them sequentially or pick randomly without immediate repetition.

---

## 5. Music Transitions & Gapless Looping

1. **Seamless Looping:**
   - Always use `AudioBufferSourceNode.loop = true`.
   - Never use `source.onended = () => playAgain()` for music; this introduces micro-gaps.
2. **Cross-Fading:**
   - Avoid abrupt stops. Always apply an exponential or linear ramp over 0.5 to 1.5 seconds when switching tracks (e.g. transitioning from peacetime management to Crown Audit tension):
   ```typescript
   gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime)
   gainNode.gain.linearRampToValueAtTime(0.001, ctx.currentTime + fadeDuration)
   ```

---

## 6. Bundling & Distribution Strategy for Audio Assets

To maintain optimal browser startup performance and preserve a lean `index.html`, audio assets are partitioned into two distinct distribution tiers:

### 6.1 Inlined Sound Effects (SFX)
- **Source:** Curated sounds from `assets/audio/rpg/` and `assets/audio/ui/` (Kenney OGG Vorbis, 4–15 KB each).
- **Packaging:** Embedded directly into the bundle (or base64-inlined via `vite-plugin-singlefile`).
- **Total Overhead:** ~100–150 KB for all 15–20 active gameplay sound effects.
- **Advantage:** Available synchronously at startup with zero network requests or latency.

### 6.2 External Streaming Soundtracks (`public/soundtrack/`)
- **Source:** Full orchestral tracks located in `public/soundtrack/` (`Folk Round.mp3`, `Minstrel Guild.mp3`, etc.).
- **Packaging:** Preserved as external standalone files copied directly into `dist/soundtrack/` during Vite build.
- **Loading Mechanism:** Loaded asynchronously on-demand via standard relative URLs (`./soundtrack/*.mp3`) using streaming Web Audio elements (`MediaElementAudioSourceNode` or deferred buffer decoders).
- **Advantages:**
  - Keeps `dist/index.html` lightweight (< 800 KB).
  - Music is only loaded over the network when audio is actually enabled/played by the user.
  - Compatible with standard HTML5 game distribution archives (e.g. itch.io zip containing `index.html` + `soundtrack/`).

---

## 7. Storage & Preferences Persistence

- Save user preferences (`masterVolume`, `musicVolume`, `sfxVolume`, `isMuted`) in `localStorage` under `grand_audit_audio_settings`.
- Load and apply these volume settings immediately upon `AudioManager` instantiation.
