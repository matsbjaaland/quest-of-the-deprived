
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
  private enemyMeshes: Map<string, THREE.Group> = new Map();
  private floorMeshes: THREE.Mesh[] = [];
  private wallMeshes: THREE.Mesh[] = [];
  private boxMeshes: Map<string, THREE.Mesh> = new Map();
  private stairsMesh?: THREE.Mesh;
  private playerLight?: THREE.PointLight;
  private trailParticles: TrailParticle[] = [];
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private container: HTMLDivElement;
  private magicCircle?: THREE.Mesh;
  
  private dustMotes: THREE.Points;
  private burstParticles: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private originalCameraPos = new THREE.Vector3(10, 10, 10);
  private tick = 0;
  private potionFlashTick = 0;
  private isMenuMode = true;

  constructor(container: HTMLDivElement, onTileClick: (pos: Position) => void) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050510);
    this.scene.fog = new THREE.FogExp2(0x050510, 0.08);

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    this.camera.position.set(10, 10, 10);

    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(0.25); // 8-bit aesthetic
    container.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0x222244, 0.4);
    this.scene.add(ambient);

    this.playerLight = new THREE.PointLight(0x00ff66, 10, 12);
    this.scene.add(this.playerLight);

    // Dust motes
    const moteGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(300 * 3);
    for(let i=0; i<300; i++) {
        positions[i*3] = Math.random()*20-10;
        positions[i*3+1] = Math.random()*5;
        positions[i*3+2] = Math.random()*20-10;
    }
    moteGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dustMotes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, transparent: true, opacity: 0.3 }));
    this.scene.add(this.dustMotes);

    // Magic circle
    const circleGeo = new THREE.RingGeometry(0.8, 1.0, 32);
    const circleMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, transparent: true, opacity: 0 });
    this.magicCircle = new THREE.Mesh(circleGeo, circleMat);
    this.magicCircle.rotation.x = Math.PI/2;
    this.scene.add(this.magicCircle);

    // Raycasting
    container.addEventListener('mousedown', (event) => {
        const rect = container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.floorMeshes.concat(Array.from(this.boxMeshes.values())));
        if (intersects.length > 0) {
            const pos = intersects[0].object.position;
            onTileClick({ x: Math.round(pos.x), y: Math.round(pos.z) });
        }
    });
  }

  public setMenuMode(active: boolean) { this.isMenuMode = active; }

  public triggerMagicCircle(pos: Position) {
    if (this.magicCircle) {
      this.magicCircle.position.set(pos.x, 0.1, pos.y);
      (this.magicCircle.material as THREE.MeshBasicMaterial).opacity = 1;
    }
  }

  public triggerMindBolt(from: Position, to: Position) {
    const points = [new THREE.Vector3(from.x, 0.5, from.y), new THREE.Vector3(to.x, 0.5, to.y)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xee82ee });
    const line = new THREE.Line(lineGeo, lineMat);
    this.scene.add(line);
    setTimeout(() => this.scene.remove(line), 150);
  }

  public getPlayerScreenPosition() {
    if (!this.playerMesh) return null;
    const v = new THREE.Vector3();
    this.playerMesh.getWorldPosition(v);
    v.project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.container.clientWidth, y: (-(v.y * 0.5 - 0.5) * this.container.clientHeight) };
  }

  public triggerPotionFlash() { this.potionFlashTick = 20; }
  public shakeCamera(intensity: number, duration: number) { this.shakeIntensity = intensity; this.shakeDuration = duration; }
  
  public spawnBurst(pos: THREE.Vector3, color: number) {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < 15; i++) {
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(pos);
      const v = new THREE.Vector3((Math.random()-0.5)*0.2, Math.random()*0.2, (Math.random()-0.5)*0.2);
      this.scene.add(p);
      this.burstParticles.push({ mesh: p, velocity: v, life: 1.0 });
    }
  }

  initGrid(grid: Tile[][]) {
    this.floorMeshes.forEach(m => this.scene.remove(m));
    this.wallMeshes.forEach(m => this.scene.remove(m));
    this.boxMeshes.forEach(m => this.scene.remove(m));
    this.floorMeshes = []; this.wallMeshes = []; this.boxMeshes.clear();
    
    const floorGeo = new THREE.BoxGeometry(1, 0.2, 1);
    const wallGeo = new THREE.BoxGeometry(1, 4, 1);
    const boxGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x050508 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x3d251e });

    for (let z = 0; z < GRID_HEIGHT; z++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const t = grid[z][x];
        if (t.type === 'wall') {
          const m = new THREE.Mesh(wallGeo, wallMat);
          m.position.set(x, 2, z); this.scene.add(m); this.wallMeshes.push(m);
        } else {
          const m = new THREE.Mesh(floorGeo, floorMat);
          m.position.set(x, -0.1, z); this.scene.add(m); this.floorMeshes.push(m);
          if (t.type === 'box') {
            const b = new THREE.Mesh(boxGeo, boxMat);
            b.position.set(x, 0.4, z); this.scene.add(b); this.boxMeshes.set(`${x},${z}`, b);
          } else if (t.type === 'stairs') {
            if (!this.stairsMesh) {
                this.stairsMesh = new THREE.Mesh(new THREE.TorusKnotGeometry(0.3, 0.1), new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff }));
                this.scene.add(this.stairsMesh);
            }
            this.stairsMesh.position.set(x, 0.5, z);
          }
        }
      }
    }
  }

  private createEntityMesh(type: string) {
    const g = new THREE.Group();
    const color = type === 'ASTRAL_WEAVER' ? 0x00ffff : (type === 'PALADIN' ? 0xffff00 : 0xaa00ff);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.6), mat);
    m.position.y = 0.4; g.add(m);
    return g;
  }

  update(player: Entity | null, enemies: Entity[]) {
    this.tick++;
    if (player) {
      if (!this.playerMesh) { this.playerMesh = this.createEntityMesh(player.classType); this.scene.add(this.playerMesh); }
      this.playerMesh.position.x += (player.pos.x - this.playerMesh.position.x) * 0.15;
      this.playerMesh.position.z += (player.pos.y - this.playerMesh.position.z) * 0.15;
      this.playerMesh.position.y = Math.sin(this.tick * 0.1) * 0.05 + 0.1;
      this.playerLight!.position.copy(this.playerMesh.position).add(new THREE.Vector3(0, 1.5, 0));
      
      this.originalCameraPos.set(player.pos.x + 6, 8, player.pos.y + 6);
      this.camera.position.lerp(this.originalCameraPos, 0.05);
      if (this.shakeDuration > 0) {
        this.camera.position.add(new THREE.Vector3((Math.random()-0.5)*this.shakeIntensity, (Math.random()-0.5)*this.shakeIntensity, (Math.random()-0.5)*this.shakeIntensity));
        this.shakeDuration--;
      }
      this.camera.lookAt(this.playerMesh.position);
    }

    // Enemies
    enemies.forEach(e => {
        let em = this.enemyMeshes.get(e.id);
        if (!em) { em = this.createEntityMesh('ENEMY'); this.scene.add(em); this.enemyMeshes.set(e.id, em); }
        em.position.x += (e.pos.x - em.position.x) * 0.1;
        em.position.z += (e.pos.y - em.position.z) * 0.1;
    });

    // Cleanup dead enemies
    this.enemyMeshes.forEach((mesh, id) => {
        if (!enemies.find(e => e.id === id)) { this.scene.remove(mesh); this.enemyMeshes.delete(id); }
    });

    if (this.magicCircle && (this.magicCircle.material as THREE.MeshBasicMaterial).opacity > 0) {
        (this.magicCircle.material as THREE.MeshBasicMaterial).opacity -= 0.02;
        this.magicCircle.rotation.z += 0.1;
    }

    if (this.potionFlashTick > 0) {
        this.potionFlashTick--;
        this.scene.background = new THREE.Color(this.potionFlashTick % 2 === 0 ? 0x00ff66 : 0x050510);
    } else {
        this.scene.background = new THREE.Color(0x050510);
    }

    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
        const p = this.burstParticles[i];
        p.mesh.position.add(p.velocity);
        p.life -= 0.02;
        p.mesh.scale.setScalar(p.life);
        if (p.life <= 0) { this.scene.remove(p.mesh); this.burstParticles.splice(i, 1); }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
