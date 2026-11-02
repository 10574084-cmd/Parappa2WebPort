const VERTEX_SHADER = [
  '#version 300 es',
  'in vec3 aPosition;',
  'uniform vec3 uOffset;',
  'uniform vec3 uScale;',
  'uniform float uRotation;',
  'uniform float uAspect;',
  'void main() {',
  '  vec3 p = aPosition * uScale;',
  '  float c = cos(uRotation);',
  '  float s = sin(uRotation);',
  '  p.xz = mat2(c, -s, s, c) * p.xz;',
  '  p += uOffset;',
  '  float depth = 1.0 + p.z * 0.025;',
  '  gl_Position = vec4(p.x * 0.19 * uAspect / depth, p.y * 0.28 / depth, 0.45 - p.z * 0.015, 1.0);',
  '}'
].join('\n');

const FRAGMENT_SHADER = [
  '#version 300 es',
  'precision highp float;',
  'uniform vec3 uColor;',
  'out vec4 outColor;',
  'void main() { outColor = vec4(uColor, 1.0); }'
].join('\n');

const CUBE = new Float32Array([
  -1,-1,-1, 1,-1,-1, 1,1,-1, -1,-1,-1, 1,1,-1, -1,1,-1,
  -1,-1,1, 1,1,1, 1,-1,1, -1,-1,1, -1,1,1, 1,1,1,
  -1,-1,-1, -1,1,-1, -1,1,1, -1,-1,-1, -1,1,1, -1,-1,1,
  1,-1,-1, 1,-1,1, 1,1,1, 1,-1,-1, 1,1,1, 1,1,-1,
  -1,-1,-1, -1,-1,1, 1,-1,1, -1,-1,-1, 1,-1,1, 1,-1,-1,
  -1,1,-1, 1,1,1, -1,1,1, -1,1,-1, 1,1,-1, 1,1,1
]);

export class StageRenderer {
  constructor(canvas, fallback) {
    this.canvas = canvas;
    this.fallback = fallback;
    this.gl = canvas.getContext('webgl2', { alpha: false, antialias: true });
    if (!this.gl) { fallback.classList.remove('hidden'); return; }
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message || 'WebGL shader compilation failed');
      }
      return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    this.program = program;
    this.position = gl.getAttribLocation(program, 'aPosition');
    this.offset = gl.getUniformLocation(program, 'uOffset');
    this.scale = gl.getUniformLocation(program, 'uScale');
    this.rotation = gl.getUniformLocation(program, 'uRotation');
    this.aspect = gl.getUniformLocation(program, 'uAspect');
    this.color = gl.getUniformLocation(program, 'uColor');
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, CUBE, gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0.055, 0.065, 0.13, 1);
    this.start = performance.now();
  }

  draw(time) {
    const gl = this.gl;
    if (!gl) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.position);
    gl.vertexAttribPointer(this.position, 3, gl.FLOAT, false, 0, 0);
    gl.uniform1f(this.aspect, width / height);
    const t = ((time || performance.now()) - this.start) / 1000;
    const cube = (x, y, z, sx, sy, sz, color, rotation = 0) => {
      gl.uniform3f(this.offset, x, y, z);
      gl.uniform3f(this.scale, sx, sy, sz);
      gl.uniform1f(this.rotation, rotation);
      gl.uniform3fv(this.color, color);
      gl.drawArrays(gl.TRIANGLES, 0, 36);
    };
    cube(0, -1.7, 0, 5, 0.35, 2.5, [0.13, 0.17, 0.32]);
    cube(0, 1.6, -3, 5, 2.7, 0.18, [0.20, 0.17, 0.38]);
    cube(-3.3, 0.3, -1.8, 0.16, 1.9, 0.15, [0.38, 0.22, 0.50]);
    cube(3.3, 0.3, -1.8, 0.16, 1.9, 0.15, [0.38, 0.22, 0.50]);
    const bob = Math.sin(t * 5) * 0.10;
    const sway = Math.sin(t * 2.5) * 0.18;
    cube(sway, -0.1 + bob, 0.3, 0.43, 0.6, 0.32, [0.17, 0.78, 0.77], sway);
    cube(sway, 0.83 + bob, 0.3, 0.31, 0.31, 0.31, [0.97, 0.72, 0.58]);
    cube(sway - 0.48, -0.02 + bob, 0.3, 0.14, 0.48, 0.16, [0.97, 0.72, 0.58], -0.5 + Math.sin(t * 5) * 0.3);
    cube(sway + 0.48, -0.02 + bob, 0.3, 0.14, 0.48, 0.16, [0.97, 0.72, 0.58], 0.5 - Math.sin(t * 5) * 0.3);
    cube(sway - 0.22, -0.9 + bob, 0.3, 0.17, 0.48, 0.18, [0.98, 0.45, 0.64], Math.sin(t * 5) * 0.2);
    cube(sway + 0.22, -0.9 + bob, 0.3, 0.17, 0.48, 0.18, [0.98, 0.45, 0.64], -Math.sin(t * 5) * 0.2);
    for (let index = 0; index < 4; index++) {
      const x = -2.4 + index * 1.6;
      cube(x, 1.95 + Math.sin(t * 2 + index) * 0.12, -0.8, 0.12, 0.12, 0.12,
        index % 2 ? [0.42, 0.88, 0.88] : [1, 0.48, 0.69], t * 0.2);
    }
  }
}
