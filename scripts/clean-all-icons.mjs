import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const iconsDir = path.join(rootDir, 'assets', 'icons')
const legacyNestedDir = path.join(iconsDir, 'ffffff', '000000', '1x1')

console.log('--- Cleaning and standardizing all 4,180 icons ---')

// Move authors out of ffffff/000000/1x1/ directly to assets/icons/ if needed
if (fs.existsSync(legacyNestedDir)) {
  console.log('Unnesting ffffff/000000/1x1/ structure...')
  const authors = fs.readdirSync(legacyNestedDir)
  for (const author of authors) {
    const srcPath = path.join(legacyNestedDir, author)
    const destPath = path.join(iconsDir, author)
    if (!fs.existsSync(destPath)) {
      fs.renameSync(srcPath, destPath)
    }
  }
  // Remove the now-empty ffffff tree
  fs.rmSync(path.join(iconsDir, 'ffffff'), { recursive: true, force: true })
  console.log('Author directories flattened directly under assets/icons/')
}

// Recursively find and clean all SVGs in assets/icons
function getSvgFiles(dir) {
  let svgs = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      svgs = svgs.concat(getSvgFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.svg')) {
      svgs.push(fullPath)
    }
  }
  return svgs
}

const allSvgFiles = getSvgFiles(iconsDir)
console.log(`Found ${allSvgFiles.length} SVG files to process in ${iconsDir}`)

let cleanedCount = 0

for (const filePath of allSvgFiles) {
  let content = fs.readFileSync(filePath, 'utf8')

  // Remove the black 512x512 background rectangle path
  // Matches <path d="M0 0h512v512H0z"/> and variations
  const cleanedBg = content.replace(/<path[^>]*d="M0 0h512v512H0z"[^>]*\/>/gi, '')

  // Convert fill="#fff", fill="#ffffff", fill="#FFF" to fill="currentColor"
  let cleanedFill = cleanedBg.replace(/fill="(?:#fff|#ffffff|#FFF)"/g, 'fill="currentColor"')

  // If a path has no fill attribute at all, ensure currentColor
  cleanedFill = cleanedFill.replace(/<path(?![^>]*fill=)([^>]*?)>/g, '<path fill="currentColor"$1>')

  // Ensure svg tag has standard viewBox and xmlns
  if (!cleanedFill.includes('viewBox="0 0 512 512"')) {
    cleanedFill = cleanedFill.replace(/<svg\b([^>]*)>/, '<svg viewBox="0 0 512 512"$1>')
  }

  if (cleanedFill !== content) {
    fs.writeFileSync(filePath, cleanedFill, 'utf8')
    cleanedCount++
  }
}

console.log(`Successfully cleaned ${cleanedCount} / ${allSvgFiles.length} SVG icons!`)
