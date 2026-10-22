import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const iconsFile = path.join(rootDir, 'src', 'data', 'icons.ts')

const content = fs.readFileSync(iconsFile, 'utf8')

// Parse the keys, labels, categories, and sourcePaths
const blocks = content.split(/\n  (?=[a-zA-Z0-9]+:\s*\{)/)
const icons = []

for (const block of blocks) {
  const keyMatch = block.match(/^\s*([a-zA-Z0-9]+):\s*\{/)
  const labelMatch = block.match(/label:\s*"([^"]+)"/)
  const catMatch = block.match(/category:\s*'([^']+)'/)
  const sourceMatch = block.match(/sourcePath:\s*"([^"]+)"/)

  if (keyMatch && labelMatch && catMatch && sourceMatch) {
    icons.push({
      key: keyMatch[1],
      label: labelMatch[1],
      category: catMatch[1],
      sourcePath: sourceMatch[1],
    })
  }
}

console.log(`Parsed ${icons.length} icons from icons.ts`)

// Generate new icons.ts with Vite ?raw imports
const importStatements = icons
  .map((item) => `import ${item.key}Svg from '@assets/icons/${item.sourcePath}?raw'`)
  .join('\n')

const iconEntries = icons
  .map(
    (item) => `  ${item.key}: {
    key: '${item.key}',
    label: '${item.label.replace(/'/g, "\\'")}',
    category: '${item.category}',
    sourcePath: '${item.sourcePath}',
    svg: ${item.key}Svg,
    innerHtml: extractInnerHtml(${item.key}Svg),
  },`,
  )
  .join('\n')

const newContent = `/**
 * Game Icons Dictionary for The Grand Audit.
 * Sourced from Game-Icons.net (CC BY 3.0).
 * Pre-cleaned: black square background removed and fill converted to currentColor.
 * All SVGs are imported via Vite '?raw' directly from @assets/icons/ without hardcoded XML in TypeScript.
 */

${importStatements}

export type GameIconCategory =
  | 'royal'
  | 'admin'
  | 'people'
  | 'military'
  | 'threat'
  | 'economy'
  | 'time'
  | 'ui'

export interface IconDefinition {
  /** Unique identifier of the icon. */
  key: GameIconKey
  /** Human-readable label for accessibility / tooltip. */
  label: string
  /** Semantic category for grouping and styling. */
  category: GameIconCategory
  /** Relative path of the original asset in assets/icons/. */
  sourcePath: string
  /** Standalone SVG markup with currentColor. */
  svg: string
  /** Inner SVG elements markup (for inline rendering). */
  innerHtml: string
}

export type GameIconKey =
${icons.map((item) => `  | '${item.key}'`).join('\n')}

/**
 * Extracts inner SVG markup by stripping outer <svg> and </svg> tags.
 */
function extractInnerHtml(svg: string): string {
  return svg.replace(/^<svg[^>]*>/, '').replace(/<\\/svg>\\s*$/, '')
}

export const GAME_ICONS: Record<GameIconKey, IconDefinition> = {
${iconEntries}
}
`

fs.writeFileSync(iconsFile, newContent, 'utf8')
console.log(`Successfully rewrote ${iconsFile} with clean Vite ?raw imports!`)
