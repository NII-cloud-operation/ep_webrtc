'use strict';

// Separable Gaussian blur following LiveKit's track-processors blurShader.
// The working image keeps the camera's detail at Etherpad's default 160x120.
exports.createGaussianBackground = () => {
  const input = document.createElement('canvas');
  const inputCtx = input.getContext('2d');
  const output = document.createElement('canvas');
  const gl = output.getContext('webgl2', {alpha: false, antialias: false, depth: false});
  if (!gl) throw new Error('WebGL 2 is required for background blur');
  const close = () => {
    const extension = gl.getExtension('WEBGL_lose_context');
    if (extension) extension.loseContext();
  };
  try {
    const program = gl.createProgram();
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
      }
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    };
    compile(gl.VERTEX_SHADER, `#version 300 es
      out vec2 uv;
      void main() {
        uv = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
        gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
      }`);
    compile(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      in vec2 uv;
      uniform sampler2D image;
      uniform vec2 stepSize;
      out vec4 color;
      void main() {
        vec3 sum = vec3(0.0);
        float total = 0.0;
        const float radius = 4.0;
        for (int i = -4; i <= 4; ++i) {
          float x = float(i);
          float weight = exp(-0.5 * x * x / (radius * radius));
          sum += texture(image, uv + x * stepSize).rgb * weight;
          total += weight;
        }
        color = vec4(sum / total, 1.0);
      }`);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);
    const step = gl.getUniformLocation(program, 'stepSize');
    const texture = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    };
    const source = texture();
    const horizontal = texture();
    const buffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, horizontal, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    let width;
    let height;
    const draw = (video) => {
      if (gl.isContextLost()) throw new Error('Background blur WebGL context lost');
      if (width !== video.videoWidth || height !== video.videoHeight) {
        width = video.videoWidth;
        height = video.videoHeight;
        const scale = Math.min(4, Math.max(1, Math.min(width, height) / 120));
        input.width = output.width = Math.round(width / scale);
        input.height = output.height = Math.round(height / scale);
        gl.bindTexture(gl.TEXTURE_2D, horizontal);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, input.width, input.height, 0,
            gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.viewport(0, 0, input.width, input.height);
      }
      // Upload the visible camera rectangle, including the browser's crop and resize.
      inputCtx.drawImage(video, 0, 0, input.width, input.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
      gl.bindTexture(gl.TEXTURE_2D, source);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input);
      gl.uniform2f(step, 1 / input.width, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, horizontal);
      gl.uniform2f(step, 0, 1 / input.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return output;
    };
    return {draw, close};
  } catch (err) {
    close();
    throw err;
  }
};
