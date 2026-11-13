/** Embers falling from a cape's hem, for worn items marked `effect: 'embers'` (the completionist cape,
 * lib/custom-wearables.ts). Sparks are born along every bottom edge of the cape (the middle hem and the shorter side
 * panels), more of them on the side panels' edges, and a share on the lowest fifth of the cloth, so the whole bottom glows;
 * they fall and fan outward, gold fading to white. Larger, short-lived sparks make the glow. */
type Three = typeof import('three');
type Point = [number, number, number];
/** The parts of a loaded model the embers need: its first mesh's points, and somewhere to attach them. */
type Attr = {count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number};
type Node = {traverse(fn: (obj: Node) => void): void; isMesh?: boolean; geometry?: {getAttribute(name: string): Attr | undefined}; add?(obj: object): void};

export function capeEmbers(THREE: Three, root: Node, reduced: boolean): {update: (dt: number) => void} | null {
  // A cape with an animated surface (the fire and infernal max capes) loads as sibling meshes in one frame: the hem is
  // found across all of them, and the embers hang from the first.
  const meshes: Node[] = [];
  root.traverse(obj => { if (obj.isMesh) meshes.push(obj); });
  const mesh = meshes[0], points: Point[] = [];
  for (const part of meshes) {
    const position = part.geometry?.getAttribute('position');
    for (let i = 0; i < (position?.count ?? 0); i++) points.push([position!.getX(i), position!.getY(i), position!.getZ(i)]);
  }
  if (!mesh?.add || !points.length) return null;
  const ys = points.map(p => p[1]), minY = Math.min(...ys), height = Math.max(...ys) - minY;
  const low = points.filter(p => p[1] < minY + height * .5);
  // A bottom edge point has no cloth just below it: no other point close by in x and z sits lower.
  const hem = low.filter(([x, y, z]) => !low.some(([x2, y2, z2]) => Math.abs(x2 - x) < 5 && Math.abs(z2 - z) < 5 && y2 < y - 2));
  if (!hem.length) return null;
  const skirt = low.filter(p => p[1] < minY + height * .22);
  const xs = hem.map(p => p[0]), left = Math.min(...xs), right = Math.max(...xs), halfWidth = Math.max(1, (right - left) / 2), middle = (left + right) / 2;
  const pick = <T>(list: T[]) => list[(Math.random() * list.length) | 0];
  const nearest = (x: number) => hem.reduce((best, p) => Math.abs(p[0] - x) + Math.random() * 3 < Math.abs(best[0] - x) ? p : best, pick(hem));
  const along = (x: number): Point => Math.random() < .4 && skirt.length ? pick(skirt) : nearest(x);
  // The side panels end higher than the middle hem; a spark can be born anywhere along their bottom edges.
  const lowest = Math.min(...hem.map(p => p[1])), sides = hem.filter(p => p[1] > lowest + height * .06 && Math.abs(p[0] - middle) > halfWidth * .35);
  const sidePoint = (): Point => {
    const a = pick(sides), near = sides.filter(p => p !== a && Math.sign(p[0] - middle) === Math.sign(a[0] - middle) && Math.hypot(p[0] - a[0], p[2] - a[2]) < 30);
    const b = near.length ? pick(near) : a, t = Math.random();
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };

  const count = reduced ? 180 : 900;
  const geometry = new THREE.BufferGeometry(), pos = new Float32Array(count * 3), life = new Float32Array(count), vel = new Float32Array(count * 3), size = new Float32Array(count), rate = new Float32Array(count);
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('life', new THREE.BufferAttribute(life, 1));
  geometry.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const spawn = (i: number, age = 0) => {
    const side = sides.length > 0 && Math.random() < .3, [x, y, z] = side ? sidePoint() : along(left + Math.random() * (right - left));
    const out = (x - middle) / halfWidth, glow = Math.random() < (side ? .45 : .26);
    pos.set([x + (Math.random() - .5) * 3, y + Math.random() * 3, z + (Math.random() - .5) * 5], i * 3);
    // Slow at first, so they bunch up along the hem, then falling and fanning out past the edges.
    vel.set([out * (6 + Math.random() * 10) + (Math.random() - .5) * 6, -4 - Math.random() * 12, -3 - Math.random() * 8], i * 3);
    life[i] = age; size[i] = glow ? 12 + Math.random() * 8 : 2.5 + Math.random() * 5; rate[i] = glow ? 1.6 : .6 + Math.random() * .5;
  };
  for (let i = 0; i < count; i++) spawn(i, Math.random());
  const embers = new THREE.Points(geometry, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float life; attribute float size; varying float vLife;
      void main(){ vLife = life; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * (1.0 - life * .6) * (420.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vLife;
      void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard;
        vec3 gold = vec3(1.0, .74, .26), white = vec3(1.0, .97, .88);
        float glow = smoothstep(.5, .0, d); gl_FragColor = vec4(mix(white, gold, vLife) * glow, glow * (1.0 - vLife) * .95); }`,
  }));
  embers.frustumCulled = false;
  mesh.add(embers);
  return {
    update(dt: number) {
      for (let i = 0; i < count; i++) {
        life[i] += dt * rate[i];
        if (life[i] >= 1) { spawn(i); continue; }
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] -= 14 * dt;
      }
      geometry.attributes.position.needsUpdate = geometry.attributes.life.needsUpdate = geometry.attributes.size.needsUpdate = true;
    },
  };
}
