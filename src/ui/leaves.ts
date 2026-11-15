/**
 * Leaves: a long list laid out in columns of one sheet, turned like the leaves of a register
 * where an inner scroll would hide its end.
 *
 * @module ui/leaves
 */

/** Blank space between two leaves, in pixels. */
export const LEAF_GAP = 32

/**
 * Counts the leaves of a sheet.
 *
 * @param scrollWidth - Width of all the columns, gaps included.
 * @param clientWidth - Width of one leaf; 0 before the first layout.
 */
export function leafCount(scrollWidth: number, clientWidth: number): number {
  if (clientWidth <= 0) return 1
  return Math.max(1, Math.round((scrollWidth + LEAF_GAP) / (clientWidth + LEAF_GAP)))
}

/**
 * Reads the leaf a scroll offset shows, from 0.
 *
 * @param scrollLeft - Offset of the sheet.
 * @param clientWidth - Width of one leaf; 0 before the first layout.
 */
export function leafAt(scrollLeft: number, clientWidth: number): number {
  if (clientWidth <= 0) return 0
  return Math.max(0, Math.round(scrollLeft / (clientWidth + LEAF_GAP)))
}
