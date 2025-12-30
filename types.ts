
export enum GameState {
  START_MENU = 'START_MENU',
  CLASS_SELECT = 'CLASS_SELECT',
  DM_PAUSE = 'DM_PAUSE',
  PLAYER_TURN = 'PLAYER_TURN',
  AI_TURN = 'AI_TURN',
  ANIMATING = 'ANIMATING',
  RESOLVE = 'RESOLVE',
  GAME_OVER = 'GAME_OVER',
  LEVEL_UP = 'LEVEL_UP'
}

export type ClassType = 'FIGHTER' | 'ROGUE' | 'WARLOCK' | 'DEPRIVED';
export type ItemRarity = 'COMMON' | 'RARE' | 'LEGENDARY';
export type EnemyType = 'SKELETON' | 'WRAITH' | 'CHAMPION';

export interface Position {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  targetX?: number;
  targetY?: number;
}

export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'accessory' | 'consumable' | 'hat';
  rarity: ItemRarity;
  description: string;
  modifier: {
    attack?: number;
    defense?: number;
    hp?: number;
    range?: number;
    mana?: number;
    intelligence?: number;
  };
}

export interface Entity {
  id: string;
  name: string;
  classType: ClassType;
  enemyType?: EnemyType;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  intelligence: number;
  attackBonus: number;
  defense: number;
  ac: number;
  actionPoints: number;
  maxActionPoints: number;
  range: number;
  pos: Position;
  inventory: Item[];
  equipped: {
    weapon?: Item;
    armor?: Item;
    accessory?: Item;
    hat?: Item;
  };
  gold: number;
  xp: number;
  level: number;
  isBoss?: boolean;
}

export interface Tile {
  type: 'floor' | 'wall' | 'stairs' | 'box';
  item?: Item;
}
