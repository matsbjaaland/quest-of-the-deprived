
export const COLORS = {
  CHARCOAL: '#08080a',
  DEEP_PURPLE: '#1a052a',
  SOUL_GREEN: '#00ff66',
  BLOOD_RED: '#7a0000',
  VOID_PINK: '#9d00ff',
  GHOST_WHITE: '#d1d1d1',
  WALL_BLACK: '#020205',
  CHEST_GOLD: '#c4a000',
  CHEST_BROWN: '#1a0f0a',
  SOUL_FIRE: '#20ffaa'
};

export const SCREEN_WIDTH = 512; 
export const SCREEN_HEIGHT = 512;
export const TILE_SIZE = 64; 
export const GRID_WIDTH = 8;
export const GRID_HEIGHT = 8;
export const PIXEL_SIZE = 4; // Increased pixel size for chunkier 8-bit feel

export const BITMASKS = {
  PLAYER_BASE: [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [1, 2, 3, 2, 2, 3, 2, 1],
    [1, 2, 2, 1, 1, 2, 2, 1],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [0, 1, 1, 2, 2, 1, 1, 0],
    [0, 1, 2, 0, 0, 2, 1, 0],
    [1, 1, 0, 0, 0, 0, 1, 1]
  ],
  SKELETON: [
    [0, 1, 1, 1, 1, 1, 1, 0],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 0, 2, 2, 0, 2, 1],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [0, 0, 1, 2, 2, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 0, 1, 1, 0, 1, 0],
    [0, 1, 0, 0, 0, 0, 1, 0]
  ],
  WALL: [
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 2, 1, 1, 2, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [1, 1, 2, 3, 3, 2, 1, 1],
    [1, 1, 2, 3, 3, 2, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 2, 1, 1, 2, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1]
  ],
  CHEST: [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [1, 2, 3, 3, 3, 3, 2, 1],
    [1, 1, 1, 4, 4, 1, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 0, 0, 1, 1, 0]
  ]
};

export const PALETTES = {
  FIGHTER: [COLORS.DEEP_PURPLE, '#2a104a', COLORS.SOUL_GREEN],
  ROGUE: ['#0a051a', '#1a0a2a', COLORS.VOID_PINK],
  SKELETON: [COLORS.CHARCOAL, '#333333', COLORS.GHOST_WHITE],
  WALL: [COLORS.CHARCOAL, '#121218', COLORS.DEEP_PURPLE],
  CHEST: [COLORS.CHEST_BROWN, COLORS.CHEST_GOLD, '#ffffff', COLORS.SOUL_FIRE]
};
