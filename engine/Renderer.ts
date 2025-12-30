
import * as THREE from 'three';
import { COLORS, GRID_WIDTH, GRID_HEIGHT } from '../constants';
import { Entity, Tile, Position, ItemRarity, ClassType } from '../types';

interface TrailParticle {
  mesh: THREE.Mesh;
  life: number;
}

export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private playerMesh?: THREE.Group;
  private playerShell?: THREE.Mesh;
  private magicCircle?: THREE.Mesh;
  private enemyMeshes: Map<string, { group: THREE.Group; aura?: THREE.PointLight }> = new Map();
  private floorMeshes: THREE.Mesh[] = [];
  private wallMeshes: THREE.Mesh[] = [];
  private boxMeshes: Map<string, THREE.Mesh> = new Map();
  private itemMeshes: Map<string, { mesh: THREE.Mesh; light?: THREE.PointLight; beam?: THREE.Mesh }> = new Map();
  private stairsMesh?: THREE.Mesh;
  private playerLight?: THREE.PointLight;
  private menuTorches: THREE.PointLight[] = [];
  private trailParticles: TrailParticle[] = [];
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private container: HTMLDivElement;
  
  private dustMotes: THREE.Points;
  private burstParticles: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private originalCameraPos = new THREE.Vector3(12, 12, 12);
  private tick = 0;
  private potionFlashTick = 0;
  private distortTick = 0;
  private targetFogColor = new THREE.Color(0x050510);
  private currentFogColor = new THREE.Color(0x050510);
  private isMenuMode = true;
  private previewGroup?: THREE.Group;

  constructor(container: HTMLDivElement, onTileClick: (pos: Position) => void) {
    this.container = container;
    this.scene = new THREE.Scene();
    
    const skyGeo = new THREE.SphereGeometry(100, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x050510, side: THREE.BackSide });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
    
    this.scene.fog = new THREE.FogExp2(0x050510, 0.07);

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    this.camera.position.set(0, 1.6, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, depth: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.setPixelRatio(0.25); 
    container.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0x222244, 0.4);
    this.scene.add(ambient);

    this.playerLight = new THREE.PointLight(0xddeeff, 10, 15);
    this.playerLight.castShadow = true;
    this.scene.add(this.playerLight);

    const moteGeo = new THREE.BufferGeometry();
    const moteCount = 400;
    const motePositions = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePositions[i * 3] = Math.random() * GRID_WIDTH * 2 - GRID_WIDTH;
      motePositions[i * 3 + 1] = Math.random() * 6;
      motePositions[i * 3 + 2] = Math.random() * GRID_HEIGHT * 2 - GRID_HEIGHT;
    }
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
    this.dustMotes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending }));
    this.scene.add(this.dustMotes);

    // Magic Circle Mesh
    const circleGeo = new THREE.RingGeometry(0.8, 0.9, 32);
    const circleMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, transparent: true, opacity: 0 });
    this.magicCircle = new THREE.Mesh(circleGeo, circleMat);
    this.magicCircle.rotation.x = Math.PI / 2;
    this.scene.add(this.magicCircle);

    this.initMenuHallway();
  }

  private initMenuHallway() {
    const wallGeo = new THREE.BoxGeometry(1, 10, 20);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 });
    const leftWall = new THREE.Mesh(wallGeo, wallMat); leftWall.position.set(-3, 5, 0);
    const rightWall = new THREE.Mesh(wallGeo, wallMat); rightWall.position.set(3, 5, 0);
    this.scene.add(leftWall, rightWall);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 20), new THREE.MeshStandardMaterial({ color: 0x050505 }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    const torch1 = new THREE.PointLight(0xffaa00, 10, 12); torch1.position.set(-2.5, 3, 2);
    const torch2 = new THREE.PointLight(0xffaa00, 10, 12); torch2.position.set(2.5, 3, 2);
    this.menuTorches.push(torch1, torch2); this.scene.add(torch1, torch2);
  }

  public setMenuMode(active: boolean) {
    this.isMenuMode = active;
    if (active) {
      this.camera.position.set(0, 1.6, 6);
      this.camera.lookAt(0, 1.6, 0);
    }
    this.menuTorches.forEach(t => t.visible = active);
  }

  public setPreviewModel(type: ClassType | null) {
    if (this.previewGroup) this.scene.remove(this.previewGroup);
    if (!type) return;
    this.previewGroup = this.createEntityMesh(type);
    this.previewGroup.position.set(0, 0.5, 2);
    const pl = new THREE.PointLight(type === 'ASTRAL_WEAVER' ? 0x00ffff : 0xaa00ff, 5, 5);
    pl.position.set(0, 1.5, 2.5);
    this.previewGroup.add(pl);
    this.scene.add(this.previewGroup);
  }

  public triggerMagicCircle(pos: Position) {
    if (this.magicCircle) {
      this.magicCircle.position.set(pos.x, 0.08, pos.y);
      (this.magicCircle.material as THREE.MeshBasicMaterial).opacity = 1;
      this.distortTick = 30;
    }
  }

  public triggerMindBolt(from: Position, to: Position) {
    const points = [new THREE.Vector3(from.x, 0.6, from.y), new THREE.Vector3(to.x, 0.6, to.y)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xee82ee, linewidth: 2 });
    const line = new THREE.Line(lineGeo, lineMat);
    this.scene.add(line);
    setTimeout(() => this.scene.remove(line), 200);
  }

  public getPlayerScreenPosition() {
    if (!this.playerMesh) return null;
    const v = new THREE.Vector3();
    this.playerMesh.getWorldPosition(v);
    v.y += 1.2;
    v.project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.container.clientWidth, y: (-(v.y * 0.5 - 0.5) * this.container.clientHeight) };
  }

  public triggerPotionFlash() { this.potionFlashTick = 30; }
  public shakeCamera(intensity: number, duration: number) { this.shakeIntensity = intensity; this.shakeDuration = duration; }
  public spawnBurst(pos: THREE.Vector3, color: number, count = 20) {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(geo, mat); p.position.copy(pos);
      const v = new THREE.Vector3((Math.random()-0.5)*0.2, Math.random()*0.2, (Math.random()-0.5)*0.2);
      this.scene.add(p); this.burstParticles.push({ mesh: p, velocity: v, life: 1.0 });
    }
  }

  initGrid(grid: Tile[][]) {
    this.floorMeshes.forEach(m => this.scene.remove(m));
    this.wallMeshes.forEach(m => this.scene.remove(m));
    this.boxMeshes.forEach(m => this.scene.remove(m));
    this.itemMeshes.forEach(i => { this.scene.remove(i.mesh); });
    this.floorMeshes = []; this.wallMeshes = []; this.boxMeshes.clear(); this.itemMeshes.clear();
    const floorGeo = new THREE.BoxGeometry(1, 0.15, 1);
    const wallGeo = new THREE.BoxGeometry(1, 5, 1);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x202025 });
    for (let z = 0; z < GRID_HEIGHT; z++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const t = grid[z][x];
        if (t.type === 'wall') {
          const m = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ color: 0x0a0a0f }));
          m.position.set(x, 2.5, z); this.scene.add(m); this.wallMeshes.push(m);
        } else if (t.type === 'box') {
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.7,0.7), new THREE.MeshStandardMaterial({ color: 0x3d251e }));
          m.position.set(x,0.4,z); this.scene.add(m); this.boxMeshes.set(`${x},${z}`, m);
          const f = new THREE.Mesh(floorGeo, floorMat); f.position.set(x,0,z); this.scene.add(f); this.floorMeshes.push(f);
        } else {
          const m = new THREE.Mesh(floorGeo, floorMat); m.position.set(x,0,z); this.scene.add(m); this.floorMeshes.push(m);
          if (t.type === 'stairs') {
            this.stairsMesh = new THREE.Mesh(new THREE.TorusKnotGeometry(0.3,0.1), new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff }));
            this.stairsMesh.position.set(x,0.5,z); this.scene.add(this.stairsMesh);
          }
        }
      }
    }
  }

  private createEntityMesh(type: string) {
    const g = new THREE.Group();
    let color = { FIGHTER: 0x4477ff, RANGER: 0x44ff77, BARBARIAN: 0xff4444, ROGUE: 0x00ffaa, PALADIN: 0xffff00, DEPRIVED: 0x999999, ASTRAL_WEAVER: 0x00ffff, ENEMY: 0xaaaaaa }[type] || 0xcccccc;
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, transparent: type === 'ASTRAL_WEAVER', opacity: type === 'ASTRAL_WEAVER' ? 0.6 : 1 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.7), mat);
    m.position.y = 0.45; m.castShadow = true; g.add(m);
    return g;
  }

  update(player: Entity | null, enemies: Entity[]) {
    this.tick++;
    if (this.isMenuMode) {
      if (this.previewGroup) this.previewGroup.rotation.y += 0.02;
    } else if (player) {
      if (!this.playerMesh) { this.playerMesh = this.createEntityMesh(player.classType); this.scene.add(this.playerMesh); }
      
      // Star Dust Trail for Astral Weaver
      if (player.classType === 'ASTRAL_WEAVER' && this.tick % 5 === 0) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.1), new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true }));
        p.position.copy(this.playerMesh.position).add(new THREE.Vector3((Math.random()-0.5)*0.5, 0.2, (Math.random()-0.5)*0.5));
        this.scene.add(p); this.trailParticles.push({ mesh: p, life: 1.0 });
      }

      const isWeak = player.classType === 'DEPRIVED' && player.inventory.length === 0;
      this.playerLight!.intensity = isWeak ? 2 : 10;
      this.playerLight!.position.copy(this.playerMesh.position).add(new THREE.Vector3(0, 1.8, 0));
      this.playerMesh.position.x += (player.pos.x - this.playerMesh.position.x) * 0.15;
      this.playerMesh.position.z += (player.pos.y - this.playerMesh.position.z) * 0.15;
      this.playerMesh.position.y = Math.sin(this.tick * 0.1) * 0.05 + 0.15;

      const targetCam = new THREE.Vector3(player.pos.x + 9, 12, player.pos.y + 9);
      this.originalCameraPos.lerp(targetCam, 0.05); this.camera.position.copy(this.originalCameraPos);
      if (this.shakeDuration > 0) {
        this.camera.position.add(new THREE.Vector3((Math.random()-0.5)*this.shakeIntensity, (Math.random()-0.5)*this.shakeIntensity, (Math.random()-0.5)*this.shakeIntensity));
        this.shakeDuration--;
      }
      this.camera.lookAt(this.playerMesh.position);
      
      // Magic Circle animation
      if (this.magicCircle && (this.magicCircle.material as THREE.MeshBasicMaterial).opacity > 0) {
        this.magicCircle.rotation.z += 0.05;
        (this.magicCircle.material as THREE.MeshBasicMaterial).opacity -= 0.02;
      }
    }

    // Process particles
    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
      const p = this.burstParticles[i]; p.mesh.position.add(p.velocity); p.life -= 0.02;
      p.mesh.scale.setScalar(p.life); if (p.life <= 0) { this.scene.remove(p.mesh); this.burstParticles.splice(i, 1); }
    }
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const t = this.trailParticles[i]; t.life -= 0.05; (t.mesh.material as THREE.MeshBasicMaterial).opacity = t.life;
      if (t.life <= 0) { this.scene.remove(t.mesh); this.trailParticles.splice(i, 1); }
    }

    // Post-process simulation (Chromatic Aberration)
    if (this.distortTick > 0) {
      this.distortTick--;
      const amt = (this.distortTick / 30) * 10;
      this.container.style.filter = `blur(0px) brightness(1.2) contrast(1.1) drop-shadow(${amt}px 0px 0px rgba(255,0,0,0.5)) drop-shadow(${-amt}px 0px 0px rgba(0,0,255,0.5))`;
    } else {
      this.container.style.filter = '';
    }

    this.renderer.render(this.scene, this.camera);
  }
}
