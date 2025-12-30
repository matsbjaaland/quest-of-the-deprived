
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GameState, Entity, Tile, ClassType, Item, Position, EnemyType, Skill, ThreatLevel, Spell, LeaderboardEntry } from './types';
import { Renderer } from './engine/Renderer';
import { GRID_WIDTH, GRID_HEIGHT } from './constants';
import { getCombatFlavor, generateRoomDescription, generateEulogy } from './services/gemini';
import * as THREE from 'three';

const LOOT_POOL: Omit<Item, 'id'>[] = [
  { name: 'Dull Dagger', type: 'weapon', rarity: 'COMMON', description: 'Better than nothing. +2 Attack.', modifier: { attack: 2 } },
  { name: 'Void Staff', type: 'weapon', rarity: 'RARE', description: 'Magic drips from it. +8 INT.', modifier: { intelligence: 8 } },
  { name: 'Bloodthirster', type: 'weapon', rarity: 'LEGENDARY', description: 'Hungers for life. +12 Attack.', modifier: { attack: 12 } },
  { name: 'Shadow Cloak', type: 'armor', rarity: 'LEGENDARY', description: 'Woven from fog. +5 DEF, +1 Move.', modifier: { defense: 5, maxActionPoints: 1 } },
  { name: 'Ring of Haste', type: 'accessory', rarity: 'RARE', description: 'Time slows down. +1 Move.', modifier: { maxActionPoints: 1 } },
  { name: 'Greater Potion', type: 'consumable', rarity: 'RARE', description: 'Sparkling essence. Restores 50 HP.', modifier: { hp: 50 } },
  { name: 'Fireball Scroll', type: 'scroll', rarity: 'RARE', description: 'One-time mass AOE light explosion.', modifier: { attack: 30, isAoe: true } },
  { name: 'Holy Shield', type: 'armor', rarity: 'RARE', description: 'Sacred protection. +8 DEF.', modifier: { defense: 8 } }
];

const SKILL_UPGRADES: Omit<Skill, 'id'>[] = [
  { name: 'Swift Step', description: '+1 Move per turn.', modifier: { maxActionPoints: 1 } },
  { name: 'Second Wind', description: '+20 Max HP.', modifier: { hp: 20 } },
  { name: 'Arcane Mind', description: '+10 Intelligence.', modifier: { intelligence: 10 } }
];

const SAVE_KEY = 'grave_born_v2_final_soul';
const LEADERBOARD_KEY = 'grave_born_leaderboard_v1';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START_MENU);
  const [floor, setFloor] = useState(1);
  const [grid, setGrid] = useState<Tile[][]>([]);
  const [player, setPlayer] = useState<Entity | null>(null);
  const [enemies, setEnemies] = useState<Entity[]>([]);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [dmText, setDmText] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [hasSave, setHasSave] = useState(false);
  const [availableUpgrades, setAvailableUpgrades] = useState<Skill[]>([]);
  const [hoveredClass, setHoveredClass] = useState<ClassType | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [floatingTextQueue, setFloatingTextQueue] = useState<{ id: string, text: string, pos: { x: number, y: number } }[]>([]);
  const [showDeathScreen, setShowDeathScreen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [eulogyText, setEulogyText] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const audioRef = useRef<{ ctx: AudioContext, sounds: any } | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const savedL = localStorage.getItem(LEADERBOARD_KEY);
    if (savedL) setLeaderboard(JSON.parse(savedL));
    const savedG = localStorage.getItem(SAVE_KEY);
    if (savedG) setHasSave(true);
  }, []);

  const initAudio = async () => {
    if (audioRef.current) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioRef.current = { ctx, sounds: {} };
    const osc = ctx.createOscillator();
    const g = ctx.createGain(); g.gain.value = 0.05; osc.connect(g).connect(ctx.destination);
    osc.start();
  };

  const log = useCallback((msg: string) => {
    setCombatLog(prev => [msg, ...prev].slice(0, 15));
    if (isMobile) {
      const pPos = rendererRef.current?.getPlayerScreenPosition();
      if (pPos) {
        const id = Math.random().toString(36).substr(2, 9);
        setFloatingTextQueue(prev => [...prev, { id, text: msg, pos: pPos }]);
        setTimeout(() => setFloatingTextQueue(prev => prev.filter(t => t.id !== id)), 2500);
      }
    }
  }, [isMobile]);

  const pStats = useMemo(() => {
    if (!player) return null;
    let atk = player.attackBonus, ac = player.ac, range = player.range, maxAp = player.maxActionPoints, maxHp = player.maxHp, intel = player.intelligence;
    (Object.values(player.equipped) as (Item | undefined)[]).forEach(item => { if (item) { 
      atk += item.modifier.attack || 0; ac += item.modifier.defense || 0; range += item.modifier.range || 0; 
      maxAp += item.modifier.maxActionPoints || 0; intel += item.modifier.intelligence || 0;
    }});
    player.skills.forEach(s => { atk += s.modifier.attack || 0; ac += s.modifier.defense || 0; intel += s.modifier.intelligence || 0; });
    return { ...player, attackBonus: atk, ac, range, maxActionPoints: maxAp, maxHp, intelligence: intel };
  }, [player]);

  const handleDeath = async () => {
    setGameState(GameState.GAME_OVER);
    setShowDeathScreen(true);
    
    // Fetch a haunting eulogy from the abyss
    const eulogy = await generateEulogy(floor);
    setEulogyText(eulogy);
    log(`[DM] FINAL VESTIGE: ${eulogy}`);

    setTimeout(() => {
      const name = prompt("Death is not the end. Etch your name into the Hall of Heroes:") || "Nameless Vessel";
      const score = floor * 100 + (player?.intelligence || 0) * 10;
      const entry: LeaderboardEntry = { name, classType: player!.classType, floor, score, timestamp: Date.now() };
      const nextL = [...leaderboard, entry].sort((a, b) => b.score - a.score).slice(0, 10);
      setLeaderboard(nextL); 
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(nextL));
      setShowDeathScreen(false);
      setGameState(GameState.START_MENU);
      setPlayer(null);
    }, 6000);
  };

  const handleCombat = useCallback((attacker: Entity, target: any, isPlayer: boolean) => {
    const statsAttacker = isPlayer ? pStats : attacker;
    if (!statsAttacker) return;
    let d20 = Math.floor(Math.random() * 20) + 1;
    let hit = (d20 + statsAttacker.attackBonus) >= target.ac;
    if (hit) {
      let dmg = Math.floor(Math.random() * 10 + 5 + statsAttacker.attackBonus / 2);
      if (attacker.classType === 'ASTRAL_WEAVER') dmg = 1;
      rendererRef.current?.spawnBurst(new THREE.Vector3(target.pos.x, 0.6, target.pos.y), isPlayer ? 0x00ffff : 0x4a0404);
      if (isPlayer) {
        if (target.id.startsWith('box-')) {
          const ng = [...grid]; ng[target.pos.y][target.pos.x].type = 'floor';
          
          let loot: Item | null = null;
          if (Math.random() > 0.4) {
             const baseLoot = LOOT_POOL[Math.floor(Math.random() * LOOT_POOL.length)];
             loot = { ...baseLoot, id: `loot-${Date.now()}` } as Item;
             
             // Deprived Easter Egg: 1% chance for Master Key
             if (player?.classType === 'DEPRIVED' && Math.random() < 0.01) {
               loot = { 
                 id: `key-${Date.now()}`, 
                 name: 'Master Key', 
                 type: 'scroll', 
                 rarity: 'LEGENDARY', 
                 description: 'Forbidden. Bends floor plans. Use to skip a level.', 
                 modifier: {} 
               } as Item;
             }
             ng[target.pos.y][target.pos.x].item = loot;
          }
          
          setGrid(ng); 
          rendererRef.current?.initGrid(ng);
          
          // Tutorial Progression
          if (tutorialStep === 1 && floor === 1) setTutorialStep(2);
        } else {
          setEnemies(prev => prev.map(e => e.id === target.id ? { ...e, hp: e.hp - dmg } : e).filter(e => e.hp > 0));
        }
      } else {
        let actualDmg = dmg;
        if (player && player.mana > 0 && player.classType === 'ASTRAL_WEAVER') {
          const mDmg = Math.floor(dmg * 0.5); 
          setPlayer(p => p ? { ...p, mana: Math.max(0, p.mana - mDmg) } : null); 
          actualDmg -= mDmg;
        }
        setPlayer(p => {
          if (!p) return null;
          const nextHp = Math.max(0, p.hp - actualDmg);
          if (nextHp <= 0 && !showDeathScreen) {
            handleDeath();
          }
          return { ...p, hp: nextHp };
        });
      }
    }
    if (isPlayer) setPlayer(p => p ? { ...p, actionPoints: Math.max(0, p.actionPoints - 1) } : null);
  }, [pStats, grid, player, tutorialStep, floor, showDeathScreen]);

  const handleEquip = useCallback((item: Item) => {
    if (item.name === 'Master Key') {
      log("[DM] The stone groans as reality folds. You descend through forbidden depths.");
      // Skip the floor logic: simulate stepping into stairs by moving to a dummy pos that triggers transition
      setPlayer(p => p ? { ...p, inventory: p.inventory.filter(i => i.id !== item.id), pos: { x: -1, y: -1 } } : null);
      return;
    }
    if (item.type === 'consumable') {
      setPlayer(p => p ? ({ ...p, hp: Math.min(p.maxHp, p.hp + (item.modifier.hp || 0)), inventory: p.inventory.filter(i => i.id !== item.id) }) : null);
      rendererRef.current?.triggerPotionFlash();
      return;
    }
    setPlayer(p => {
      if (!p) return null;
      const slot = item.type as 'weapon' | 'armor' | 'accessory';
      const prev = p.equipped[slot];
      const nextInv = p.inventory.filter(i => i.id !== item.id);
      if (prev) nextInv.push(prev);
      return { ...p, equipped: { ...p.equipped, [slot]: item }, inventory: nextInv };
    });
  }, [log]);

  const handleTileClick = useCallback((target: Position) => {
    if (gameState !== GameState.PLAYER_TURN || !player || player.actionPoints <= 0 || showDeathScreen) return;
    const tileAt = grid[target.y][target.x];
    if (tileAt.type === 'wall' && player.classType === 'ASTRAL_WEAVER' && player.phaseShiftAvailable) {
       setPlayer(p => p ? { ...p, pos: target, phaseShiftAvailable: false, actionPoints: p.actionPoints - 1 } : null);
       log("[DM] The Weaver steps through solid matter.");
       return;
    }
    const enemyAt = enemies.find(e => e.pos.x === target.x && e.pos.y === target.y);
    if (enemyAt || tileAt.type === 'box') {
      if (Math.abs(player.pos.x - target.x) + Math.abs(player.pos.y - target.y) <= (pStats?.range || 1)) {
        handleCombat(player, enemyAt || { id: `box-${target.x}-${target.y}`, pos: target, ac: 5 }, true);
      }
      return;
    }
    if (tileAt.type === 'floor' || tileAt.type === 'stairs') {
       setPlayer(p => p ? ({ ...p, pos: target, actionPoints: p.actionPoints - 1 }) : null);
       // Tutorial Progression
       if (tutorialStep === 0 && floor === 1) setTutorialStep(1);
    }
  }, [gameState, player, grid, enemies, showDeathScreen, tutorialStep, floor, log, pStats, handleCombat]);

  // Defined castSpell to resolve "Cannot find name 'castSpell'" error.
  // This function manages mana consumption, action points, and executes specific spell logic
  // including mental energy bolts, AOE void novas, and health-for-mana sacrifices.
  const castSpell = useCallback(async (spell: Spell) => {
    if (!player || player.mana < spell.manaCost || player.actionPoints <= 0) {
      log("[DM] Your spirit wavers. Insufficient mana or focus for this ritual.");
      return;
    }

    setPlayer(p => p ? { ...p, mana: p.mana - spell.manaCost, actionPoints: p.actionPoints - 1 } : null);

    if (spell.id === 'bolt') {
      const target = enemies.find(e => {
        const d = Math.abs(e.pos.x - player.pos.x) + Math.abs(e.pos.y - player.pos.y);
        return d <= spell.range;
      });
      if (target) {
        rendererRef.current?.triggerMindBolt(player.pos, target.pos);
        const flavor = await getCombatFlavor(player.name, target.name, spell.name, 10);
        log(`[DM] ${flavor}`);
        handleCombat(player, target, true);
      } else {
        log("[DM] The mind bolt dissipates into the dark. No target found.");
      }
    } else if (spell.id === 'nova') {
      rendererRef.current?.triggerMagicCircle(player.pos);
      enemies.forEach(e => {
        const d = Math.abs(e.pos.x - player.pos.x) + Math.abs(e.pos.y - player.pos.y);
        if (d <= 1) handleCombat(player, e, true);
      });
      log("[DM] A void nova erupts from your core, tearing at nearby shadows.");
    } else if (spell.id === 'sacrifice') {
      setPlayer(p => p ? ({ ...p, hp: Math.max(1, p.hp - 10), mana: Math.min(p.maxMana, p.mana + 30) }) : null);
      log("[DM] You offer a pint of blood for a draft of pure magic.");
    }
  }, [player, enemies, handleCombat, log]);

  const selectClass = (type: ClassType) => {
    initAudio();
    const defaults = { 
      ASTRAL_WEAVER: { hp: 60, mana: 100, int: 20, ap: 2, r: 1 },
      PALADIN: { hp: 160, mana: 40, int: 5, ap: 2, r: 1 },
      ROGUE: { hp: 110, mana: 40, int: 5, ap: 4, r: 1 },
      DEPRIVED: { hp: 100, mana: 30, int: 0, ap: 3, r: 1 }
    }[type as keyof typeof defaults] || { hp: 100, mana: 50, int: 5, ap: 3, r: 1 };
    
    const spellbook: Spell[] = [];
    if (type === 'ASTRAL_WEAVER') spellbook.push({ id: 'bolt', name: 'Mind Bolt', manaCost: 5, description: 'Piercing mental energy.', range: 4, type: 'damage', effect: () => {} });
    spellbook.push({ id: 'nova', name: 'Void Nova', manaCost: 20, description: '3x3 AOE blast.', range: 1, type: 'damage', effect: () => {} });
    spellbook.push({ id: 'sacrifice', name: 'Blood Rite', manaCost: 0, description: '-10 HP for +30 MP.', range: 0, type: 'utility', effect: () => {} });
    
    const newP: Entity = { 
      id: 'player', name: type, classType: type, maxHp: defaults.hp, hp: defaults.hp, mana: defaults.mana, maxMana: defaults.mana, intelligence: defaults.int,
      attackBonus: 5, defense: 0, ac: 10, actionPoints: defaults.ap, maxActionPoints: defaults.ap, range: defaults.r, pos: { x: 1, y: 1 }, inventory: [], equipped: {}, skills: [], 
      permanentAbilities: [], skillPoints: 0, smiteAvailable: type === 'PALADIN', phaseShiftAvailable: type === 'ASTRAL_WEAVER', spellbook 
    };
    
    setPlayer(newP); 
    setFloor(1); 
    initDungeon(1); 
    setGameState(GameState.DM_PAUSE);
    rendererRef.current?.setMenuMode(false);
    setTutorialStep(0);
  };

  const initDungeon = (floorNum: number) => {
    const ng: Tile[][] = Array.from({ length: GRID_HEIGHT }, () => Array.from({ length: GRID_WIDTH }, () => ({ type: 'wall' })));
    let x = 1, y = 1; ng[y][x].type = 'floor';
    for (let i = 0; i < 60; i++) {
      const d = [[0,1],[0,-1],[1,0],[-1,0]][Math.floor(Math.random()*4)];
      x = Math.max(1, Math.min(GRID_WIDTH-2, x+d[0])); y = Math.max(1, Math.min(GRID_HEIGHT-2, y+d[1]));
      ng[y][x].type = 'floor';
    }
    const spawned: Entity[] = [];
    for (let i = 0; i < 3 + floorNum; i++) {
      let ex, ey; do { ex = Math.floor(Math.random()*GRID_WIDTH); ey = Math.floor(Math.random()*GRID_HEIGHT); } while (ng[ey][ex].type !== 'floor' || (ex===1 && ey===1));
      spawned.push({ id: `en-${Date.now()}-${i}`, name: 'Skeleton', classType: 'FIGHTER' as any, hp: 40, maxHp: 40, attackBonus: 5, defense: 2, ac: 12, actionPoints: 1, maxActionPoints: 1, range: 1, pos: { x: ex, y: ey }, inventory: [], equipped: {}, skills: [], permanentAbilities: [], skillPoints: 0, smiteAvailable: false, phaseShiftAvailable: false, spellbook: [], mana: 0, maxMana: 0, intelligence: 0 });
    }
    let sx, sy; do { sx = Math.floor(Math.random()*GRID_WIDTH); sy = Math.floor(Math.random()*GRID_HEIGHT); } while (ng[sy][sx].type !== 'floor' || (sx===1 && sy===1));
    ng[sy][sx].type = 'stairs';
    setGrid(ng); setEnemies(spawned); rendererRef.current?.initGrid(ng);
  };

  useEffect(() => {
    if (containerRef.current && !rendererRef.current) {
      rendererRef.current = new Renderer(containerRef.current, handleTileClick);
    }
  }, [handleTileClick]);

  useEffect(() => {
    if (floor === 1 && gameState === GameState.PLAYER_TURN) {
      if (tutorialStep === 0) log("Click the stone to move... stay in the light to survive.");
      else if (tutorialStep === 1) log("Smash the wooden crates to find the relics of the fallen.");
      else if (tutorialStep === 2) log("Open your Inventory to equip your destiny.");
    }
  }, [tutorialStep, floor, gameState, log]);

  useEffect(() => {
    if (player && (player.pos.x === -1 || (grid[player.pos.y] && grid[player.pos.y][player.pos.x] && grid[player.pos.y][player.pos.x].type === 'stairs'))) {
      const choices = Array.from({ length: 3 }, () => ({ ...SKILL_UPGRADES[Math.floor(Math.random() * SKILL_UPGRADES.length)], id: `up-${Date.now()}-${Math.random()}` }));
      setAvailableUpgrades(choices);
      setGameState(GameState.UPGRADE_SELECT);
      const nextFloor = floor + 1;
      setFloor(nextFloor); initDungeon(nextFloor);
      setPlayer(p => p ? { ...p, pos: { x: 1, y: 1 } } : null);
    }
  }, [player?.pos, floor, grid]);

  useEffect(() => {
    const animate = () => { 
      if (gameState !== GameState.GAME_OVER) {
        rendererRef.current?.update(player, enemies);
      }
      requestRef.current = requestAnimationFrame(animate); 
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [player, enemies, gameState]);

  const castSpellHandler = (s: Spell) => castSpell(s);

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen bg-[#050508] p-2 text-[#d4af37] ${showDeathScreen ? 'death-grayscale' : ''}`}>
      <div id="game-container" className="flex flex-col lg:flex-row gap-4 relative z-10 w-full max-w-6xl">
        <div ref={containerRef} className="relative stone-slab shadow-2xl overflow-hidden mx-auto" style={{ width: isMobile ? '100vw' : 640, height: isMobile ? '100vw' : 640 }}>
          <div className="crt-overlay"></div>
          <div className="vignette"></div>
          {isMobile && floatingTextQueue.map(t => <div key={t.id} className="floating-dm-text" style={{ left: t.pos.x, top: t.pos.y }}>{t.text}</div>)}
          
          {showDeathScreen && (
            <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/40 text-center px-6">
              <h2 className="text-7xl font-black text-[#ff0000] drop-shadow-[0_0_20px_#ff0000] uppercase tracking-tighter mb-4">YOU PERISHED</h2>
              <div className="parchment border-[#4a0404] p-4 bg-black/80 max-w-sm">
                <p className="text-sm italic text-gray-200">"{eulogyText || `The void claims another. Floor ${floor} is your tomb.`}"</p>
              </div>
            </div>
          )}

          {gameState === GameState.START_MENU && (
            <div className="absolute inset-0 z-50 p-4 flex flex-col items-center justify-center bg-black/80">
              <h1 className="text-7xl text-[#4a0404] font-black uppercase mb-2 tracking-tighter drop-shadow-[0_0_10px_#4a0404]">Grave-Born</h1>
              <p className="text-[10px] uppercase text-[#3d0158] tracking-[0.4em] mb-8 font-bold">Arcade 3D Dungeon Crawl</p>
              <div className="grid grid-cols-2 gap-4 w-full max-w-md mt-6">
                {['PALADIN', 'ROGUE', 'DEPRIVED', 'ASTRAL_WEAVER'].map(c => (
                  <button key={c} onClick={() => selectClass(c as ClassType)} onMouseEnter={() => setHoveredClass(c as ClassType)} className="stone-slab p-3 text-xs uppercase font-bold tracking-widest">{c}</button>
                ))}
              </div>
              <div className="mt-8 flex gap-6">
                <button onClick={() => setGameState(GameState.LEADERBOARD)} className="text-[10px] text-[#8a7500] uppercase border-b border-[#8a7500]">Hall of Heroes</button>
              </div>
            </div>
          )}

          {gameState === GameState.LEADERBOARD && (
            <div className="absolute inset-0 z-50 p-8 bg-black/95 flex flex-col items-center overflow-y-auto">
              <h2 className="text-4xl font-black uppercase mb-6 text-[#8a7500]">The Hall of Heroes</h2>
              <div className="w-full max-w-sm space-y-2">
                {leaderboard.map((e, i) => (
                  <div key={i} className="parchment flex justify-between text-[11px] uppercase">
                    <span>{e.name} ({e.classType})</span>
                    <span>Floor {e.floor} • {e.score} pts</span>
                  </div>
                ))}
                {leaderboard.length === 0 && <p className="text-center text-xs italic text-gray-600">No souls have been etched yet.</p>}
              </div>
              <button onClick={() => setGameState(GameState.START_MENU)} className="mt-8 stone-slab px-10 py-3 uppercase text-sm font-black">Return</button>
            </div>
          )}

          {gameState === GameState.DM_PAUSE && (
             <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6 text-center">
               <div className="parchment max-w-md">
                <p className="text-xl italic text-gray-200">"{dmText || "Awaken, Vessel. The void awaits."}"</p>
               </div>
               <button onClick={() => { setGameState(GameState.PLAYER_TURN); generateRoomDescription().then(msg => log(msg)); }} className="mt-8 px-16 py-4 stone-slab text-purple-300 uppercase font-black text-lg tracking-widest">Enter the Abyss</button>
             </div>
          )}

          {gameState === GameState.UPGRADE_SELECT && (
             <div className="absolute inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center p-8">
                <h2 className="text-2xl font-black uppercase mb-8 text-[#3d0158] tracking-widest">Ascension Offered</h2>
                <div className="space-y-4 w-full max-w-sm">
                  {availableUpgrades.map(u => (
                    <button key={u.id} onClick={() => { setPlayer(p => p ? { ...p, skills: [...p.skills, u] } : null); setGameState(GameState.PLAYER_TURN); }} className="stone-slab p-4 w-full text-left hover:scale-105 transition-transform">
                      <div className="text-xs font-black text-purple-300 uppercase">{u.name}</div>
                      <div className="text-[10px] text-gray-500">{u.description}</div>
                    </button>
                  ))}
                </div>
             </div>
          )}
        </div>

        <div className="w-full lg:w-96 flex flex-col gap-2 h-[640px]">
          <div className="stone-slab p-4">
             <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-black text-purple-400 uppercase">{player?.name || 'VESSEL'}</h2>
                <div className="text-[12px] font-black text-[#8a7500]">FLOOR {floor}</div>
             </div>
             <div className="space-y-1">
               <div className="h-3 bg-black border border-[#4a0404] relative">
                  <div className="h-full bg-[#ff0000] transition-all duration-500" style={{ width: `${(player?.hp || 0)/(pStats?.maxHp || 1)*100}%` }}></div>
                  <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white">HP: {player?.hp}/{pStats?.maxHp}</div>
               </div>
               <div className="h-3 bg-black border border-blue-900 relative">
                  <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${(player?.mana || 0)/(player?.maxMana || 1)*100}%` }}></div>
                  <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white">MP: {player?.mana}/{player?.maxMana}</div>
               </div>
             </div>
             <div className="grid grid-cols-3 gap-1 text-[9px] uppercase mt-3">
                <div className="parchment p-1 flex flex-col items-center"><span>ATK</span><span className="text-white">+{pStats?.attackBonus}</span></div>
                <div className="parchment p-1 flex flex-col items-center"><span>INT</span><span className="text-white">{pStats?.intelligence}</span></div>
                <div className="parchment p-1 flex flex-col items-center"><span>AP</span><span className="text-white">{player?.actionPoints}</span></div>
             </div>
          </div>

          <div className="stone-slab p-4 flex-1 flex flex-col min-h-0">
             <h3 className="text-[10px] font-black uppercase mb-2 border-b border-[#3d0158] flex justify-between">
              <span>Grimoire</span>
              <span>{player?.mana} / {player?.maxMana}</span>
             </h3>
             <div className="grid grid-cols-2 gap-2 mb-4">
                {player?.spellbook.map(s => (
                  <button key={s.id} onClick={() => castSpellHandler(s)} className="parchment p-1 text-[8px] uppercase hover:border-[#00ff66] text-center">
                    {s.name} <br/> <span className="text-blue-400">{s.manaCost} MP</span>
                  </button>
                ))}
             </div>
             <h3 className="text-[10px] font-black uppercase mb-2 border-b border-[#3d0158]">Chronicle</h3>
             <div className="flex-1 overflow-y-auto text-[8px] text-gray-500 italic custom-scrollbar space-y-1">
                {combatLog.map((l, i) => <div key={i} className={i === 0 ? 'text-gray-200' : ''}>{l}</div>)}
             </div>
          </div>
          
          <div className="stone-slab p-4">
            <h3 className="text-[10px] font-black uppercase mb-2 border-b border-[#3d0158]">Backpack</h3>
            <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto custom-scrollbar">
               {player?.inventory.map(item => (
                 <div key={item.id} className="parchment p-1 text-[8px] flex justify-between items-center uppercase">
                    <span className={item.rarity === 'LEGENDARY' ? 'text-yellow-500' : ''}>{item.name}</span>
                    <button onClick={() => handleEquip(item)} className="px-2 py-0.5 stone-slab border-gray-600 text-[8px]">EQUIP</button>
                 </div>
               ))}
               {player?.inventory.length === 0 && <p className="text-[8px] italic text-gray-600 text-center">Empty...</p>}
            </div>
          </div>
        </div>
      </div>

      {isMobile && gameState === GameState.PLAYER_TURN && !showDeathScreen && (
        <>
          <div id="joystick-container">
            <div id="joystick-knob" />
          </div>
          <button id="action-button" onClick={() => log("Use movement to attack adjacent targets.")} className="stone-slab text-red-600 border-red-600 shadow-[0_0_15px_rgba(255,0,0,0.5)]">ACTION</button>
        </>
      )}
    </div>
  );
};

export default App;
