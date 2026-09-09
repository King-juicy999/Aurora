/* Shared real-time playback clock: ENGINE writes t here, AURORA reads it.
   One true source of playback time — no CSS-string round-trip between systems. */
window.__playback = { t: 0 };

/* ============================================================
   Underworld · Verse 2 — lyrics & beat-sync timing
   ------------------------------------------------------------
   BPM: 160 (80 half-time) | Key: B♭ Minor | Time: 4/4

   At 160 BPM:
     Beat  = 0.375s    (1 quarter note)
     8th   = 0.1875s
     16th  = 0.09375s
     Bar   = 1.5s      (4 beats)

   Each { t, text } pair is one moment of text on screen.
   Timings below were AUTO-DETECTED by running Whisper speech
   recognition (faster-whisper base.en) on underworld-verse2.mp3.
   Each t is the second the vocal for that line actually starts —
   no tapping, no grid math.
   Re-sync anytime with the on-screen "Sync lyrics to audio" button;
   Space-taps snap to the 16th grid, save to localStorage, and override
   these defaults on later loads.
   ============================================================ */
const BPM = 160;
const BEAT = 60 / BPM;            // 0.375s per beat
const EIGHTH = BEAT / 2;          // 0.1875s
const SIXTEENTH = BEAT / 4;       // 0.09375s
const BAR = BEAT * 4;             // 1.5s per bar
const VERSE_DURATION = 36.4;      // full verse window (clipped from full song)
const REACTION = 0.12;            // (s) human tap delay subtracted per tap
const SYNC_STORE_KEY = 'underworld-verse2-times-v2';

const LYRICS = [
  { t: 0.000,   text: "Here we go" },
  { t: 1.840,   text: "It was all heaven just a week ago" },
  { t: 5.000,   text: "Now I'm up in Hell with my eyes closed" },
  { t: 8.000,   text: "Gettin' sucked up by a devil ho" },
  { t: 10.520,  text: "Takin' these pills on an empty stomach" },
  { t: 13.340,  text: "Is like gettin' fucked up with the devil, ho" },
  { t: 16.620,  text: "Fuck her to my favorite heavy metal, ho" },
  { t: 20.000,  text: "We know all the words, so it's special" },
  { t: 21.860,  text: "So, so special" },
  { t: 23.740,  text: "I loved her and let her go" },
  { t: 26.880,  text: "Maybe I'ma hold her close, get the fuck back" },
  { t: 29.880,  text: "I'm about to overdose, and she love that" },
  { t: 32.860,  text: "Story of a demon seducin'" },
  { t: 34.540,  text: "a young drug head" },
];

/* ---- persistent timings: restore if the user has ever tapped a sync ---- */
let baseTimes = null;             // snapshot used by "0 reset" / Esc cancel
(function loadSync(){
  try{
    const raw = localStorage.getItem(SYNC_STORE_KEY);
    if(!raw) return;
    const arr = JSON.parse(raw);
    if(Array.isArray(arr) && arr.length === LYRICS.length){
      arr.forEach((t, i) => { LYRICS[i].t = Math.max(0, +t || 0); });
      baseTimes = LYRICS.map(l => l.t);
    }
  }catch(e){ /* bad/corrupt storage → keep fallback grid */ }
})();

function saveSync(){
  try{ localStorage.setItem(SYNC_STORE_KEY, JSON.stringify(LYRICS.map(l => l.t))); }
  catch(e){}
}

/* ============================================================
   AURORA — 3-scene narrative background (Heaven → Shatter → Hell)
   ------------------------------------------------------------
   Reads the real playback time from a shared clock that ENGINE's
   tick() writes to window.__playback — no CSS parsing, so scenes
   track the audio exactly regardless of the mp3's true length.
   Scenes follow the user's Animation Script:
   1 HEAVEN  sunlit meadow, two lovers under a tree, hands held,
             glowing heart between them; slow zoom toward the hands.
   2 SHATTER crack of light, colors drain, hands slip, the heart
             shatters into glass, ash + smoke rise.
   3 HELL    fiery wasteland, red fissures, smoke, the protagonist
             alone with head bowed; camera slowly orbits + pulls back.
   ============================================================ */
(function(){
  const cv  = document.getElementById('aurora');
  const ctx = cv.getContext('2d');
  let W, H, dpr;

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.width  = Math.floor(innerWidth  * dpr);
    H = cv.height = Math.floor(innerHeight * dpr);
    cv.style.width  = innerWidth  + 'px';
    cv.style.height = innerHeight + 'px';
  }
  addEventListener('resize', resize);
  resize();

  /* ---- shared playback clock: written by ENGINE's tick(), read here ---- */
  function trackTime(){ return window.__playback.t || 0; }

  const clamp = (v,a,b)=> v < a ? a : v > b ? b : v;
  const mix   = (a,b,m)=> a + (b - a) * m;
  const SZ    = () => Math.min(W, H);
  const rgba  = (c,a)=> `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
  const lerpC = (a,b,m)=> [ mix(a[0],b[0],m), mix(a[1],b[1],m), mix(a[2],b[2],m) ];

  /* ---- scene palettes: warm heaven vs fiery hell ---- */
  const WARM = {
    skyTop:[255,224,174], skyBot:[255,242,206], sun:[255,214,138],
    glow:[255,246,210], ground:[148,192,118], ground2:[104,162,96],
    tree:[96,88,66], figA:[255,234,196], figB:[255,224,214],
    heart:[255,120,150], vign:[120,80,40]
  };
  const HELL = {
    skyTop:[24,5,12], skyBot:[56,12,20], sun:[255,66,38],
    glow:[255,60,40], ground:[11,4,6], ground2:[6,2,4],
    tree:[16,7,9], figA:[34,12,20], figB:[44,16,26],
    heart:[255,60,50], vign:[10,2,4]
  };
  const pal = (m, key)=> lerpC(WARM[key], HELL[key], clamp(m,0,1));

  /* ---- particle pools: rising embers, smoke puffs, heart shards ---- */
  const embers=[], smoke=[], shards=[];
  for(let i=0;i<90;i++) embers.push({
    x:Math.random(), y:Math.random(),
    r:Math.random()*.9+.35, s:Math.random()*.00009+.00002,
    p:Math.random()*6.28, ph:Math.random()*6.28
  });
  for(let i=0;i<8;i++) smoke.push({
    x:Math.random(), y:Math.random(), r:Math.random()*190+80,
    s:Math.random()*.5+.22, p:Math.random()*6.28
  });

  /* ---- tapered glowing bone between two points ---- */
  function bone(a,b,wA,wB,c,alpha){
    const dx=b[0]-a[0], dy=b[1]-a[1];
    const L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L;
    const w1=wA*dpr, w2=wB*dpr;
    // soft halo
    ctx.globalCompositeOperation='lighter';
    ctx.fillStyle=`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${alpha*.09})`;
    ctx.beginPath();
    ctx.moveTo(a[0]-nx*w1*4,a[1]-ny*w1*4); ctx.lineTo(b[0]-nx*w2*4,b[1]-ny*w2*4);
    ctx.lineTo(b[0]+nx*w2*4,b[1]+ny*w2*4); ctx.lineTo(a[0]+nx*w1*4,a[1]+ny*w1*4);
    ctx.closePath(); ctx.fill();
    // body (tapered)
    ctx.fillStyle=`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`;
    ctx.globalAlpha=alpha*.92;
    ctx.beginPath();
    ctx.moveTo(a[0]-nx*w1,a[1]-ny*w1); ctx.lineTo(b[0]-nx*w2,b[1]-ny*w2);
    ctx.lineTo(b[0]+nx*w2,b[1]+ny*w2); ctx.lineTo(a[0]+nx*w1,a[1]+ny*w1);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha=1;
    // hot thread
    ctx.strokeStyle=`rgba(255,255,255,${alpha*.35})`;
    ctx.lineWidth=Math.max(.4,Math.min(w1,w2)*.4); ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
    ctx.globalCompositeOperation='source-over';
  }

  function glowDot(x,y,r,c,alpha){
    ctx.globalCompositeOperation='lighter';
    const g=ctx.createRadialGradient(x,y,0,x,y,r*4);
    g.addColorStop(0,`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${alpha})`);
    g.addColorStop(1,`rgba(${c[0]|0},${c[1]|0},${c[2]|0},0)`);
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r*4,0,6.28); ctx.fill();
    ctx.globalCompositeOperation='source-over';
  }

  /* ---- two-bone IK arm reaching a target; returns [elbow, wrist] ---- */
  function ikArm(shoulder, target, up, lo, side){
    let dx=target[0]-shoulder[0], dy=target[1]-shoulder[1];
    let d=Math.hypot(dx,dy)||1;
    const maxR=up+lo*.99;
    if(d>maxR){ target=[shoulder[0]+dx/d*maxR, shoulder[1]+dy/d*maxR]; dx=target[0]-shoulder[0]; dy=target[1]-shoulder[1]; d=Math.hypot(dx,dy)||1; }
    const nx=-dy/d, ny=dx/d;
    const bend=side*Math.min(up*.85, d*.5);
    return [ [(shoulder[0]+target[0])/2+nx*bend, (shoulder[1]+target[1])/2+ny*bend], target ];
  }

  /* ---- abstract humanoid figure (tapered glow bones)
         o: {x,y,s,f,alpha,sway,headDrop,lean,leftTarget,rightTarget,c} ---- */
  function drawFigure(o){
    const SNow = Math.min(W,H);
    const FH = SNow*.46;
    const torso=FH*.24, neck=FH*.05, headR=FH*.058;
    const up=FH*.185, lo=FH*.165, thigh=FH*.25, shin=FH*.22;
    const sw = o.sway || 0;
    const bob = Math.abs(Math.sin(sw*.5))*FH*.02;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(o.s || 1, o.s || 1);
    const a=o.alpha, c=o.c;
    const chest=[(o.lean||0)*FH + Math.sin(sw)*FH*.02, -torso + bob];
    // headDrop: clamp to a small tilt (was FH*.42 — ~9× too large, it flung the
    // bowed protagonist's head glow well past the torso). Head stays just below
    // the chest as a lowered/bowed neck instead of a big displacement.
    const dropAmount = Math.min(o.headDrop || 0, 1) * headR * 2.2;
    const headY = chest[1] - neck - headR * 0.4 + dropAmount;

    // legs (rooted at the hip)
    const lx=Math.sin(sw*.7)*FH*.05;
    bone([0,0],[lx,thigh],.042*FH,.024*FH,c,a);
    bone([lx,thigh],[lx,thigh+shin],.024*FH,.012*FH,c,a);
    bone([0,0],[-lx*.8,thigh],.042*FH,.024*FH,c,a);
    bone([-lx*.8,thigh],[-lx*.8,thigh+shin],.024*FH,.012*FH,c,a);

    // torso + head (head reads as a small glow orb)
    bone([0,0],chest,.048*FH,.034*FH,c,a);
    glowDot(chest[0],headY,headR,c,a*.9);
    ctx.globalCompositeOperation='lighter';
    const hg=ctx.createRadialGradient(chest[0],headY,0,chest[0],headY,headR*3);
    hg.addColorStop(0,`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a*.28})`);
    hg.addColorStop(1,`rgba(${c[0]|0},${c[1]|0},${c[2]|0},0)`);
    ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(chest[0],headY,headR*3,0,6.28); ctx.fill();
    ctx.globalCompositeOperation='source-over';

    // arms via IK (default: hanging low at the sides)
    const sh=[chest[0], chest[1]+neck*.3];
    const tL=o.leftTarget  || [chest[0]-o.f*FH*.30, chest[1]+(up+lo)*.95];
    const tR=o.rightTarget || [chest[0]+o.f*FH*.18, chest[1]+(up+lo)*.9];
    const [eL,wL]=ikArm(sh,tL,up,lo,-o.f);
    const [eR,wR]=ikArm(sh,tR,up,lo, o.f);
    bone(sh,eL,.032*FH,.022*FH,c,a);
    bone(eL,wL,.022*FH,.011*FH,c,a);
    bone(sh,eR,.032*FH,.022*FH,c,a);
    bone(eR,wR,.022*FH,.011*FH,c,a);
    glowDot(wL[0],wL[1],.012*FH,c,a*.8);
    glowDot(wR[0],wR[1],.012*FH,c,a*.8);
    ctx.restore();
  }

  /* ---- small glowing heart shape ---- */
  function drawHeart(x,y,s,c,alpha){
    ctx.globalCompositeOperation='lighter';
    const g=ctx.createRadialGradient(x,y,0,x,y,s*2.2);
    g.addColorStop(0,`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${alpha})`);
    g.addColorStop(1,`rgba(${c[0]|0},${c[1]|0},${c[2]|0},0)`);
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,s*2.2,0,6.28); ctx.fill();
    ctx.fillStyle=`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${alpha})`;
    ctx.beginPath();
    ctx.moveTo(x, y+s*.55);
    ctx.bezierCurveTo(x-s*1.1, y-s*.15, x-s*.55, y-s*.9, x, y-s*.35);
    ctx.bezierCurveTo(x+s*.55, y-s*.9, x+s*1.1, y-s*.15, x, y+s*.55);
    ctx.fill();
    ctx.globalCompositeOperation='source-over';
  }

  /* ============================================================
     FRAME — drive the 3 scenes from playback time
     ============================================================ */
  /* Scene boundaries come from the live LYRICS timestamps (they move if the
     user re-syncs):  Scene 2 (Shatter) opens where "It was all heaven…" starts
     (LYRICS[1].t), Scene 3 (Hell) at "Now I'm up in Hell" (LYRICS[2].t).
     local runs 0→1 across a scene; scene 3's local eases in over 3 s, holds. */
  const s2At  = () => LYRICS[1].t;
  const s3At  = () => LYRICS[2].t;
  function getScene(t){
    const s2 = s2At(), s3 = s3At(), span = (s3 - s2) || .001;
    if(t < s2) return { scene: 1, local: s2 > 0 ? clamp(t / s2, 0, 1) : 0 };
    if(t < s3) return { scene: 2, local: clamp((t - s2) / span, 0, 1) };
    return { scene: 3, local: clamp((t - s3) / 3.0, 0, 1) };
  }

  let lastBG = 0;
  function frame(ts){
    const dt = Math.min(.05, (ts - lastBG) / 1000) || 0; lastBG = ts;
    const t  = trackTime();
    const { scene, local } = getScene(t);
    const SNow = Math.min(W, H);

    // palette mix: warm heaven (1) → drains across the shatter (2) → full hell (3)
    const mp      = scene === 1 ? 0 : scene === 2 ? local : 1;
    const hellAmt = mp;                        // 0→1 warmth→inferno, for embers/sun/smoke

    // hard crack-of-light flash on scene-2 entry — one sharp decay, not a sine pulse
    const crack = scene === 2 ? (local < .18 ? Math.max(0, 1 - local / .18) : 0) : 0;

    // --- camera (per scene) ---
    const hx = W / 2, hy = H * .54;            // the clasped-hands / heart point
    let fx, fy, s, camX = 0, camY = 0, rot = 0;
    if(scene === 1){                           // heaven: slow zoom onto the hands
      fx = hx; fy = hy;
      s = 1 + local * .15;
    } else if(scene === 2){                    // shatter: hold the zoom, then ease back
      fx = hx; fy = hy;
      s = 1.15 - local * .15;
      if(crack > 0){                           // the flash jolts the frame
        camX += (Math.random() - .5) * 16 * crack * dpr;
        camY += (Math.random() - .5) * 10 * crack * dpr;
      }
    } else {                                   // hell: orbit + pull back for the whole verse
      fx = W / 2; fy = H * .60;                // held on the bowed protagonist
      s = 1 - .10 * clamp((t - s3At()) / 14, 0, 1);
      camX = Math.sin(t * .22) * SNow * .05;
      camY = Math.cos(t * .16) * SNow * .03;
      rot  = Math.sin(t * .11) * .015;
    }

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(fx + camX, fy + camY);
    ctx.scale(s, s);
    ctx.rotate(rot);
    ctx.translate(-fx, -fy);

    const horizon = H * .68;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, rgba(pal(mp,'skyTop'), 1));
    sky.addColorStop(1, rgba(pal(mp,'skyBot'), 1));
    ctx.fillStyle = sky; ctx.fillRect(-W * 2, -H * 2, W * 4, H * 4);

    // sun / ember-glow
    const sx = W * .26, sy = horizon - H * .20;
    const sunC = pal(mp, 'sun');
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, SNow * .85);
    sg.addColorStop(0,   rgba(sunC, hellAmt > .5 ? .55 : .8));
    sg.addColorStop(.22, rgba(sunC, hellAmt > .5 ? .15 : .26));
    sg.addColorStop(1,   rgba(sunC, 0));
    ctx.fillStyle = sg; ctx.fillRect(-W, -H, W * 3, H * 3);

    // ground — meadow green crossfades to burnt across the shatter
    const gg = ctx.createLinearGradient(0, horizon, 0, H * 1.4);
    gg.addColorStop(0, rgba(pal(mp,'ground'), 1));
    gg.addColorStop(1, rgba(pal(mp,'ground2'), 1));
    ctx.fillStyle = gg;
    ctx.fillRect(-W, horizon, W * 3, H * 2);

    // glowing red fissures — hell only, eased in with the scene
    if(scene === 3){
      const ca = .25 + .75 * local;
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      for(let j = 0; j < 5; j++){
        const bx = .10 + j * .20;
        ctx.strokeStyle = `rgba(255,64,44,${.14 * ca})`;
        ctx.lineWidth = 26 * dpr;
        ctx.beginPath();
        for(let k = 0; k < 5; k++){
          const x = (bx + Math.sin(j * 13 + k * 7) * .025) * W;
          const y = horizon + 12 + k * H * .05;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,130,70,${.5 * ca})`;
        ctx.lineWidth = 3 * dpr;
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      ctx.globalCompositeOperation = 'source-over';
    }

    // smoke — ramps up through the shatter, holds heavy in hell
    const smokeAmt = scene === 1 ? .04 : scene === 2 ? .04 + .09 * local : .13;
    for(const p of smoke){
      p.x += Math.sin(t * .09 + p.p) * .00006;
      p.y -= p.s * .00011;
      if(p.y < 0) p.y = 1;
      const r = p.r * dpr;
      const g = ctx.createRadialGradient(p.x * W, p.y * H, 0, p.x * W, p.y * H, r);
      g.addColorStop(0, rgba([18,7,10], smokeAmt));
      g.addColorStop(1, rgba([18,7,10], 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x * W, p.y * H, r, 0, 6.28); ctx.fill();
    }

    // the tree — full opacity for the whole heaven scene
    if(scene === 1){
      const tc = pal(mp, 'tree');
      const tx = W * .46, ty = horizon;
      ctx.globalAlpha = 1;
      ctx.fillStyle = rgba(tc, 1);
      ctx.beginPath();
      ctx.moveTo(tx - 8 * dpr, ty);
      ctx.quadraticCurveTo(tx - 6 * dpr, ty - H * .16, tx - 2 * dpr, ty - H * .24);
      ctx.lineTo(tx + 4 * dpr, ty - H * .24);
      ctx.quadraticCurveTo(tx + 6 * dpr, ty - H * .13, tx + 8 * dpr, ty);
      ctx.closePath(); ctx.fill();
      for(let i = 0; i < 8; i++){
        const a0 = (i / 8) * 6.283;
        const cxx = tx + Math.cos(a0) * W * .10;
        const cyy = ty - H * .28 + Math.sin(a0) * H * .085;
        const g = ctx.createRadialGradient(cxx, cyy, 0, cxx, cyy, W * .115);
        g.addColorStop(0, rgba(lerpC(tc, [52,74,50], .35), .92));
        g.addColorStop(1, rgba(tc, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cxx - W * .12, cyy - H * .09, W * .24, H * .18);
      }
      ctx.globalAlpha = 1;
    }

    // the two lovers holding hands around the heart (heaven) — and how it breaks
    const fh  = SNow * .32;
    const sep = scene === 2 ? local : 0;        // 0 clasped → 1 the hands have parted
    if(scene === 1 || scene === 2){
      const heartX = W / 2, heartY = H * .54;
      const side = fh * 1.05;
      const reach = 1 - sep;                    // reach of each clasped hand toward the other
      // full alpha in heaven; across the shatter the pair fade out by local = 1
      const figAlpha = .95 * (scene === 1 ? 1 : clamp(1 - clamp((local - .5) / .5, 0, 1), 0, 1));
      drawFigure({
        x: W / 2 - side, y: heartY + fh * .45, s: 1, f: 1, c: pal(mp, 'figA'),
        alpha: figAlpha, sway: t * .9, headDrop: .04,
        leftTarget:  [ -fh * .32, fh * .42 ],
        rightTarget: [ side * reach, -fh * .45 * (1 - sep) + fh * .35 * sep ]
      });
      drawFigure({
        x: W / 2 + side, y: heartY + fh * .45, s: 1, f: -1, c: pal(mp, 'figB'),
        alpha: figAlpha, sway: -t * .9, headDrop: .04,
        leftTarget:  [ -side * reach, -fh * .45 * (1 - sep) + fh * .35 * sep ],
        rightTarget: [ fh * .32, fh * .42 ]
      });
      if(scene === 1){
        drawHeart(heartX, heartY, fh * .13, pal(0, 'heart'), .9);   // the full heart
      } else {
        // the heart dies partway through the shatter and bursts into shards
        const ha = .9 * clamp(1 - clamp((local - .3) / .3, 0, 1), 0, 1);
        if(ha > 0) drawHeart(heartX, heartY, fh * .13 * clamp(1 - local * .5, .4, 1), pal(mp, 'heart'), ha);
        if(local > .3 && local < .6 && shards.length < 60 && Math.random() < .6){
          const ag = Math.random() * 6.283, sp = (Math.random() * 3.2 + 1.2) * fh * .02;
          shards.push({ x: heartX, y: heartY,
            vx: Math.cos(ag) * sp, vy: Math.sin(ag) * sp - fh * .03,
            life: 1.4, r: (Math.random() * .008 + .005) * SNow });
        }
      }
    }
    // the protagonist — alone, head bowed, in hell (alpha from scene time, not w)
    if(scene === 3){
      const pa = clamp((t - s3At()) * 2, 0, 1);
      drawFigure({ x: W / 2, y: H * .60, s: .9, f: 1, c: pal(1, 'figA'),
        alpha: .95 * pa, sway: t * .7, headDrop: .9, lean: .05 });
    }

    // glass shards update + draw
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for(let i = shards.length - 1; i >= 0; i--){
      const sh = shards[i];
      sh.life -= dt;
      if(sh.life <= 0){ shards.splice(i, 1); continue; }
      sh.x += sh.vx * dt; sh.y += sh.vy * dt;
      sh.vy += SNow * .5 * dt;
      sh.vx *= (1 - dt * 1.6);
      ctx.fillStyle = `rgba(255,225,255,${clamp(sh.life, 0, 1)})`;
      ctx.beginPath(); ctx.arc(sh.x, sh.y, sh.r, 0, 6.28); ctx.fill();
    }
    ctx.restore();

    ctx.restore(); // camera

    // rising embers (hell) / drifting pollen (heaven)
    for(const e of embers){
      e.y -= e.s * (1 + .7 * hellAmt * Math.sin(t * .3 + e.ph));
      if(e.y < 0) e.y = 1;
      e.x += Math.sin(t * .14 + e.ph) * .0002 * (1 + .5 * hellAmt);
      const col = hellAmt > .5 ? [255,120,55] : [255,235,180];
      ctx.fillStyle = rgba(col, .06 + .26 * hellAmt);
      ctx.beginPath(); ctx.arc(e.x * W, e.y * H, e.r * dpr, 0, 6.28); ctx.fill();
    }

    // the crack of light — a hard vertical tear rips down the frame as it hits
    if(crack > .03){
      const cx2 = W * .5;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for(let k = 0; k < 6; k++){
        const ox = cx2 + (k - 3) * 7 * dpr;
        const bright = .5 * crack * (1 - Math.abs(k - 3) / 3);
        ctx.strokeStyle = `rgba(235,245,255,${bright})`;
        ctx.lineWidth = (k === 3 ? 2.4 : 1.1) * dpr;
        ctx.beginPath();
        ctx.moveTo(ox, -H * .1);
        for(let i = 1; i <= 10; i++){
          ctx.lineTo(ox + Math.sin(i * 2.3) * 10 * crack * dpr, i * H * .12);
        }
        ctx.stroke();
      }
      ctx.restore();
      // full-frame flash so the cut reads as one lightning strike
      ctx.fillStyle = `rgba(255,246,238,${.4 * crack})`;
      ctx.fillRect(0, 0, W, H);
    }

    // vignette — warm in heaven, dark in hell
    const v = ctx.createRadialGradient(W / 2, H / 2, SNow * .35, W / 2, H / 2, Math.max(W, H) * .75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, rgba(pal(mp, 'vign'), .58));
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* ============================================================
   ENGINE — beat-synced lyric engine + built-in tap-sync
   ============================================================ */
(function(){
  const lyricEl  = document.getElementById('lyric');
  const progFill = document.getElementById('progFill');
  const cover    = document.getElementById('cover');
  const coverMeta= document.getElementById('coverMeta');
  const coverHint= document.getElementById('coverHint');
  const caption  = document.getElementById('caption');
  const startBtn = document.getElementById('startBtn');
  const syncBtn  = document.getElementById('syncBtn');
  const calib    = document.getElementById('calib');
  const calibNum = document.getElementById('calibNum');
  const calibLine= document.getElementById('calibLine');
  const calibDots= document.getElementById('calibDots');
  const $calibSub= document.getElementById('calibSub');
  const audioSrc = 'underworld-verse2.mp3';

  let audio = null, audioReady = false, ctxAC = null, analyser = null;
  let started = false;
  let curIdx  = -1;
  let acc = 0, wordIdx = 0, activeWords = [];

  /* ---- tap-sync state ---- */
  let syncMode = false;
  let syncBefore = null;       // LYRICS times captured before a sync run
  let calibTaps = [];

  /* ---- prepare audio + analyser (idempotent) ---- */
  function prepareAudio(){
    if(audioReady) return;
    audioReady = true;
    coverMeta.textContent = BPM + ' bpm · 4/4 · B♭ Minor';
    if(baseTimes) coverHint.textContent = '✓ lyrics synced — press S anytime to re-sync';
    audio = document.createElement('audio');
    audio.src = audioSrc;
    audio.loop = true;
    audio.preload = 'auto';
    try{ ctxAC = new AudioContext(); }catch(e){}
    if(ctxAC) try{
      const src = ctxAC.createMediaElementSource(audio);
      analyser = ctxAC.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser); analyser.connect(ctxAC.destination);
    }catch(e){ analyser = null; }
  }

  /* ---- audio amplitude ---- */
  const ampData = new Uint8Array(128);
  function level(){
    if(!analyser) return 0;
    analyser.getByteTimeDomainData(ampData);
    let s = 0;
    for(let i = 0; i < ampData.length; i++){
      const v = (ampData[i] - 128) / 128; s += v*v;
    }
    return Math.min(1, Math.sqrt(s / ampData.length) * 5);
  }

  /* ---- render a line ---- */
  function setLine(i){
    if(i === curIdx) return;
    curIdx = i;
    const item = LYRICS[Math.max(0, Math.min(i, LYRICS.length-1))];
    lyricEl.getAnimations().forEach(a => a.cancel());
    lyricEl.textContent = '';
    activeWords = [];
    const parts = item.text.match(/\S+|\s+/g) || [];
    for(const part of parts){
      const s = document.createElement('span');
      s.className = 'word';
      s.textContent = /^\s+$/.test(part) ? ' ' : part;
      lyricEl.appendChild(s);
      if(!/^\s+$/.test(part)) activeWords.push(s);
    }
    wordIdx = 0; acc = 0;
  }

  /* ---- word reveal, paced to the line's own duration ---- */
  const LINE_HUE = ['hot-a','hot-b','hot-c','hot-c','hot-a','hot-b'];
  function lineSpan(i){
    const next = LYRICS[i+1];
    return next ? next.t - LYRICS[i].t : 2.2;
  }
  function stepWords(dt){
    if(!activeWords.length || wordIdx >= activeWords.length) return;
    acc += dt;
    const span = Math.max(.8, Math.min(2.4, lineSpan(curIdx)));
    const interval = Math.max(SIXTEENTH, Math.min(.5, span / Math.max(1, activeWords.length)));
    while(acc >= interval && wordIdx < activeWords.length){
      acc -= interval;
      const w = activeWords[wordIdx++];
      w.style.opacity = '0';
      w.style.transform = `translateY(${12+Math.random()*16}px) scale(${.88+Math.random()*.24}) rotate(${Math.random()*6-3}deg)`;
      w.style.filter = 'blur(7px)';
      w.style.transition = 'none';
      requestAnimationFrame(()=> requestAnimationFrame(()=>{
        w.style.transition = 'opacity .5s ease, transform .75s cubic-bezier(.22,.72,.22,1), filter .6s ease';
        w.style.opacity = '1';
        w.style.transform = 'translateY(0) scale(1) rotate(0)';
        w.style.filter = 'blur(0)';
      }));
      const hot = LINE_HUE[curIdx % LINE_HUE.length];
      w.classList.add(hot);
      setTimeout(()=>{ w.classList.remove(hot); w.classList.add('calm'); }, 950);
    }
  }

  /* ---- audio-reactive pulse ---- */
  function pulse(){
    const lvl = level();
    lyricEl.style.filter =
      `drop-shadow(0 8px 34px rgba(0,0,0,.6)) brightness(${1 + lvl*.5})`;
  }

  /* ---- main loop ---- */
  let last = 0;
  function tick(now){
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    if(started){
      const t = (audio && audio.duration) ? audio.currentTime : (now - startedAt) / 1000;
      window.__playback.t = t;                             // share the real clock with AURORA

      // progress bar
      const dur = (audio && audio.duration) ? audio.duration : VERSE_DURATION;
      progFill.style.width = (Math.min(t / dur, 1) * 100) + '%';

      if(!syncMode){
        let i = curIdx;
        for(let k = 0; k < LYRICS.length; k++) if(t >= LYRICS[k].t) i = k;
        setLine(i);
        stepWords(dt);
        pulse();
      }
    }
    requestAnimationFrame(tick);
  }

  function closeCover(){
    cover.style.transition = 'opacity .7s ease';
    cover.style.opacity = '0';
    setTimeout(()=> cover.style.display = 'none', 700);
  }
  function showCaption(msg, ms){
    caption.textContent = msg;
    caption.classList.add('show');
    clearTimeout(showCaption._t);
    showCaption._t = setTimeout(()=> caption.classList.remove('show'), ms || 3500);
  }

  /* ================= TAP-SYNC (built-in calibration) ================= */

  function buildCalibDots(){
    calibDots.innerHTML = '';
    for(let i = 0; i < LYRICS.length; i++){
      const s = document.createElement('span');
      s.dataset.i = i; calibDots.appendChild(s);
    }
  }
  function renderCalibDots(n){
    [...calibDots.children].forEach(sp => {
      const i = +sp.dataset.i;
      sp.className = i < n ? 'done' : i === n ? 'live' : '';
    });
    calibNum.textContent = `${Math.min(n, LYRICS.length)} / ${LYRICS.length}`;
  }
  function calibFlash(){
    calib.classList.add('flash');
    clearTimeout(calibFlash._t);
    calibFlash._t = setTimeout(()=> calib.classList.remove('flash'), 200);
  }

  async function enterSync(){
    await prepareAudio();
    closeCover();
    syncMode = true;
    syncBefore = LYRICS.map(l => l.t);
    calibTaps = [];
    calib.hidden = false;
    renderCalibDots(0);
    calibLine.textContent = '"' + LYRICS[0].text + '"';
    started = true;
    startedAt = performance.now();
    last = performance.now();
    audio.currentTime = 0;
    try{ await audio.play(); }catch(e){}
  }

  function recordTap(){
    if(!syncMode || !audio) return;
    calibTaps.push(audio.currentTime);
    const n = calibTaps.length;
    renderCalibDots(n);
    calibFlash();
    if(n < LYRICS.length){
      calibLine.textContent = '"' + LYRICS[n].text + '"';
    }
    if(n >= LYRICS.length) finishSync();
  }

  function finishSync(){
    let prev = -Infinity;
    const dur = (audio && audio.duration) || VERSE_DURATION;
    for(let i = 0; i < LYRICS.length; i++){
      let t = Math.max(0, calibTaps[i] - REACTION);
      t = Math.round(t / SIXTEENTH) * SIXTEENTH;          // snap to 16th grid
      if(t <= prev) t = prev + SIXTEENTH;                 // keep strictly ascending
      LYRICS[i].t = Math.min(t, dur);
      prev = LYRICS[i].t;
    }
    baseTimes = LYRICS.map(l => l.t);
    saveSync();
    calibNum.textContent = '14 / 14';
    calibLine.textContent = 'Synced ✓';
    $calibSub.textContent = 'Timings snapped, saved to this browser, and live in the animation.';
    setTimeout(()=>{
      syncMode = false;
      calib.hidden = true;
      audio.currentTime = 0;      // replay the verse with the real timings
      curIdx = -1;
    }, 1600);
  }

  function cancelSync(){
    if(syncBefore) LYRICS.forEach((l,i) => l.t = syncBefore[i]);
    syncMode = false;
    calib.hidden = true;
    audio.currentTime = 0;
    curIdx = -1;
    showCaption('Sync cancelled — previous timings kept.', 2200);
  }
  function undoTap(){
    if(!calibTaps.length) return;
    calibTaps.pop();
    renderCalibDots(calibTaps.length);
    calibLine.textContent = '"' + (LYRICS[calibTaps.length] ? LYRICS[calibTaps.length].text : '') + '"';
  }

  /* ================= cover buttons ================= */
  startBtn.addEventListener('click', async ()=>{
    await prepareAudio();
    closeCover();
    calib.hidden = true;
    syncMode = false;
    curIdx = -1;
    startedAt = performance.now();
    started = true;
    last = performance.now();
    try{ await audio.play(); }catch(e){}
    showCaption('Underworld · verse 2 · ' + BPM + ' bpm', 3500);
  });

  syncBtn.addEventListener('click', enterSync);

  /* ================= keyboard ================= */
  addEventListener('keydown', e=>{
    if(syncMode){
      if(e.code === 'Space'){ e.preventDefault(); recordTap(); }
      else if(e.key === '0'){ e.preventDefault(); undoTap(); }
      else if(e.key === 'Escape'){ e.preventDefault(); cancelSync(); }
      return;
    }
    if(!started) return;
    if(e.key === 'ArrowLeft'){ nudgeCur(-.25); e.preventDefault(); }
    else if(e.key === 'ArrowRight'){ nudgeCur(.25); e.preventDefault(); }
    else if(e.key === '['){ nudgeCur(-.05); e.preventDefault(); }
    else if(e.key === ']'){ nudgeCur(.05); e.preventDefault(); }
    else if(e.key === '0'){ resetCur(); e.preventDefault(); }
    else if(e.key.toLowerCase() === 'm'){ markNow(); e.preventDefault(); }
    else if(e.key.toLowerCase() === 's'){ enterSync(); e.preventDefault(); }
  });

  function nudgeCur(d){
    if(curIdx < 0) return;
    LYRICS[curIdx].t = Math.max(0, LYRICS[curIdx].t + d);
    saveSync();
    showCaption(`Line ${curIdx+1} → ${LYRICS[curIdx].t.toFixed(2)}s`, 1800);
  }
  function resetCur(){
    if(curIdx < 0) return;
    LYRICS[curIdx].t = baseTimes ? baseTimes[curIdx] : (curIdx ? LYRICS[curIdx].t : 0);
    saveSync();
    showCaption(`Line ${curIdx+1} reset → ${LYRICS[curIdx].t.toFixed(2)}s`, 1800);
  }
  function markNow(){
    if(curIdx < 0) return;
    const t = (audio && audio.duration) ? audio.currentTime : 0;
    LYRICS[curIdx].t = Math.max(0, t);
    saveSync();
    showCaption(`Line ${curIdx+1} marked at ${t.toFixed(2)}s`, 1800);
  }

  requestAnimationFrame(tick);
})();