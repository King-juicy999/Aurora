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
   ANIMATION SCRIPT — Opening Scene ("Heaven to Hell")
   Song Segment: "Here we go / It was all heaven just a week ago /
                  Now I'm up in Hell with my eyes closed"
   Visual Style: Dark anime / cyberpunk, high color contrast,
                 warm-to-cold palette shift.

   SCENE 1 — Heaven (Past)
     Lyric window: "Here we go" / "It was all heaven just a week ago"
     Visual: sunlit meadow, tall gold grass, warm amber/cream sky,
             pollen drifting slowly.
     Action: two lovers under a tree, hands clasped, soft glowing
             heart between them. Stillness and warmth — nothing
             dramatic happens here.
     Camera: slow, patient zoom toward the joined hands/heart.

   SCENE 2 — The Shatter (Transition)
     Lyric window: end of "a week ago" through "Now I'm up in Hell"
     Visual: one hard crack of white light rips down the frame;
             warm tones drain instantly to cold ash/grey/black.
     Action: hands torn apart (not slipping — pulled), the heart
             fractures into glass shards mid-air, the meadow burns
             and dissolves into wasteland along with the tree.
     Effect: screen shake on the crack; ash/embers already rising
             before the scene ends, so Hell feels like it's arriving.

   SCENE 3 — Hell (Present)
     Lyric window: "Now I'm up in Hell with my eyes closed" onward
     Visual: fissured wasteland, glowing red cracks, low smoke,
             quiet background flame.
     Action: protagonist alone, head bowed, eyes closed. The heart
             is already broken — this is the moment AFTER loss,
             not the moment of it. Embers drift past him, indifferent.
     Camera: slow orbit + gradual pull-back, until he's a small,
             still point in a vast fiery dark.
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

  /* ---- stick-figure limb and joint primitives ---- */
  function strokeLimb(x1, y1, x2, y2, width, color, alpha){
    ctx.strokeStyle = `rgba(${color[0]|0},${color[1]|0},${color[2]|0},${alpha})`;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function jointDot(x, y, r, color, alpha){
    ctx.fillStyle = `rgba(${color[0]|0},${color[1]|0},${color[2]|0},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.28);
    ctx.fill();
  }

  /* ---- keyframed joint-angle poses ----
     A pose is { headTilt, shoulderL, elbowL, shoulderR, elbowR, hipL, kneeL, hipR, kneeR }
     Angles are in radians: 0 = limb straight down for legs, straight out to the
     side for arms; each segment's angle adds onto its parent's. */
  const POSES = {
    standRelaxed: {
      headTilt: 0,
      shoulderL: 2.6, elbowL: 0.15,   // left arm hanging at side, slight elbow bend
      shoulderR: 0.55, elbowR: -0.15, // right arm hanging at side
      hipL: 0.15, kneeL: 0.05,
      hipR: -0.15, kneeR: -0.05
    },
    reachingCenter_left: {            // for the LEFT figure's inner (right) arm, reaching to hold hands
      headTilt: -0.08,
      shoulderL: 2.6, elbowL: 0.15,
      shoulderR: 1.6551, elbowR: 0.9195,  // inner arm reaches across to clasp hands at the heart
      hipL: 0.12, kneeL: 0.04,
      hipR: -0.12, kneeR: -0.04
    },
    reachingCenter_right: {            // mirror, for the RIGHT figure's inner (left) arm
      headTilt: 0.08,
      shoulderL: -1.6551, elbowL: -0.9195,  // mirrored reach, hand lands on the same heart point
      shoulderR: 0.55, elbowR: -0.15,
      hipL: 0.12, kneeL: 0.04,
      hipR: -0.12, kneeR: -0.04
    },
    bowedAlone: {                     // Hell — head down, arms limp, weight sunk
      headTilt: 0.9,
      shoulderL: 2.75, elbowL: 0.35,
      shoulderR: 0.4, elbowR: -0.35,
      hipL: 0.25, kneeL: 0.18,
      hipR: -0.25, kneeR: -0.18
    }
  };

  function lerpPose(a, b, m){
    const out = {};
    for(const k in a) out[k] = a[k] + (b[k] - a[k]) * m;
    return out;
  }

  /* ---- classic stick-figure renderer (keyframed joint angles, not IK)
         o: { x, y, s, alpha, color, pose, sway }
         returns the two hand positions in world space (for hand-join checks) ---- */
  function drawStickFigure(o){
    const SNow = Math.min(W, H);
    const FH = SNow * .40;                 // overall figure height reference
    const headR = FH * .07;
    const neckLen = FH * .04, torsoLen = FH * .22;
    const upperLen = FH * .16, foreLen = FH * .15;
    const thighLen = FH * .22, shinLen = FH * .20;
    const lw = FH * .022;                  // limb line width
    const c = o.color, a = o.alpha, p = o.pose;
    const sw = o.sway || 0;

    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(o.s || 1, o.s || 1);

    const hip = [0, 0];
    const shoulderMid = [Math.sin(sw)*FH*.015, -torsoLen];
    strokeLimb(hip[0], hip[1], shoulderMid[0], shoulderMid[1], lw*1.3, c, a); // spine

    const neckTop = [shoulderMid[0], shoulderMid[1] - neckLen];
    strokeLimb(shoulderMid[0], shoulderMid[1], neckTop[0], neckTop[1], lw, c, a); // neck

    const headY = neckTop[1] - headR + p.headTilt * headR * 0.6;
    const headX = neckTop[0] + p.headTilt * headR * 1.2;
    jointDot(headX, headY, headR, c, a); // head circle

    // legs
    const kneeL = [hip[0] + Math.sin(p.hipL)*thighLen, hip[1] + Math.cos(p.hipL)*thighLen];
    const footL = [kneeL[0] + Math.sin(p.hipL+p.kneeL)*shinLen, kneeL[1] + Math.cos(p.hipL+p.kneeL)*shinLen];
    strokeLimb(hip[0], hip[1], kneeL[0], kneeL[1], lw, c, a);
    strokeLimb(kneeL[0], kneeL[1], footL[0], footL[1], lw*.8, c, a);

    const kneeR = [hip[0] + Math.sin(p.hipR)*thighLen, hip[1] + Math.cos(p.hipR)*thighLen];
    const footR = [kneeR[0] + Math.sin(p.hipR+p.kneeR)*shinLen, kneeR[1] + Math.cos(p.hipR+p.kneeR)*shinLen];
    strokeLimb(hip[0], hip[1], kneeR[0], kneeR[1], lw, c, a);
    strokeLimb(kneeR[0], kneeR[1], footR[0], footR[1], lw*.8, c, a);

    // arms
    const elbowL = [shoulderMid[0] + Math.sin(p.shoulderL)*upperLen, shoulderMid[1] + Math.cos(p.shoulderL)*upperLen];
    const handL  = [elbowL[0] + Math.sin(p.shoulderL+p.elbowL)*foreLen, elbowL[1] + Math.cos(p.shoulderL+p.elbowL)*foreLen];
    strokeLimb(shoulderMid[0], shoulderMid[1], elbowL[0], elbowL[1], lw*.85, c, a);
    strokeLimb(elbowL[0], elbowL[1], handL[0], handL[1], lw*.7, c, a);

    const elbowR = [shoulderMid[0] + Math.sin(p.shoulderR)*upperLen, shoulderMid[1] + Math.cos(p.shoulderR)*upperLen];
    const handR  = [elbowR[0] + Math.sin(p.shoulderR+p.elbowR)*foreLen, elbowR[1] + Math.cos(p.shoulderR+p.elbowR)*foreLen];
    strokeLimb(shoulderMid[0], shoulderMid[1], elbowR[0], elbowR[1], lw*.85, c, a);
    strokeLimb(elbowR[0], elbowR[1], handR[0], handR[1], lw*.7, c, a);

    ctx.restore();
    return { handL: [o.x+handL[0]*(o.s||1), o.y+handL[1]*(o.s||1)], handR: [o.x+handR[0]*(o.s||1), o.y+handR[1]*(o.s||1)] };
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
      const settleIn = clamp((t - s3At()) / 2.0, 0, 1);      // eases focal point in, no snap
      fx = W / 2;
      fy = mix(hy, H * .60, settleIn);                        // was a hard jump to H*.60
      s = 1 - .10 * clamp((t - s3At()) / 14, 0, 1);
      camX = Math.sin(t * .22) * SNow * .05 * settleIn;       // orbit fades in too, not instant
      camY = Math.cos(t * .16) * SNow * .03 * settleIn;
      rot  = Math.sin(t * .11) * .015 * settleIn;
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

    // the tree — full opacity in heaven, dissolves with the pasture during the shatter
    if(scene === 1 || (scene === 2 && local < .5)){
      const tc = pal(mp, 'tree');
      const tx = W * .46, ty = horizon;
      const treeAlpha = scene === 1 ? 1 : clamp(1 - local / .5, 0, 1);
      ctx.globalAlpha = treeAlpha;
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
      const side = fh * .30;                    // tightened so the lovers' inner hands can reach the heart
      // reachAmount: inner arms ease up into the clasp over the opening of heaven,
      // then drop back toward the sides as the hands part mid-shatter (0 = at side)
      const reachAmount = scene === 1 ? clamp(local / .3, 0, 1) : clamp(1 - sep, 0, 1);
      // full alpha in heaven; across the shatter the pair fade out by local = 1
      const figAlpha = .95 * (scene === 1 ? 1 : clamp(1 - clamp((local - .5) / .5, 0, 1), 0, 1));
      drawStickFigure({
        x: W / 2 - side, y: heartY + fh * .45, s: 1,
        alpha: figAlpha, color: pal(mp, 'figA'), sway: t * .35,
        pose: lerpPose(POSES.standRelaxed, POSES.reachingCenter_left, reachAmount)
      });
      drawStickFigure({
        x: W / 2 + side, y: heartY + fh * .45, s: 1,
        alpha: figAlpha, color: pal(mp, 'figB'), sway: -t * .35,
        pose: lerpPose(POSES.standRelaxed, POSES.reachingCenter_right, reachAmount)
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
            life: 2.2, r: (Math.random() * .008 + .005) * SNow });
        }
      }
    }
    // the protagonist — alone, head bowed, in hell. Alpha and the bowed pose both
    // ease in on the same pa fade, so he sinks into the slump instead of popping
    // in already crumpled, and stays almost motionless (slow, heavy sway).
    if(scene === 3){
      const pa = clamp((t - s3At()) * 2, 0, 1);
      drawStickFigure({
        x: W / 2, y: H * .60, s: .9,
        alpha: .95 * pa, color: pal(1, 'figA'), sway: t * .22,
        pose: lerpPose(POSES.standRelaxed, POSES.bowedAlone, pa)
      });
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
  const caption  = document.getElementById('caption');
  const startBtn = document.getElementById('startBtn');
  const audioSrc = 'underworld-verse2.mp3';

  let audio = null, audioReady = false, ctxAC = null, analyser = null;
  let started = false;
  let startedAt = 0;
  let curIdx  = -1;
  let acc = 0, wordIdx = 0, activeWords = [];

  /* ---- prepare audio + analyser (idempotent) ---- */
  function prepareAudio(){
    if(audioReady) return;
    audioReady = true;
    coverMeta.textContent = BPM + ' bpm · 4/4 · B♭ Minor';
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

      let i = curIdx;
      for(let k = 0; k < LYRICS.length; k++) if(t >= LYRICS[k].t) i = k;
      setLine(i);
      stepWords(dt);
      pulse();
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

  /* ================= cover buttons ================= */
  startBtn.addEventListener('click', async ()=>{
    await prepareAudio();
    closeCover();
    curIdx = -1;
    startedAt = performance.now();
    started = true;
    last = performance.now();
    try{ await audio.play(); }catch(e){}
    showCaption('Underworld · verse 2 · ' + BPM + ' bpm', 3500);
  });

  requestAnimationFrame(tick);
})();