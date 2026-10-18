// The map board and its geometry helpers.
export { Board } from './Board';
export type { BoardProps, LosLine } from './Board';
export { StackView, BoardScale } from './StackView';
export type { StackItem } from './StackView';
export { layoutStack } from './stackLayout';
export type { StackLayout, StackRole, Slot } from './stackLayout';
export { TerrainLayer, terrainImage, TERRAIN_FLAT, DEFAULT_PPU } from './TerrainLayer';
export { MaskOverlay, MASK_COLORS } from './MaskOverlay';
export type { MaskOverlayMode } from './MaskOverlay';
export * from './geometry';
