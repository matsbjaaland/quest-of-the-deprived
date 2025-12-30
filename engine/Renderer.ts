
import { COLORS, BITMASKS, PALETTES, SCREEN_WIDTH, SCREEN_HEIGHT, TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, PIXEL_SIZE } from '../constants';
import { Entity, Tile, Position } from '../types';
import { ParticleSystem } from './ParticleSystem';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private particles: ParticleSystem;
  private shakeAmount: number = 0;
  private flashFrames: number = 0;
  private frame: number = 0;

  constructor(container: HTMLDivElement, onTileClick: (pos: Position) => void) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SCREEN_WIDTH;
    this.canvas.height = SCREEN_HEIGHT;
    this.canvas.style.filter = 'contrast(1.2) brightness(1.1) saturate(1.4)';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.particles = new ParticleSystem();

    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const x = Math.floor(mouseX / (rect.width / GRID_WIDTH));
      const y = Math.floor(mouseY / (rect.height / GRID_HEIGHT));
      
      // Safety bounds check
      if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
        onTileClick({ x, y });
      }
    });
  }

  public triggerShake(amount: number = 12) {
    this.shakeAmount = amount;
  }

  public triggerFlash() {
    this.flashFrames = 8;
  }

  public spawnBurst(pos: Position, color: string) {
    if (!pos) return;
    this.particles.createExplosion(
      pos.x * TILE_SIZE + TILE_SIZE / 2,
      pos.y * TILE_SIZE + TILE_SIZE / 2,
      color,
      30
    );
  }

  private drawBitmask(mask: number[][], palette: string[], x: number, y: number, scale: number = 2) {
    if (!mask || !Array.isArray(mask) || !mask.length) return;
    const pSize = PIXEL_SIZE * scale;
    const offset = (TILE_SIZE - (8 * pSize)) / 2;
    
    for (let row = 0; row < 8; row++) {
      const maskRow = mask[row];
      if (!maskRow || !Array.isArray(maskRow)) continue;
      for (let col = 0; col < 8; col++) {
        const val = maskRow[col];
        if (val > 0) {
          this.ctx.fillStyle = palette[val - 1] || palette[0];
          this.ctx.fillRect(
            Math.floor(x + offset + col * pSize),
            Math.floor(y + offset + row * pSize),
            pSize,
            pSize
          );
        }
      }
    }
  }

  public render(player: Entity | null, enemies: Entity[], grid: Tile[][]) {
    if (!grid || !Array.isArray(grid)) return;
    this.frame++;
    this.ctx.save();
    
    // Screen Shake
    if (this.shakeAmount > 0) {
      this.ctx.translate(
        (Math.random() - 0.5) * this.shakeAmount,
        (Math.random() - 0.5) * this.shakeAmount
      );
      this.shakeAmount *= 0.85;
      if (this.shakeAmount < 0.5) this.shakeAmount = 0;
    }

    // Deep Dark Background
    this.ctx.fillStyle = COLORS.WALL_BLACK;
    this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // Grid Rendering with 8-bit texture
    for (let y = 0; y < GRID_HEIGHT; y++) {
      const row = grid[y];
      if (!row || !Array.isArray(row)) continue;
      for (let x = 0; x < GRID_WIDTH; x++) {
        const tile = row[x];
        if (!tile) continue;
        const tx = x * TILE_SIZE;
        const ty = y * TILE_SIZE;

        // Charcoal stone texture
        this.ctx.fillStyle = COLORS.CHARCOAL;
        this.ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
        
        // Grid lines
        this.ctx.strokeStyle = COLORS.DEEP_PURPLE;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE);

        if (tile.type === 'wall') {
          this.drawBitmask(BITMASKS.WALL, PALETTES.WALL, tx, ty, 1.8);
        } else if (tile.type === 'box') {
          this.drawBitmask(BITMASKS.CHEST, PALETTES.CHEST, tx, ty, 1.5);
        }
      }
    }

    // Ghostly Enemies
    enemies.forEach(en => {
      if (!en || !en.pos) return;
      const ex = en.pos.x * TILE_SIZE;
      const ey = en.pos.y * TILE_SIZE;
      const bob = Math.sin(this.frame * 0.12 + en.pos.x) * 4;
      
      this.drawBitmask(BITMASKS.SKELETON, PALETTES.SKELETON, ex, ey + bob, 1.8);
      
      // HP Bar (8-bit style)
      const hpW = (en.hp / en.maxHp) * (TILE_SIZE - 20);
      this.ctx.fillStyle = '#110000';
      this.ctx.fillRect(ex + 10, ey + 4, TILE_SIZE - 20, 6);
      this.ctx.fillStyle = COLORS.BLOOD_RED;
      this.ctx.fillRect(ex + 10, ey + 4, Math.max(0, hpW), 6);
    });

    // Grimdark Player
    if (player && player.pos) {
      const px = player.pos.x * TILE_SIZE;
      const py = player.pos.y * TILE_SIZE;
      const breathe = Math.sin(this.frame * 0.1) * 3;
      
      const pal = player.classType === 'ROGUE' ? PALETTES.ROGUE : PALETTES.FIGHTER;
      this.drawBitmask(BITMASKS.PLAYER_BASE, pal, px, py + breathe, 1.8);
    }

    // Soul-Fire Particles
    this.particles.update();
    this.particles.draw(this.ctx);

    // Magic Flash Overlay
    if (this.flashFrames > 0) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${this.flashFrames * 0.12})`;
      this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      this.flashFrames--;
    }

    // Vignette Effect for Grimdark atmosphere
    const grad = this.ctx.createRadialGradient(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 100, SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 400);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.8)');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    this.ctx.restore();
  }
}
