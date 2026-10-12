# Asset Pipeline & Typography

This guide details how assets from `assets/` are packaged and integrated into the single-file build.

---

## 1. Game-Icons.net Integration

The full Game-Icons.net SVG library is stored in `assets/icons/`.

### Tree-Shaking & Single-File Bundling Rule
- The single-file bundler (`vite-plugin-singlefile`) automatically inlines imported SVGs directly into `dist/index.html`.
- **Never perform wildcard imports** (e.g. `import.meta.glob('../assets/icons/**/*.svg')`), as this would attempt to inline all 4,180 icons into the single HTML output.
- Instead, the game maintains a typed, pre-cleaned dictionary in `src/data/icons.ts` (curated icons covering all 24 units, 4 counselors, 4 defeats, 8 archives, threats, and UI controls).
- All icons have their 512x512 black backgrounds removed and use `fill="currentColor"` to inherit Tailwind CSS text colors dynamically.
- Accessible via the `<GameIcon name="..." />` component (`src/components/common/GameIcon.vue`).

---

## 2. Typography & Fonts

Located in `assets/fonts/`:
- **`assets/fonts/medieval-sharp/MedievalSharp-Regular.woff`**: Used for headers, deadline banners, and primary CTA buttons.
- **`assets/fonts/im-fell-english/IMFellEnglish-Regular.woff` & `IMFellEnglish-Italic.woff`**: Used for ledger tables, steward narrative logs, card descriptions, and numeric readouts.

Fonts are compressed in WOFF format (43% lighter than raw TTF), declared via `@font-face` rules in `src/assets/main.css`, and inlined into the single HTML distribution.

---

## 3. Audio Assets

- **Sound Effects (SFX):** Sourced from `assets/audio/rpg/` and `assets/audio/ui/`. Inlined directly into the application bundle (or base64) to ensure synchronous, low-latency playback.
- **Soundtracks:** Preserved in `public/soundtrack/` (`Angevin B.mp3`, `Folk Round.mp3`, etc.). Vite copies them directly into `dist/soundtrack/` on build, allowing dynamic on-demand streaming via `./soundtrack/*.mp3` without bloating `dist/index.html`.
