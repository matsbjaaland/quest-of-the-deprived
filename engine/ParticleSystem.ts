
import { Particle } from '../types';
import { COLORS, PIXEL_SIZE } from '../constants';

export class ParticleSystem {
  particles: Particle[] = [];

  createExplosion(x: number, y: number, color: string = COLORS.SOUL_GREEN, count: number = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: Math.random() * 30 + 20,
        color,
        size: PIXEL_SIZE
      });
    }
  }

  createSwarm(startX: number, startY: number, targetX: number, targetY: number, color: string, count: number = 25) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: startX + (Math.random() - 0.5) * 20,
        y: startY + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 0,
        maxLife: 60,
        color,
        size: PIXEL_SIZE,
        targetX,
        targetY
      });
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      if (p.targetX !== undefined && p.targetY !== undefined) {
        // Homing logic
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          p.vx += (dx / dist) * 0.4;
          p.vy += (dy / dist) * 0.4;
        }
        // Friction
        p.vx *= 0.95;
        p.vy *= 0.95;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      // Snap to grid
      const sx = Math.floor(p.x / PIXEL_SIZE) * PIXEL_SIZE;
      const sy = Math.floor(p.y / PIXEL_SIZE) * PIXEL_SIZE;
      ctx.fillRect(sx, sy, p.size, p.size);
    }
    ctx.restore();
  }
}
