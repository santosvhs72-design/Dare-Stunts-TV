import { mat4, v3, quat, frustumPlanes, sphereVisible } from './math.js';
import { hex } from './mesh.js';

// The world is still lit the way it always was -- one flat ambient floor, one
// hemispheric term, one directional sun, all baked per vertex into vColor
// below, exactly as before. Everything past that comment is new, and all of
// it is additive: a mesh drawn with uSpecStrength at 0 looks pixel-for-pixel
// like it always did, because every new term this adds multiplies out to
// zero. Two things ride on top of the old lighting instead of inside it:
//
//  - A sun glint (Blinn-Phong specular), because the old lighting was pure
//    Lambertian diffuse and had no notion of a viewing angle at all -- nothing
//    in the scene changed as the camera turned. Computed per fragment, not
//    per vertex like the rest, so it reads as a smooth highlight sliding
//    across the tarmac rather than a lit facet -- the one place this scene
//    deliberately steps outside its own low-poly Gouraud look, because a
//    glint is exactly the kind of thing faceted shading cannot do.
//  - A headlight: a real point light riding with the camera, the only light
//    source here that moves on its own. It barely shows in daylight, where
//    the surfaces it falls on are already close to fully lit -- and that is
//    not a special case anywhere, just what happens when you add light to
//    something already near its ceiling. It earns its keep at dusk, in a
//    tunnel, or underneath a loop, all of which now sit noticeably darker.
const VS = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uProj, uView, uModel;
// mediump, and stated outright rather than left to default: these two are
// also uniforms in the fragment shader below, which (like every fragment
// shader) has no built-in default precision for float at all and states
// mediump for the whole file. A uniform shared between both stages has to
// resolve to the very same precision in each, or the driver refuses to link
// the program -- and highp fragment support is itself optional in GLSL ES,
// so matching by pulling the vertex shader down to mediump is the safe
// direction: mediump is guaranteed in both stages, on every conformant
// implementation, where highp in a fragment shader is not. A 0-or-1 switch
// and a normalised direction never needed more precision than that anyway.
uniform mediump float uLit;
uniform mediump vec3 uLightDir;
uniform float uAmbient, uFogNear, uFogFar, uFogScale;
// Every varying explicitly mediump too, and for the same reason as uLit and
// uLightDir just above: a varying's precision has to match between the
// vertex shader writing it and the fragment shader reading it, just as a
// shared uniform's does, and leaving it to each file's own default is the
// same trap either way.
varying mediump vec3 vColor;
varying mediump vec3 vAlbedo;
varying mediump vec3 vNormal;
varying mediump vec3 vWorldPos;
varying mediump float vFog;
void main(){
  vec4 worldPos = uModel * vec4(aPos, 1.0);
  vec4 vp = uView * worldPos;
  gl_Position = uProj * vp;
  // w = 0 rotates the normal without translating it, which is all a rigid
  // model matrix needs -- and avoids a mat3 cast for WebGL 1's sake.
  vec3 n = normalize((uModel * vec4(aNormal, 0.0)).xyz);
  float diff = max(dot(n, uLightDir), 0.0);
  // Hemispheric ambient: sky above, ground bounce below. Without it the vertical
  // faces of loops and viaducts read as near-black slabs.
  float hemi = 0.5 + 0.5 * n.y;
  // uAmbient is a brightness floor, not a mix weight: the inside of a loop faces
  // away from the sun, and it still has to be readable to drive through.
  float lit = uAmbient + (1.0 - uAmbient) * (0.45 * hemi + 0.55 * diff);
  vColor = mix(aColor, aColor * lit, uLit);
  vAlbedo = aColor;
  vNormal = n;
  vWorldPos = worldPos.xyz;
  vFog = clamp((-vp.z - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0) * uFogScale;
}`;

const FS = `
precision mediump float;
uniform vec3 uFogColor;
uniform float uAlpha;
uniform vec3 uCamPos;
uniform vec3 uHeadPos, uHeadDir;
uniform float uHeadStrength, uSpecStrength;
uniform mediump float uLit;
uniform mediump vec3 uLightDir;
varying mediump vec3 vColor;
varying mediump vec3 vAlbedo;
varying mediump vec3 vNormal;
varying mediump vec3 vWorldPos;
varying mediump float vFog;
void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorldPos);

  // Viewpoint-dependent, so it travels across the surface as the camera turns
  // -- the one part of the lighting in this scene that was never static even
  // before the headlight existed.
  vec3 Hsun = normalize(uLightDir + V);
  float specSun = pow(max(dot(N, Hsun), 0.0), 50.0) * uSpecStrength;

  // A point light at the camera, aimed the way the camera is aimed: falls off
  // with distance, and with a soft-edged cone rather than a hard one, so it
  // does not paint a visible circle on the road.
  vec3 toFrag = vWorldPos - uHeadPos;
  float dist = length(toFrag);
  vec3 L = toFrag / max(dist, 0.001);
  // L already points from the light out into the scene (uHeadPos to
  // vWorldPos), the same way uHeadDir does -- so it is L against uHeadDir
  // here, not -L: the cone is about where the light is aimed, not about
  // which way the surface faces it (that part is ndotl, below).
  float cone = smoothstep(0.55, 0.85, dot(L, uHeadDir));
  float atten = cone / (1.0 + 0.025 * dist + 0.0035 * dist * dist);
  float ndotl = max(dot(N, -L), 0.0);
  vec3 headDiffuse = vAlbedo * vec3(1.0, 0.97, 0.88) * ndotl * atten * uHeadStrength;
  vec3 Hhead = normalize(-L + V);
  float specHead = pow(max(dot(N, Hhead), 0.0), 26.0) * atten * uHeadStrength * uSpecStrength;

  // Gated by uLit, the same switch the old per-vertex lighting already obeys:
  // the sky is the only mesh drawn with uLit at 0, and none of this new
  // lighting belongs on a background that was never meant to be lit at all.
  vec3 dynamic = (headDiffuse + specSun + specHead) * uLit;
  vec3 color = mix(vColor + dynamic, uFogColor, vFog);
  gl_FragColor = vec4(color, uAlpha);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

// Default until a track sets its own (see Game.load / world/scenery.js's sky
// presets) -- day, the same horizon the sky always used before tracks had a
// choice.
const DEFAULT_FOG = hex('#aac6e2');

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, depth: true });
    if (!gl) throw new Error('WebGL não disponível neste browser.');
    this.gl = gl;
    this.canvas = canvas;

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.prog = prog;
    gl.useProgram(prog);

    this.a = {
      pos: gl.getAttribLocation(prog, 'aPos'),
      normal: gl.getAttribLocation(prog, 'aNormal'),
      color: gl.getAttribLocation(prog, 'aColor'),
    };
    this.u = {};
    for (const n of ['uProj', 'uView', 'uModel', 'uLightDir', 'uAmbient', 'uLit',
                     'uFogNear', 'uFogFar', 'uFogScale', 'uFogColor', 'uAlpha',
                     'uCamPos', 'uHeadPos', 'uHeadDir', 'uHeadStrength', 'uSpecStrength']) {
      this.u[n] = gl.getUniformLocation(prog, n);
    }

    gl.enable(gl.DEPTH_TEST);
    // Culling stays off: the ribbon is viewed from both sides inside loops.
    gl.disable(gl.CULL_FACE);

    this.light = v3.norm([0.42, 0.82, 0.38]);
    this.fogColor = DEFAULT_FOG;
    this.fogNear = 150;
    this.fogFar = 460;
    this.cullDistance = 540;
    // How bright the headlight pool gets, at its very centre, before falloff
    // and the cone take anything away. Past 1 on purpose: WebGL clamps the
    // framebuffer to 1 regardless, so anything over just means the light
    // saturates a little sooner as it nears the camera, the way a real
    // headlight blows out what is right in front of it.
    this.headStrength = 1.4;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (w && h && (this.canvas.width !== w || this.canvas.height !== h)) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.aspect = (this.canvas.width || 1) / (this.canvas.height || 1);
  }

  // Uploads a MeshData into GPU buffers. Returns a chunk usable by draw().
  upload(meshData) {
    const gl = this.gl;
    const mk = arr => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      return b;
    };
    const { center, radius } = meshData.bounds();
    return {
      pos: mk(meshData.p), normal: mk(meshData.n), color: mk(meshData.c),
      count: meshData.vertexCount, center, radius,
    };
  }

  dispose(chunks) {
    for (const c of chunks || []) {
      this.gl.deleteBuffer(c.pos);
      this.gl.deleteBuffer(c.normal);
      this.gl.deleteBuffer(c.color);
    }
  }

  beginFrame(camQuat, camPos, fovDeg) {
    const gl = this.gl;
    this.resize();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(this.fogColor[0], this.fogColor[1], this.fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.proj = mat4.perspective(fovDeg * Math.PI / 180, this.aspect, 0.35, 2600);
    this.viewMat = mat4.view(camQuat, camPos);
    this.skyView = mat4.view(camQuat, camPos, true);
    this.camPos = camPos;
    this.planes = frustumPlanes(mat4.mul(this.proj, this.viewMat));

    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.u.uModel, false, IDENTITY);
    gl.uniform1f(this.u.uAlpha, 1);
    gl.uniform3fv(this.u.uLightDir, this.light);
    gl.uniform3fv(this.u.uFogColor, this.fogColor);
    gl.uniform1f(this.u.uFogNear, this.fogNear);
    gl.uniform1f(this.u.uFogFar, this.fogFar);

    // The headlight rides at the camera, aimed the way the camera looks --
    // there is no separate car body in this first-person view for it to be
    // mounted on, so the camera is the closest thing to where a headlight
    // would be.
    gl.uniform3fv(this.u.uCamPos, camPos);
    gl.uniform3fv(this.u.uHeadPos, camPos);
    gl.uniform3fv(this.u.uHeadDir, quat.fwd(camQuat));
    gl.uniform1f(this.u.uHeadStrength, this.headStrength);
  }

  bind(chunk) {
    const gl = this.gl;
    for (const [loc, buf] of [[this.a.pos, chunk.pos], [this.a.normal, chunk.normal], [this.a.color, chunk.color]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    }
  }

  drawSky(chunk) {
    const gl = this.gl;
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    gl.uniformMatrix4fv(this.u.uView, false, this.skyView);
    gl.uniform1f(this.u.uLit, 0);
    gl.uniform1f(this.u.uSpecStrength, 0);
    gl.uniform1f(this.u.uFogScale, 0);
    gl.uniform1f(this.u.uAmbient, 1);
    this.bind(chunk);
    gl.drawArrays(gl.TRIANGLES, 0, chunk.count);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
  }

  // A single moving, see-through object. Blending is enabled only here, and
  // depth writing is off so the ghost never hides the road behind it -- it is a
  // replay, not an obstacle.
  drawGhost(chunk, model, ambient = 0.62, alpha = 0.45, specStrength = 0.3) {
    const gl = this.gl;
    if (!chunk || !chunk.count) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniformMatrix4fv(this.u.uView, false, this.viewMat);
    gl.uniformMatrix4fv(this.u.uModel, false, model);
    gl.uniform1f(this.u.uLit, 1);
    gl.uniform1f(this.u.uFogScale, 1);
    gl.uniform1f(this.u.uAmbient, ambient);
    gl.uniform1f(this.u.uAlpha, alpha);
    gl.uniform1f(this.u.uSpecStrength, specStrength);
    this.bind(chunk);
    gl.drawArrays(gl.TRIANGLES, 0, chunk.count);
    gl.uniformMatrix4fv(this.u.uModel, false, IDENTITY);
    gl.uniform1f(this.u.uAlpha, 1);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  // Draws chunks with distance + frustum culling. specStrength is how much
  // of a sun glint and a headlight highlight this group of meshes gets --
  // 0 for the matte ground and scenery, a real value for the road, the
  // tunnel bore and the gates (see Game.render for the numbers).
  draw(chunks, ambient = 0.52, specStrength = 0) {
    const gl = this.gl;
    gl.uniformMatrix4fv(this.u.uView, false, this.viewMat);
    gl.uniform1f(this.u.uLit, 1);
    gl.uniform1f(this.u.uFogScale, 1);
    gl.uniform1f(this.u.uAmbient, ambient);
    gl.uniform1f(this.u.uSpecStrength, specStrength);
    const cull = this.cullDistance;
    for (const c of chunks) {
      if (!c.count) continue;
      if (v3.dist(c.center, this.camPos) - c.radius > cull) continue;
      if (!sphereVisible(this.planes, c.center, c.radius)) continue;
      this.bind(c);
      gl.drawArrays(gl.TRIANGLES, 0, c.count);
    }
  }
}
