
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GameState, Entity, Tile, ClassType, Item, Position } from './types';
import { Renderer } from './engine/Renderer';
import { COLORS, GRID_WIDTH, GRID_HEIGHT } from './constants';
import { getCombatFlavor, generateRoomDescription, generateEulogy } from './services/gemini';

const INITIAL_XP_NEXT = 100;

const LOOT_POOL: Omit<Item, 'id'>[] = [
  { name: 'Shattered Soul-Blade', type: 'weapon', rarity: 'COMMON', description: 'Glows with a faint green light.', modifier: { attack: 8 } },
  { name: 'Void-Touched Garb', type: 'armor', rarity: 'RARE', description: 'Fabric that absorbs light.', modifier: { defense: 6 } },
  { name: 'Neon Soul-Fire', type: 'weapon', rarity: 'LEGENDARY', description: 'Primal magic bound in metal.', modifier: { attack: 25 } },
  { name: 'Charcoal Mask', type: 'hat', rarity: 'COMMON', description: 'Hide your fear.', modifier: { defense: 3 } },
  { name: 'Ichor Draught', type: 'consumable', rarity: 'COMMON', description: 'Tastes like copper.', modifier: { hp: 50 } }
];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START_MENU);
  const [wave, setWave] = useState(1);
  const [player, setPlayer] = useState<Entity | null>(null);
  const [enemies, setEnemies] = useState<Entity[]>([]);
  const [grid, setGrid] = useState<Tile[][]>(() => 
    Array.from({ length: GRID_HEIGHT }, () => 
      Array.from({ length: GRID_WIDTH }, () => ({ type: 'floor' }))
    )
  );
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [narratorMsg, setNarratorMsg] = useState("Face the void...");
  const [deathEulogy, setDeathEulogy] = useState("");
  
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const animFrameRef = useRef<number>(0);

  const log = useCallback((msg: string) => {
    setCombatLog(prev => [msg, ...prev].slice(0, 8));
    setNarratorMsg(msg);
  }, []);

  const initGame = (type: ClassType) => {
    const isDeprived = type === 'DEPRIVED';
    const newPlayer: Entity = {
      id: 'player',
      name: 'Soul-Seeker',
      classType: type,
      hp: isDeprived ? 50 : 100,
      maxHp: isDeprived ? 50 : 100,
      mana: 50,
      maxMana: 50,
      intelligence: isDeprived ? 5 : 10,
      attackBonus: isDeprived ? 4 : 12,
      defense: isDeprived ? 0 : 6,
      ac: isDeprived ? 10 : 14,
      actionPoints: 3,
      maxActionPoints: 3,
      range: 1,
      pos: { x: 1, y: 1 },
      inventory: [],
      equipped: {},
      gold: 0,
      xp: 0,
      level: 1
    };
    setPlayer(newPlayer);
    setWave(1);
    generateFloor(1);
    setGameState(GameState.PLAYER_TURN);
    log("The darkness takes another victim.");
  };

  const generateFloor = (lvl: number) => {
    const ng: Tile[][] = Array.from({ length: GRID_HEIGHT }, () => 
      Array.from({ length: GRID_WIDTH }, () => ({ type: 'floor' }))
    );
    
    // Aesthetic Wall Generation
    for (let i = 0; i < 6; i++) {
      const rx = Math.floor(Math.random() * GRID_WIDTH);
      const ry = Math.floor(Math.random() * GRID_HEIGHT);
      if (rx >= 0 && rx < GRID_WIDTH && ry >= 0 && ry < GRID_HEIGHT) {
        if (!(rx === 1 && ry === 1) && !(rx === GRID_WIDTH-1 && ry === GRID_HEIGHT-1)) {
          if (ng[ry]) ng[ry][rx].type = 'wall';
        }
      }
    }

    // Soul-Chests
    for (let i = 0; i < 2; i++) {
      let cx, cy;
      do {
        cx = Math.floor(Math.random() * GRID_WIDTH);
        cy = Math.floor(Math.random() * GRID_HEIGHT);
      } while (!ng[cy] || !ng[cy][cx] || ng[cy][cx].type !== 'floor' || (cx === 1 && cy === 1));
      if (ng[cy]) ng[cy][cx].type = 'box';
    }

    // Grim Enemies
    const spawned: Entity[] = [];
    const count = 2 + Math.floor(lvl / 1.5);
    for (let i = 0; i < count; i++) {
      let ex, ey;
      do {
        ex = Math.floor(Math.random() * GRID_WIDTH);
        ey = Math.floor(Math.random() * GRID_HEIGHT);
      } while (!ng[ey] || !ng[ey][ex] || ng[ey][ex].type !== 'floor' || (ex === 1 && ey === 1));

      spawned.push({
        id: `en-${Date.now()}-${i}`,
        name: 'Void Husk',
        classType: 'FIGHTER',
        enemyType: 'SKELETON',
        hp: 40 + lvl * 15,
        maxHp: 40 + lvl * 15,
        mana: 0, maxMana: 0, intelligence: 0,
        attackBonus: 4 + lvl, defense: 2, ac: 8 + lvl,
        actionPoints: 1, maxActionPoints: 1, range: 1,
        pos: { x: ex, y: ey },
        inventory: [], equipped: {}, gold: 15, xp: 50, level: lvl
      });
    }

    setGrid(ng);
    setEnemies(spawned);
  };

  // Fixed executeCombat to return a promise that resolves after the juice/animation timeout to sequence turns correctly
  const executeCombat = async (attacker: Entity, target: Entity, isPlayerAttacking: boolean) => {
    if (!attacker || !target) return;
    setGameState(GameState.ANIMATING);
    
    // Screen Shake and Juice
    rendererRef.current?.triggerShake(isPlayerAttacking ? 15 : 20);
    rendererRef.current?.triggerFlash();
    rendererRef.current?.spawnBurst(target.pos, isPlayerAttacking ? COLORS.SOUL_FIRE : COLORS.BLOOD_RED);

    const d20 = Math.floor(Math.random() * 20) + 1;
    const isHit = (d20 + attacker.attackBonus) >= target.ac;
    
    if (isHit) {
      const dmg = Math.floor(Math.random() * 12 + 8 + attacker.attackBonus / 2);
      if (isPlayerAttacking) {
        const nextEnemies = enemies.map(e => e.id === target.id ? { ...e, hp: e.hp - dmg } : e);
        const killed = nextEnemies.find(e => e.id === target.id && e.hp <= 0);
        
        if (killed) {
          setPlayer(p => {
            if (!p) return null;
            const newXp = p.xp + (target.xp || 50);
            if (newXp >= INITIAL_XP_NEXT * p.level) {
              setGameState(GameState.LEVEL_UP);
            }
            return { ...p, xp: newXp, gold: p.gold + (target.gold || 15) };
          });
          setEnemies(nextEnemies.filter(e => e.hp > 0));
          log(`Void-Soul extinguished: ${target.name}.`);
        } else {
          setEnemies(nextEnemies);
        }
      } else {
        setPlayer(p => {
          if (!p) return null;
          const nextHp = Math.max(0, p.hp - dmg);
          if (nextHp <= 0) {
            setGameState(GameState.GAME_OVER);
            generateEulogy(wave).then(setDeathEulogy);
          }
          return { ...p, hp: nextHp };
        });
      }
      const flavor = await getCombatFlavor(attacker.name, target.name, "Strike", dmg);
      log(flavor);
    } else {
      log(`${attacker.name} clawed at empty shadows.`);
    }

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setGameState(current => {
          if (current === GameState.GAME_OVER || current === GameState.LEVEL_UP) return current;
          return isPlayerAttacking ? GameState.PLAYER_TURN : GameState.AI_TURN;
        });
        resolve();
      }, 500);
    });
  };

  const handleTileClick = (target: Position) => {
    if (gameState !== GameState.PLAYER_TURN || !player || player.actionPoints <= 0) return;
    if (target.x < 0 || target.x >= GRID_WIDTH || target.y < 0 || target.y >= GRID_HEIGHT) return;

    const enemyAt = enemies.find(e => e.pos.x === target.x && e.pos.y === target.y);
    if (enemyAt) {
      const dist = Math.abs(player.pos.x - target.x) + Math.abs(player.pos.y - target.y);
      if (dist <= player.range) {
        executeCombat(player, enemyAt, true);
        setPlayer(p => p ? { ...p, actionPoints: p.actionPoints - 1 } : null);
      }
      return;
    }

    const row = grid[target.y];
    if (!row) return;
    const tile = row[target.x];
    if (!tile) return;

    if (tile.type === 'floor') {
      const dist = Math.abs(player.pos.x - target.x) + Math.abs(player.pos.y - target.y);
      if (dist === 1) {
        setPlayer(p => p ? { ...p, pos: target, actionPoints: p.actionPoints - 1 } : null);
      }
    } else if (tile.type === 'box') {
       const dist = Math.abs(player.pos.x - target.x) + Math.abs(player.pos.y - target.y);
       if (dist === 1) {
          const loot = LOOT_POOL[Math.floor(Math.random() * LOOT_POOL.length)];
          const item = { ...loot, id: `loot-${Date.now()}` } as Item;
          setPlayer(p => p ? { ...p, inventory: [...p.inventory, item], actionPoints: p.actionPoints - 1 } : null);
          
          setGrid(prevGrid => {
            const nextGrid = prevGrid.map((row, y) => {
              if (y === target.y) {
                return row.map((t, x) => x === target.x ? { ...t, type: 'floor' } as Tile : t);
              }
              return row;
            });
            return nextGrid;
          });
          
          log(`Plucked from the void: ${item.name}`);
       }
    }
  };

  useEffect(() => {
    if (containerRef.current && !rendererRef.current) {
      rendererRef.current = new Renderer(containerRef.current, handleTileClick);
    }
  }, [handleTileClick]);

  useEffect(() => {
    const loop = () => {
      rendererRef.current?.render(player, enemies, grid);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [player, enemies, grid]);

  // Wave Transition
  useEffect(() => {
    if (gameState === GameState.PLAYER_TURN && enemies.length === 0 && player) {
      setGameState(GameState.RESOLVE);
      setTimeout(() => {
        setWave(w => w + 1);
        generateFloor(wave + 1);
        setPlayer(p => p ? { ...p, pos: { x: 1, y: 1 }, actionPoints: p.maxActionPoints } : null);
        generateRoomDescription().then(msg => log(msg));
        setGameState(GameState.PLAYER_TURN);
      }, 1000);
    }
  }, [enemies.length, player, gameState, wave]);

  // AI Turn Logic - Fixed narrowing error by using functional update to check latest state
  useEffect(() => {
    if (gameState === GameState.AI_TURN && player) {
      const executeAiTurns = async () => {
        await new Promise(r => setTimeout(r, 600));
        
        const currentEnemies = [...enemies];
        
        for (const en of currentEnemies) {
          // Check player closure ref (simplified check for turn-based state within closure)
          if (!player || player.hp <= 0) break;

          const dist = Math.abs(en.pos.x - player.pos.x) + Math.abs(en.pos.y - player.pos.y);
          if (dist <= en.range) {
            await executeCombat(en, player, false);
          } else {
             const dx = Math.sign(player.pos.x - en.pos.x);
             const dy = Math.sign(player.pos.y - en.pos.y);
             const nextPos = { x: en.pos.x + dx, y: en.pos.y + (dx === 0 ? dy : 0) };
             
             if (nextPos.y >= 0 && nextPos.y < GRID_HEIGHT && nextPos.x >= 0 && nextPos.x < GRID_WIDTH) {
               const targetRow = grid[nextPos.y];
               if (targetRow && targetRow[nextPos.x] && targetRow[nextPos.x].type === 'floor') {
                  const isOccupied = currentEnemies.some(e => e.id !== en.id && e.pos.x === nextPos.x && e.pos.y === nextPos.y);
                  if (!isOccupied) {
                    setEnemies(prev => prev.map(e => e.id === en.id ? { ...e, pos: nextPos } : e));
                  }
               }
             }
          }
          await new Promise(r => setTimeout(r, 400));
        }
        
        // Fixed the TypeScript narrowing issue by using a functional update to check the actual current state
        setGameState(current => {
          if (current !== GameState.GAME_OVER) {
            setPlayer(p => p ? { ...p, actionPoints: p.maxActionPoints } : null);
            return GameState.PLAYER_TURN;
          }
          return current;
        });
      };
      executeAiTurns();
    }
  }, [gameState]);

  return (
    <div className="crt-container">
      <div className="narrator-bar">{narratorMsg}</div>

      <div className="flex flex-col lg:flex-row gap-8 items-start justify-center w-full px-4 mt-20">
        <div ref={containerRef} className="relative stone-ui pulse" style={{ width: 512, height: 512 }}>
          {gameState === GameState.START_MENU && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95">
              <h1 className="text-5xl font-black text-[#00ff66] mb-8 tracking-tighter uppercase chromatic-aberration">Void Reckoning</h1>
              <p className="text-[10px] tracking-[0.5em] text-gray-600 mb-12">8-BIT GRIMDARK TACTICS</p>
              <div className="flex flex-col gap-4 w-64">
                {['FIGHTER', 'ROGUE', 'DEPRIVED'].map(c => (
                  <button key={c} onClick={() => initGame(c as ClassType)} className="pixel-button">{c}</button>
                ))}
              </div>
            </div>
          )}

          {gameState === GameState.LEVEL_UP && (
            <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-8 text-center border-4 border-[#00ff66]">
              <h2 className="text-4xl text-[#00ff66] font-black mb-8">SOUL ASCENSION</h2>
              <div className="grid gap-4 w-full">
                <button onClick={() => { setPlayer(p => p ? {...p, maxHp: p.maxHp + 40, hp: p.maxHp + 40, level: p.level + 1} : null); setGameState(GameState.PLAYER_TURN); }} className="pixel-button">VITALITY (+40 HP)</button>
                <button onClick={() => { setPlayer(p => p ? {...p, attackBonus: p.attackBonus + 12, level: p.level + 1} : null); setGameState(GameState.PLAYER_TURN); }} className="pixel-button">SOUL-MIGHT (+12 ATK)</button>
              </div>
            </div>
          )}
          
          {gameState === GameState.GAME_OVER && (
            <div className="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-black/98 p-8 text-center border-4 border-[#7a0000]">
              <h2 className="text-6xl text-[#7a0000] font-black mb-4">EXTINGUISHED</h2>
              <p className="text-gray-400 mb-10 italic max-w-xs">{deathEulogy || "The void consumes all eventually."}</p>
              <button onClick={() => window.location.reload()} className="pixel-button">RECLAIM SOUL</button>
            </div>
          )}
        </div>

        <div className="w-full lg:w-80 flex flex-col gap-6">
          <div className="stone-ui p-4">
            <h3 className="text-xs text-gray-500 uppercase mb-4 tracking-widest">Soul Essence</h3>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-[#00ff66]">COHESION</span>
              <span className="text-[10px]">{player?.hp} / {player?.maxHp}</span>
            </div>
            <div className="h-4 bg-black border-2 border-gray-900 overflow-hidden relative">
              <div className="h-full bg-[#7a0000] shadow-[0_0_10px_#7a0000]" style={{ width: `${(player?.hp || 0) / (player?.maxHp || 1) * 100}%`, transition: 'width 0.3s ease' }}></div>
            </div>
            <div className="mt-6 flex justify-between text-[10px] tracking-tighter">
              <span className="text-gray-500">DEPTH: {wave}</span>
              <span className="text-[#00ffff]">{player?.xp} SOULS COLLECTED</span>
            </div>
          </div>

          <div className="stone-ui p-4">
            <h3 className="text-xs text-gray-500 uppercase mb-4 tracking-widest">Reliquary</h3>
            <div className="space-y-3 max-h-56 overflow-y-auto pr-2">
              {player?.inventory.map(item => (
                <div key={item.id} className="text-[9px] flex justify-between items-center p-2 border border-gray-900 bg-black/40">
                  <div className="flex flex-col">
                    <span className={item.rarity === 'LEGENDARY' ? 'text-[#00ff66] font-bold' : 'text-gray-400'}>{item.name}</span>
                    <span className="text-[7px] text-gray-600">{item.description}</span>
                  </div>
                  <button onClick={() => {
                    if (item.type === 'consumable') {
                      setPlayer(p => p ? { ...p, hp: Math.min(p.maxHp, p.hp + (item.modifier.hp || 0)), inventory: p.inventory.filter(i => i.id !== item.id) } : null);
                      log("Consumed restorative ichor.");
                    } else {
                      setPlayer(p => {
                        if (!p) return null;
                        const slot = item.type as keyof typeof p.equipped;
                        const prev = p.equipped[slot];
                        const nextInv = p.inventory.filter(i => i.id !== item.id);
                        if (prev) nextInv.push(prev);
                        return { ...p, equipped: { ...p.equipped, [slot]: item }, inventory: nextInv };
                      });
                      log(`Equipped ${item.name}.`);
                    }
                  }} className="text-[#00ff66] hover:text-white underline">USE</button>
                </div>
              ))}
              {player?.inventory.length === 0 && <div className="text-[10px] text-gray-700 italic">No artifacts found...</div>}
            </div>
          </div>

          <div className="stone-ui p-4 bg-black/90">
            <h3 className="text-[10px] text-gray-700 mb-3 uppercase tracking-widest">The Chronicler</h3>
            <div className="text-[8px] space-y-2 text-gray-500 h-32 overflow-hidden leading-relaxed">
              {combatLog.map((l, i) => <div key={i} className={i === 0 ? 'text-[#00ff66] opacity-100' : 'opacity-40'}>>> {l}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
