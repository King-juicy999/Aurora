/* ============================================================
   LOVE STORY · cover effects — nebula galaxy + crying companion
   ------------------------------------------------------------
   Purely the launch/landing screen. It owns the two canvases in
   #cover (#nebula galaxy, #mascot companion) and fades them out
   together with the cover when Play is hit. It does NOT touch the
   lyric engine, its beat-sync, or the scene renderer — all frozen.
   ============================================================ */
(function(){
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const neb = document.getElementById('nebula');
  const mas = document.getElementById('mascot');
  const startBtn = document.getElementById('startBtn');
  if(!neb || !mas) return;

  let W = window.innerWidth, H = window.innerHeight;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  let running = true;                       // false once Play fades the cover effects out

  function resize(){
    W = window.innerWidth; H = window.innerHeight;
    for(const c of [neb, mas]){
      c.width = Math.round(W * DPR);
      c.height = Math.round(H * DPR);
    }
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------------- Nebula galaxy — WebGL (domain-warped fbm) ----------------
     A vanilla port of the "Nebula" background from 21st.dev (chamaac): a single
     full-screen quad running a fractional-Brownian-motion fragment shader with
     domain warping, so deep-purple space slowly swirls toward rose glow. */
  const gl = neb.getContext('webgl', { antialias: false });
  if(gl && !reduced){
    const VERT = `attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

    const FRAG = `precision highp float;
uniform float uTime;
uniform vec3 uColor1;   // highlight / glow
uniform vec3 uColor2;   // nebula body
uniform vec3 uColor3;   // deep space
uniform float uSpeed;
varying vec2 vUv;

float random(in vec2 st){ return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
float noise(in vec2 st){
  vec2 i = floor(st), f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
#define OCTAVES 6
float fbm(in vec2 st){
  float v = 0.0, amp = 0.5;
  for(int i = 0; i < OCTAVES; i++){ v += amp * noise(st); st *= 2.0; amp *= 0.5; }
  return v;
}
void main(){
  vec2 st = vUv * 3.0;
  float time = uTime * uSpeed;
  vec2 q = vec2(0.0);
  q.x = fbm(st + 0.0 * time);
  q.y = fbm(st + vec2(1.0));
  vec2 r = vec2(0.0);
  r.x = fbm(st + 1.0 * q + vec2(1.7, 9.2) + 0.15 * time);
  r.y = fbm(st + 1.0 * q + vec2(8.3, 2.8) + 0.126 * time);
  float f = fbm(st + r);
  vec3 color = mix(uColor3, uColor2, clamp((f * f) * 4.0, 0.0, 1.0));
  color = mix(color, uColor1, clamp(length(q), 0.0, 1.0));
  color = mix(color, vec3(1.0), clamp(length(r.x), 0.0, 1.0));
  color *= 1.0 - smoothstep(0.5, 1.5, length(vUv - 0.5));   // vignette
  gl_FragColor = vec4((f * f * f + 0.6 * f * f + 0.5 * f) * color, 1.0);
}`;

    function makeShader(type, src){
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    const vs = makeShader(gl.VERTEX_SHADER, VERT);
    const fs = makeShader(gl.FRAGMENT_SHADER, FRAG);
    if(vs && fs){
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if(gl.getProgramParameter(prog, gl.LINK_STATUS)){
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW); // fullscreen triangle
        const loc = gl.getAttribLocation(prog, 'aPos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        const set3 = (name, r, g, b) => gl.uniform3f(gl.getUniformLocation(prog, name), r, g, b);
        gl.uniform1f(gl.getUniformLocation(prog, 'uSpeed'), 1.6);
        set3('uColor1', 1.00, 0.62, 0.78);   // rose glow
        set3('uColor2', 0.54, 0.24, 0.56);   // magenta nebula body
        set3('uColor3', 0.08, 0.04, 0.18);   // deep indigo space
        const uTime = gl.getUniformLocation(prog, 'uTime');

        let last = 0;
        function nebulaFrame(now){
          if(!running) return;
          if(now - last >= 33){              // ~30 fps is plenty for slow nebular drift
            last = now;
            gl.uniform1f(uTime, now / 1000);
            gl.viewport(0, 0, neb.width, neb.height);
            gl.clearColor(0.02, 0.01, 0.06, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
          }
          requestAnimationFrame(nebulaFrame);
        }
        requestAnimationFrame(nebulaFrame);
      } else { fallback2D(); }
    } else { fallback2D(); }
  } else if(gl) { staticNebula(); }
  else { fallback2D(); }

  /* Canvas-2D fallback (no WebGL): a few drifting glow blobs + twinkling stars. */
  function fallback2D(){
    const ctx = neb.getContext('2d');
    if(!ctx) return;
    const blobs = [[0.30,0.35,1.30,'205,64,150'],[0.72,0.30,1.10,'120,70,190'],[0.50,0.80,1.50,'220,120,180']];
    const stars = Array.from({length: 180}, () => ({ x: Math.random(), y: Math.random(), r: Math.random()*1.4+0.3, tw: Math.random()*6.28 }));
    let last = 0;
    function draw(now){
      if(!running) return;
      if(now - last >= 33){
        last = now;
        ctx.setTransform(DPR,0,0,DPR,0,0);
        ctx.fillStyle = '#120a26';
        ctx.fillRect(0,0,W,H);
        const t = now/1000;
        for(const b of blobs){
          const bx = (b[0] + Math.sin(t*0.05 + b[2])*0.06) * W;
          const by = (b[1] + Math.cos(t*0.04 + b[2])*0.06) * H;
          const rr = 0.42 * W;
          const g = ctx.createRadialGradient(bx,by,0,bx,by,rr);
          g.addColorStop(0,`rgba(${b[3]},0.34)`);
          g.addColorStop(1,`rgba(${b[3]},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(bx-rr, by-rr, rr*2, rr*2);
        }
        for(const s of stars){
          const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t*1.4 + s.tw));
          ctx.fillStyle = `rgba(255,225,255,${a})`;
          ctx.fillRect(s.x*W, s.y*H, s.r, s.r);
        }
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  /* Reduced-motion: paint a single nebula still (no animation loop). */
  function staticNebula(){
    const ctx = neb.getContext('2d');
    if(!ctx) return;
    ctx.setTransform(DPR,0,0,DPR,0,0);
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#1a0b2e');
    g.addColorStop(0.5,'#4a2450');
    g.addColorStop(1,'#180a24');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);
    for(let i=0;i<120;i++){
      ctx.fillStyle = `rgba(255,235,255,${0.3+Math.random()*0.5})`;
      ctx.fillRect(Math.random()*W, Math.random()*H, Math.random()*1.6+0.3, Math.random()*1.6+0.3);
    }
  }

  /* ---------------- Crying companion — a tiny ghost that shuffles after the cursor ----------------
     Pseudo-3D: soft halo + drop shadow + a glossy radial body, leaning into its
     movement. Every couple of seconds it sheds a tear from each big sad eye. */
  const mctx = mas.getContext('2d');
  if(mctx){
    const R = () => Math.max(20, Math.min(W, H) * 0.034);   // ghost half-width, ~3.4% of the short side
    const cursor = { x: W*0.5, y: H*0.82 };                // idle spot before the mouse moves
    window.addEventListener('mousemove', e => { cursor.x = e.clientX; cursor.y = e.clientY; }, { passive: true });
    window.addEventListener('resize', () => {
      if(!touchedMouse) cursor.x = W*0.5, cursor.y = H*0.82;
    });
    let touchedMouse = false;
    window.addEventListener('mousemove', () => touchedMouse = true, { once: true });

    const g = { x: cursor.x, y: cursor.y };
    const tears = [];
    let tearTimer = 1.6, blinkT = 2.4, waddle = 0, last = 0;

    function mascFrame(now){
      if(!running) return;
      if(now - last >= 16){                       // ~60 fps for the smooth follow
        last = now;
        const t = now/1000;
        const rr = R();

        // ease toward the cursor with a soft lag, offset above-right so it
        // follows without ever hiding the exact pixel you're pointing at
        const tx = cursor.x + 34, ty = cursor.y - 58;
        const px = g.x, py = g.y;
        g.x += (tx - g.x) * 0.045;
        g.y += (ty - g.y) * 0.045;
        const spd = Math.hypot(g.x - px, g.y - py);
        const tilt = Math.max(-0.35, Math.min(0.35, (g.x - px) * 0.004));
        waddle += spd * 0.09;
        const bobY = Math.sin(waddle) * Math.min(5, 2 + spd * 1.6);
        const leanY = Math.abs(tilt) > 0.01 ? 0 : Math.sin(t * 2.1) * 0.6;   // idle breathing

        mctx.setTransform(DPR,0,0,DPR,0,0);
        mctx.clearRect(0,0,W,H);

        // drop shadow (the ground beneath the ghost → reads as depth)
        mctx.fillStyle = 'rgba(0,0,20,0.30)';
        mctx.beginPath();
        mctx.ellipse(g.x, g.y + rr*1.15, rr*0.72, rr*0.18, 0, 0, 6.283);
        mctx.fill();

        // pulsing halo
        const halo = mctx.createRadialGradient(g.x, g.y - rr*0.2, rr*0.2, g.x, g.y - rr*0.2, rr*2.3);
        halo.addColorStop(0, `rgba(255,150,205,${0.16 + 0.05 * Math.sin(t*2.2)})`);
        halo.addColorStop(1, 'rgba(255,150,205,0)');
        mctx.fillStyle = halo;
        mctx.beginPath(); mctx.arc(g.x, g.y - rr*0.2, rr*2.3, 0, 6.283); mctx.fill();

        mctx.save();
        mctx.translate(g.x, g.y + bobY + leanY);
        mctx.rotate(tilt);

        // glossy body — top-lit vertical gradient
        const body = mctx.createLinearGradient(0, -rr*1.1, 0, rr*1.0);
        body.addColorStop(0, '#ffe9f6');
        body.addColorStop(0.45, '#e7a3d6');
        body.addColorStop(1, '#a25aa0');
        mctx.fillStyle = body;
        mctx.beginPath();
        mctx.moveTo(-rr, rr*1.25);                                   // bottom-left
        mctx.lineTo(-rr, -rr*0.15);                                  // left side up
        mctx.arc(0, -rr*0.25, rr, Math.PI, 0);                       // dome head
        mctx.lineTo(rr, rr*1.25);                                    // right side down
        mctx.quadraticCurveTo(rr*0.66, rr*1.42, rr*0.33, rr*1.25);   // 3 bottom scallops
        mctx.quadraticCurveTo(0,      rr*1.48, -rr*0.33, rr*1.25);
        mctx.quadraticCurveTo(-rr*0.66, rr*1.42, -rr, rr*1.25);
        mctx.closePath();
        mctx.fill();

        // sad eyes — half-lidded ellipses with a glint
        const eyeY = rr*0.05, eyeR = rr*0.30;
        for(const s of [-1, 1]){
          const ex = s * eyeR;
          mctx.fillStyle = '#3a1550';
          mctx.beginPath(); mctx.ellipse(ex, eyeY, rr*0.13, rr*0.19, 0, 0, 6.283); mctx.fill();
          mctx.fillStyle = '#fff';
          mctx.beginPath(); mctx.arc(ex - rr*0.03, eyeY - rr*0.07, rr*0.05, 0, 6.283); mctx.fill();
          // lid — thick body-tone arc across the top makes the eye droop
          mctx.strokeStyle = '#e7a3d6';
          mctx.lineWidth = rr*0.09;
          mctx.lineCap = 'round';
          mctx.beginPath();
          mctx.moveTo(ex - rr*0.13, eyeY - rr*0.03);
          mctx.quadraticCurveTo(ex, eyeY - rr*0.20, ex + rr*0.13, eyeY - rr*0.03);
          mctx.stroke();
          // worried brow
          mctx.strokeStyle = '#3a1550';
          mctx.lineWidth = rr*0.06;
          mctx.beginPath();
          mctx.moveTo(ex - rr*0.10, eyeY - rr*0.30);
          mctx.quadraticCurveTo(ex, eyeY - rr*0.34, ex + rr*0.12, eyeY - rr*0.22);
          mctx.stroke();
        }

        // downturned, quivering mouth
        const shiver = Math.sin(t*9) * rr*0.015;
        mctx.strokeStyle = '#3a1550';
        mctx.lineWidth = rr*0.07;
        mctx.beginPath();
        mctx.moveTo(-rr*0.16, rr*0.52);
        mctx.quadraticCurveTo(0, rr*0.34 - Math.abs(shiver), rr*0.16, rr*0.52);
        mctx.stroke();

        mctx.restore();

        // tears — a tear clings below each eye, slides down, then falls free
        tearTimer -= 1/60;
        if(tearTimer <= 0){
          tearTimer = 0.7 + Math.random()*0.8;
          tears.push(
            { s: -1, x: g.x - rr*0.19, y: g.y + rr*0.22, r: rr*0.07, cling: true, v: 0, life: 60, det: g.y + rr*0.42 },
            { s:  1, x: g.x + rr*0.19, y: g.y + rr*0.22, r: rr*0.07, cling: true, v: 0, life: 60, det: g.y + rr*0.42 }
          );
          blinkT = 0;                                   // heavy blink when it cries
        }
        // blink is briefly until tears land
        blinkT = Math.max(0, blinkT - 1/60);
        if(blinkT <= 0) blinkT = 2.0 + Math.random()*1.6;
        const blink = Math.max(0, Math.min(1, (blinkT < 0.12 ? blinkT/0.12 : 0)));  // not used to alter eyes; kept for timing

        for(let i = tears.length - 1; i >= 0; i--){
          const tr = tears[i];
          tr.life -= 1/60;
          if(tr.life <= 0 || tr.y > g.y + rr*2.4){ tears.splice(i, 1); continue; }
          if(tr.cling){
            tr.y += 0.45;
            tr.x += Math.sin(tr.life*12 + tr.s) * 0.12;
            if(tr.y >= tr.det) tr.cling = false;       // lets go
          } else {
            tr.v += 0.40; tr.y += tr.v;
            tr.x += Math.sin(tr.life*8) * 0.10;
          }
          const alpha = tr.life > 40 ? 1 : tr.life/40;
          mctx.fillStyle = `rgba(190,225,255,${0.9 * alpha})`;
          mctx.beginPath();
          mctx.ellipse(tr.x, tr.y, tr.r*0.62, tr.r*(tr.cling ? 1.1 : 0.85), 0, 0, 6.283);
          mctx.fill();
        }
      }
      if(mascRAF) requestAnimationFrame(mascFrame);
    }
    let mascRAF = requestAnimationFrame(mascFrame);
  }

  /* ---------------- Play: fade the whole launch screen out with #cover ---------------- */
  if(startBtn){
    startBtn.addEventListener('click', () => {
      running = false;                                  // stop both animation loops
      for(const c of [neb, mas]){
        c.style.transition = 'opacity .7s ease';
        c.style.opacity = '0';
      }
    }, { once: true });
  }
})();