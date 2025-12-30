
export enum GameState {
  START_MENU = 'START_MENU',
  CLASS_SELECT = 'CLASS_SELECT',
  DM_PAUSE = 'DM_PAUSE',
  PLAYER_TURN = 'PLAYER_TURN',
  DM_TURN = 'DM_TURN',
  GAME_OVER = 'GAME_OVER',
  FLOOR_TRANSITION = 'FLOOR_TRANSITION',
  UPGRADE_SELECT = 'UPGRADE_SELECT',
  LEADERBOARD = 'LEADERBOARD'
}

export type ClassType = 'FIGHTER' | 'ROGUE' | 'WARLOCK' | 'RANGER' | 'CLERIC' | 'BARBARIAN' | 'PALADIN' | 'DEPRIVED' | 'ASTRAL_WEAVER';
export type ItemRarity = 'COMMON' | 'RARE' | 'LEGENDARY';
export type EnemyType = 'SKELETON' | 'WRAITH' | 'GOLEM';
export type ThreatLevel = 'QUIET' | 'DANGEROUS' | 'BOSS';

export interface Position {
  x: number;
  y: number;
}

// Added Particle interface to fix import error in engine/ParticleSystem.ts
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

export interface Spell {
  id: string;
  name: string;
  manaCost: number;
  description: string;
  range: number;
  type: 'damage' | 'status' | 'utility';
  effect: (player: Entity, target?: Position | Entity) => void;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  modifier: {
    attack?: number;
    defense?: number;
    hp?: number;
    maxActionPoints?: number;
    mana?: number;
    intelligence?: number;
  };
}

export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'accessory' | 'consumable' | 'scroll';
  rarity: ItemRarity;
  description: string;
  modifier: {
    attack?: number;
    defense?: number;
    hp?: number;
    range?: number;
    maxActionPoints?: number;
    mana?: number;
    intelligence?: number;
    isAoe?: boolean;
    isTeleport?: boolean;
    isChain?: boolean;
  };
}

export interface Entity {
  id: string;
  name: string;
  classType: ClassType;
  enemyType?: EnemyType;
  isElite?: boolean;
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
  };
  skills: Skill[];
  spellbook: Spell[];
  permanentAbilities: Item[];
  skillPoints: number;
  smiteAvailable: boolean;
  phaseShiftAvailable: boolean;
  isBoss?: boolean;
  frozenTurns?: number;
}

export interface Tile {
  type: 'floor' | 'wall' | 'stairs' | 'box';
  item?: Item;
}

export interface LeaderboardEntry {
  name: string;
  classType: ClassType;
  floor: number;
  score: number;
  timestamp: number;
}