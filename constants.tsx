
export const COLORS = {
  CHARCOAL: '#0c0a0f',
  DEEP_PURPLE: '#2d0a4e',
  SOUL_GREEN: '#00ff66',
  BLOOD_RED: '#b00000',
  VOID_PINK: '#ff00ff',
  GHOST_WHITE: '#e0e0e0',
  ARENA_STONE: '#1a1a1a', 
  WALL_BLACK: '#000000',
  CHEST_GOLD: '#d4af37',
  CHEST_BROWN: '#3d251e'
};

export const SCREEN_WIDTH = 480; 
export const SCREEN_HEIGHT = 480;
export const TILE_SIZE = 48; 
export const GRID_WIDTH = 10;
export const GRID_HEIGHT = 10;
export const PIXEL_SIZE = 4;

// 5x5 Bitmask definitions for 8-bit sprites
// 0 = Transparent, 1 = Secondary, 2 = Primary, 3 = Detail/Highlight
export const BITMASKS = {
  FIGHTER: [
    [0, 1, 1, 1, 0],
    [1, 2, 2, 2, 1],
    [1, 2, 3, 2, 1],
    [1, 2, 2, 2, 1],
    [0, 1, 0, 1, 0]
  ],
  ROGUE: [
    [0, 0, 1, 0, 0],
    [0, 1, 2, 1, 0],
    [1, 2, 3, 2, 1],
    [0, 1, 2, 1, 0],
    [0, 1, 0, 1, 0]
  ],
  WARLOCK: [
    [0, 3, 1, 3, 0],
    [3, 1, 2, 1, 3],
    [1, 2, 2, 2, 1],
    [3, 1, 2, 1, 3],
    [0, 3, 1, 3, 0]
  ],
  SKELETON: [
    [0, 1, 1, 1, 0],
    [1, 0, 1, 0, 1],
    [0, 1, 1, 1, 0],
    [0, 1, 1, 1, 0],
    [0, 1, 0, 1, 0]
  ],
  BOSS: [
    [2, 0, 2, 0, 2],
    [2, 2, 2, 2, 2],
    [0, 1, 3, 1, 0],
    [2, 2, 2, 2, 2],
    [2, 0, 2, 0, 2]
  ],
  WALL: [
    [1, 1, 1, 1, 1],
    [1, 2, 2, 2, 1],
    [1, 2, 1, 2, 1],
    [1, 2, 2, 2, 1],
    [1, 1, 1, 1, 1]
  ],
  CHEST: [
    [0, 1, 1, 1, 0],
    [1, 2, 2, 2, 1],
    [1, 3, 2, 3, 1],
    [1, 2, 2, 2, 1],
    [0, 1, 1, 1, 0]
  ]
};

// Map bitmask values (1, 2, 3) to entity-specific color palettes
export const PALETTES = {
  FIGHTER: [COLORS.DEEP_PURPLE, COLORS.GHOST_WHITE, COLORS.BLOOD_RED],
  ROGUE: [COLORS.CHARCOAL, '#2a4d2a', COLORS.SOUL_GREEN],
  WARLOCK: [COLORS.DEEP_PURPLE, COLORS.VOID_PINK, COLORS.GHOST_WHITE],
  SKELETON: [COLORS.CHARCOAL, COLORS.GHOST_WHITE, COLORS.DEEP_PURPLE],
  BOSS: [COLORS.CHARCOAL, COLORS.BLOOD_RED, COLORS.VOID_PINK],
  WALL: [COLORS.CHARCOAL, '#222222', '#333333'],
  CHEST: [COLORS.CHEST_BROWN, COLORS.CHEST_GOLD, COLORS.GHOST_WHITE]
};
