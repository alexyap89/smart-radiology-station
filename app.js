/* =========================================================================
   Smart Radiology — Is there a fracture?
   Static, offline-first, no dependencies. Explicit state machine.
   ========================================================================= */
(function () {
  "use strict";

  var app = document.getElementById("app");
  var clockEl = document.getElementById("sessionClock");
  var liveEl = document.getElementById("live");
  var overlay = document.getElementById("overlay");

  var IDLE_MS = 180000;
  var ORDER = ["attract", "cases", "quiz", "pos", "lab", "see", "move", "two", "speed", "takeaway", "tools"];

  var state = {
    screen: "attract",
    qIndex: 0,
    correct: 0,
    answered: {},       // index -> "yes" | "no"
    interp: null,
    running: false,
    startedAt: 0
  };

  /* ---------------------------------------------------------------- utils */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function announce(msg) {
    if (!liveEl) return;
    liveEl.textContent = "";
    window.setTimeout(function () { liveEl.textContent = msg; }, 40);
  }
  var toastEl = null, toastTimer = 0;
  function toast(kind, text, ms) {
    toastEl = toastEl || document.getElementById("toast");
    if (!toastEl) return;
    toastEl.className = "toast toast--" + kind;
    toastEl.querySelector(".toast__text").textContent = text;
    toastEl.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toastEl.hidden = true; }, ms || 1700);
  }

  function reduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---------------------------------------------------------------- screens */
  function show(name) {
    if (ORDER.indexOf(name) === -1) return;
    // an enlarged film belongs to the screen it came from
    var fullEl = document.querySelector(".is-full");
    if (fullEl) {
      var fb = fullEl.querySelector('[data-z="full"]');
      if (fb) fb.click();
    }
    state.screen = name;
    app.setAttribute("data-screen", name);

    qsa(".screen").forEach(function (sec) {
      var on = sec.id === "s-" + name;
      sec.classList.toggle("is-active", on);
      sec.setAttribute("aria-hidden", on ? "false" : "true");
    });

    var pipOf = function (screen) { return screen; };
    qsa(".steps__item").forEach(function (el) {
      var idx = ORDER.indexOf(el.getAttribute("data-pip"));
      var at = ORDER.indexOf(pipOf(name));
      el.classList.toggle("is-done", at > -1 && idx < at);
      el.classList.toggle("is-live", at > -1 && idx === at);
    });

    var bar = document.getElementById("scenarioBar");
    if (bar) {
      var map = {
        cases:["", "The two cases, and what each one asks of imaging"],
        quiz: ["1", "RbFracture · the fracture copilot, on four emergency films"],
        pos:  ["1", "RbFracture · the case that went to CT"],
        lab:  ["2", "3D + 4D Lab · still, or a movie"],
        see:  ["2", "AI denoising · the dose it buys"],
        move: ["2", "3D + 4D Lab · the joint in motion"],
        speed:["4", "MRI acceleration · less time in the scanner"],
        two:  ["3", "pRIMe · the scan starts in the waiting room"],
        tools:["", "The tools behind all four programmes"],
        takeaway:["", "What the four programmes can prove"],
        attract:["", ""]
      };
      var entry = map[name] || ["", ""];
      bar.setAttribute("data-scenario", entry[0] ? entry[0].toLowerCase() : "none");
      var tag = document.getElementById("scenarioTag");
      var txt = document.getElementById("scenarioText");
      if (tag) tag.textContent = entry[0] || "·";
      if (txt) txt.textContent = entry[1] || "";
      bar.hidden = !entry[1];   // no banner on the landing page
    }

    var heading = qs("#s-" + name + " h1, #s-" + name + " h2");
    if (heading) announce(heading.textContent.replace(/\s+/g, " ").trim());

    if (name === "lab") startLabRotation(); else stopLabRotation();
    if (name === "pos") startModel();
    if (name === "takeaway") {
      var answered = Object.keys(state.answered).length;
      var hits = [0, 1].filter(function (i) { return state.answered[i] === true; }).length;
      var tk = document.getElementById("tkScore");
      if (tk && answered < 4) { tk.hidden = true; tk.textContent = ""; }
      else if (tk) {
        tk.hidden = false;
        tk.textContent = hits === 4
          ? "You called all four films the way the reporting radiologist did."
          : "You matched the reporting radiologist on " + hits + " of 2 films. The AI and the radiologist agreed on both.";
        tk.className = "verdict verdict--score" + (hits === 4 ? " verdict--clear" : "");
      }
    }
    moveVideos(name === "move");
    playVideos(name === "lab" || name === "move");
    if (name === "speed" && typeof preloadSpeed === "function") preloadSpeed();
    primeLoad(name === "tools");
    if (name !== "takeaway") closeOverlay();
    resetIdle();
  }

  /* presenter keys: -> / space / PageDown advance, <- / PageUp go back.
     On the films screen they advance the film, and refuse to pass an
     unanswered question. */
  function stepScreen(dir) {
    var i = ORDER.indexOf(state.screen);
    if (i < 0) return;
    var n = (i + dir + ORDER.length) % ORDER.length;
    go(ORDER[n]);
  }
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (!overlay || !overlay.hidden) return;

    var fwd = e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown" ||
              e.key === " " || e.key === "Enter";
    var back = e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp";
    if (!fwd && !back) return;

    if (state.screen === "quiz") {
      var ask = document.getElementById("qAsk");
      if (fwd && ask && !ask.hidden) {
        e.preventDefault();
        toast("info", "Answer A or B first — the overlay comes after.", 1400);
        return;
      }
      var nextFilm = document.getElementById("qNext");
      if (fwd && nextFilm && nextFilm.offsetParent !== null) {
        e.preventDefault();
        nextFilm.click();
        return;
      }
    }
    e.preventDefault();
    stepScreen(fwd ? 1 : -1);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var full = document.querySelector(".is-full");
    if (!full) return;
    var btn = full.querySelector('[data-z="full"]');
    if (btn) { btn.click(); return; }
    if (typeof window.__modelExit === "function") window.__modelExit();
  });

  var lastGo = { name: "", at: 0 };
  function go(name) {
    if (state.screen === name) return;
    var now = Date.now();
    if (lastGo.name === name && now - lastGo.at < 400) return;
    lastGo.name = name; lastGo.at = now;
    show(name);
  }

  /* ---------------------------------------------------------------- clock */
  function startClock() {
    if (state.running) return;
    state.running = true;
    document.body.setAttribute("data-started", "1");
    if (clockEl) clockEl.hidden = false;
    state.startedAt = Date.now();
    window.setInterval(function () {
      var s = Math.floor((Date.now() - state.startedAt) / 1000);
      clockEl.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }, 1000);
  }
  function stopClock() {
    state.running = false;
    state.startedAt = 0;
    document.body.removeAttribute("data-started");
    if (clockEl) { clockEl.textContent = "00:00"; clockEl.hidden = true; }
  }

  /* ---------------------------------------------------------------- idle */
  var idleTimer = null;
  function resetIdle() {
    if (idleTimer) window.clearTimeout(idleTimer);
    // a visitor reading a film full screen must not be thrown back to the cover
    if (state.screen === "takeaway" || !overlay.hidden || document.querySelector(".is-full")) return;
    idleTimer = window.setTimeout(function () {
      if (state.screen === "takeaway" || !overlay.hidden || document.querySelector(".is-full")) return;
      toast("info", "Resetting for the next visitor.", 1200);
      window.setTimeout(resetAll, 900);
    }, IDLE_MS);
  }
  ["pointerdown", "keydown", "wheel", "touchstart", "scroll"].forEach(function (evt) {
    window.addEventListener(evt, resetIdle, { passive: true });
  });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) resetIdle(); });
  qsa(".screen").forEach(function (sec) { sec.addEventListener("scroll", resetIdle, { passive: true }); });

  /* ---------------------------------------------------------------- quiz */
  var FILMS = [
    {
      title: "A man fell and cannot bear weight on his right knee.",
      img: "assets/cases/pos-film-ap.png?v=20261110144811", ai: "assets/cases/pos-ai-ap.png?v=20261110144811",
      cap: "Case 1 · right knee · AP", step: "Film 1 of 2", truth: "yes",
      pimg: "assets/img/patient-a.jpg?v=20261110144811",
      palt: "The patient: a man in his seventies in a hospital bed, right knee bandaged.",
      pmeta: "<b>Mr Lim</b> · cannot put weight on it · right knee",
      verdict: "Fracture detected.",
      comment: "RbFracture drew a line across the lateral tibial plateau. So did the radiologist reporting the film.",
      nextLabel: "View the lateral film"
    },
    {
      title: "Same man, lateral view. The joint is swollen.",
      img: "assets/cases/pos-film-lat.png?v=20261110144811", ai: "assets/cases/pos-ai-lat.png?v=20261110144811",
      cap: "Case 1 · right knee · lateral", step: "Film 2 of 2", truth: "yes",
      pimg: "assets/img/patient-a.jpg?v=20261110144811",
      palt: "The patient: a man in his seventies in a hospital bed, right knee bandaged.",
      pmeta: "<b>Mr Lim</b> · cannot put weight on it · right knee",
      verdict: "Fracture, effusion and lipohaemarthrosis detected.",
      comment: "On the lateral view the AI also marks the effusion and a fat–blood level. In a knee that cannot bear weight, that is an intra-articular fracture until proven otherwise.",
      nextLabel: "Next case · a different knee"
    },
  ];

  function renderFilm() {
    // the copilot's operating promise is stated once, on the first film
    var intro = document.getElementById("qIntro");
    if (intro) intro.hidden = state.qIndex !== 0;
    var f = FILMS[state.qIndex];
    var qImg = qs("#qImg");
    qImg.src = f.img;
    fitFrame(qImg);

    qs("#qImg").alt = "De-identified knee radiograph, " + f.cap;
    qs("#qCap").textContent = f.cap;
    qs("#qStep").textContent = "1 · RbFracture · film " + (state.qIndex + 1) + " of 2 · overnight queue";
    var caseLine = document.getElementById("qCase");
    if (caseLine && f.title) caseLine.innerHTML = f.title;
    qs("#qAsk").hidden = false;
    qs("#qReveal").hidden = true;
    qs("#qScore").hidden = true;
    qs("#qNext").textContent = f.nextLabel;
  }

  function answerFilm(answer) {
    var f = FILMS[state.qIndex];
    if (state.answered[state.qIndex]) return;
    state.answered[state.qIndex] = (answer === f.truth);

    var right = answer === f.truth;
    var v = qs("#qVerdict");
    v.textContent = (right ? "You and the radiologist agree. " : "The radiologist read it differently. ") + f.verdict;
    v.className = "verdict " + (f.truth === "yes" ? "verdict--hit" : "verdict--clear");

    qs("#qAiImg").src = f.ai;
    qs("#qAiImg").alt = "AI analysis overlay, " + f.cap;
    qs("#qAiCap").textContent = "AI analysis · " + f.cap.split("·")[2];
    qs("#qComment").textContent = f.comment;

    var chip = qs('#qScoreChips li[data-chip="' + state.qIndex + '"]');
    if (chip) chip.classList.add(right ? "is-right" : "is-wrong");

    qs("#qAsk").hidden = true;
    qs("#qReveal").hidden = false;
    var qscreen = document.getElementById("s-quiz");
    if (qscreen) qscreen.setAttribute("data-revealed", "1");
    qs("#qReveal").classList.remove("is-in");
    void qs("#qReveal").offsetWidth;
    qs("#qReveal").classList.add("is-in");

    toast(right ? "right" : "wrong", right ? "You called it the way the radiologist did." : "The radiologist read it differently.");
    announce(v.textContent);
  }

  function nextFilm() {
    if (state.qIndex < FILMS.length - 1) {
      state.qIndex += 1;
      renderFilm();
      return;
    }
    qs("#qReveal").hidden = true;
    qs("#qScore").hidden = false;
    // scored per film: four films, four calls, which is what the visitor made
    var hits = [0, 1].filter(function (i) { return state.answered[i] === true; }).length;
    qs("#qScoreN").textContent = hits;
    qs("#qScore").setAttribute("data-score", String(hits));
  }

  /* ---------------------------------------------------------------- image tabs */
  var VIEWS = {
    ct:     { src: "assets/cases/pos-ct-coronal.png?v=20261110144811", cap: "Coronal bone window. A split fracture runs through the lateral tibial plateau." },
    bme:    { src: "assets/cases/pos-bme-fusion.png?v=20261110144811", cap: "Dual-energy fusion: the marrow oedema map. The bruise inside the bone, invisible on plain CT." },
    bmeneg: { src: "assets/cases/neg-bme-fusion.png?v=20261110144811", cap: "Dual-energy fusion: no marrow oedema. Nothing for the spectral map to flag." },
    sag:    { src: "assets/cases/neg-sag.png?v=20261110144811", cap: "Sagittal reformat: joint-space narrowing and osteophytes. Degenerative, not acute." }
  };

  // A frame should be the image, not a letterbox around it: every plate and
  // viewer stage reports its picture's aspect ratio as --ar, and the CSS sizes
  // the frame from that plus a fixed height.
  function fitFrame(imgEl) {
    if (!imgEl || !imgEl.parentNode) return;
    var box = imgEl.closest(".plate__frame, .viewer__stage");
    if (!box) return;
    var apply = function () {
      if (!imgEl.naturalWidth || !imgEl.naturalHeight) return;
      box.style.setProperty("--ar", (imgEl.naturalWidth / imgEl.naturalHeight).toFixed(4));
      // the plate's control bar is wider than a portrait film: pin the wrapper to
      // the frame so the column does not carry dead space beside the picture
      var plate = box.closest(".plate");
      if (plate) {
        window.requestAnimationFrame(function () {
          plate.style.setProperty("--w", Math.round(box.getBoundingClientRect().width) + "px");
        });
      }
    };
    if (imgEl.complete && imgEl.naturalWidth) apply();
    else imgEl.addEventListener("load", apply, { once: true });
  }

  function setView(key, imgEl, capEl, barEl) {
    var v = VIEWS[key];
    if (!v) return;
    imgEl.src = v.src;
    fitFrame(imgEl);
    capEl.textContent = v.cap;
    qsa(".tab", barEl).forEach(function (t) {
      t.classList.toggle("is-on", t.getAttribute("data-view") === key);
    });
  }

  /* ---------------------------------------------------------------- 3D model */
  var gl = { ready: false, started: false, raf: 0, wire: false };
  var mv = { yaw: -0.55, pitch: 0.18, dist: 1.42, drag: null, last: 0, spin: true };

  function decodeMesh(src) {
    function b64ToBytes(s) {
      var bin = atob(s), out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    var posI = new Int16Array(b64ToBytes(src.positions).buffer);
    var norI = new Int8Array(b64ToBytes(src.normals).buffer);
    var idx = src.wide
      ? new Uint32Array(b64ToBytes(src.indices).buffer)
      : new Uint16Array(b64ToBytes(src.indices).buffer);
    var n = src.verts;
    var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    for (var i = 0; i < n * 3; i++) {
      pos[i] = posI[i] / 32767;
      nor[i] = norI[i] / 127;
    }
    return { pos: pos, nor: nor, idx: idx, count: src.tris * 3 };
  }

  function mat4Mul(a, b) {
    var o = new Float32Array(16);
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
      o[j * 4 + i] = a[0 * 4 + i] * b[j * 4 + 0] + a[1 * 4 + i] * b[j * 4 + 1] +
                     a[2 * 4 + i] * b[j * 4 + 2] + a[3 * 4 + i] * b[j * 4 + 3];
    }
    return o;
  }
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function rotXY(yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var ry = new Float32Array([cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]);
    var rx = new Float32Array([1, 0, 0, 0, 0, cp, sp, 0, 0, -sp, cp, 0, 0, 0, 0, 1]);
    return mat4Mul(ry, rx);
  }
  function translate(x, y, z) { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]); }
  function scale(s) { return new Float32Array([s,0,0,0, 0,s,0,0, 0,0,s,0, 0,0,0,1]); }

  var VS = "attribute vec3 aPos; attribute vec3 aNor; uniform mat4 uProj; uniform mat4 uView;" +
    "varying vec3 vNor; varying vec3 vEye;" +
    "void main(){ vec4 eye = uView * vec4(aPos,1.0); vEye = -eye.xyz; vNor = mat3(uView) * aNor;" +
    "gl_Position = uProj * eye; }";
  var FS = "precision mediump float; varying vec3 vNor; varying vec3 vEye; uniform vec3 uColor; uniform float uWire;" +
    "void main(){ if(uWire > 0.5){ gl_FragColor = vec4(0.37,0.82,0.85,0.55); return; }" +
    "vec3 n = normalize(vNor); vec3 v = normalize(vEye);" +
    "float key = max(dot(n, normalize(vec3(-0.4,0.7,0.6))), 0.0);" +
    "float fill = max(dot(n, normalize(vec3(0.7,0.1,0.4))), 0.0) * 0.35;" +
    "float rim = pow(1.0 - max(dot(n, v), 0.0), 2.2);" +
    "vec3 col = uColor * (0.20 + 0.55 * key + fill * 0.6) + vec3(0.37,0.82,0.85) * rim * 0.35;" +
    "gl_FragColor = vec4(col, 1.0); }";

  function startModel() {
    if (gl.started) return;
    gl.started = true;

    var canvas = document.getElementById("glCanvas");
    var fallback = document.getElementById("glFallback");
    var mesh = window.__TIBIA_MESH;
    if (!canvas) return;
    if (!mesh) {
      if (fallback) fallback.hidden = false;
      canvas.style.display = "none";
      return;
    }

    // WebGL2 first: 32-bit indices are core there, and a device can offer
    // WebGL2 while reporting no OES_element_index_uint on a WebGL1 context.
    var opts = { antialias: true, alpha: true, preserveDrawingBuffer: false };
    var ctx = canvas.getContext("webgl2", opts) ||
              canvas.getContext("webgl", opts) ||
              canvas.getContext("experimental-webgl", opts);
    function bail(why) {
      if (fallback) {
        var p = fallback.querySelector("p");
        if (p) p.textContent = "3D view unavailable on this device (" + why + "). The CT above and the AR link still work.";
        fallback.hidden = false;
      }
      canvas.style.display = "none";
    }
    if (!ctx) { bail("no WebGL context"); return; }
    var isGL2 = !!(window.WebGL2RenderingContext && ctx instanceof window.WebGL2RenderingContext);
    var ext32 = isGL2 ? true : ctx.getExtension("OES_element_index_uint");

    function shader(type, src) {
      var s = ctx.createShader(type);
      ctx.shaderSource(s, src); ctx.compileShader(s);
      if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS)) {
        window.__glLog = (window.__glLog || "") + "compile: " + ctx.getShaderInfoLog(s) + "\n" + src + "\n";
      }
      return s;
    }
    var prog = ctx.createProgram();
    ctx.attachShader(prog, shader(ctx.VERTEX_SHADER, VS));
    ctx.attachShader(prog, shader(ctx.FRAGMENT_SHADER, FS));
    ctx.linkProgram(prog);
    if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) {
      window.__glLog = (window.__glLog || "") + "link: " + ctx.getProgramInfoLog(prog) + "\n";
      if (fallback) fallback.hidden = false;
      canvas.style.display = "none";
      return;
    }
    ctx.useProgram(prog);

    var data = decodeMesh(mesh);
    var use32 = !(data.idx instanceof Uint16Array);
    if (use32 && !ext32) {
      bail("this browser has no 32-bit index support");
      return;
    }
    function buffer(target, arr) {
      var b = ctx.createBuffer();
      ctx.bindBuffer(target, b);
      ctx.bufferData(target, arr, ctx.STATIC_DRAW);
      return b;
    }
    var posBuf = buffer(ctx.ARRAY_BUFFER, data.pos);
    var norBuf = buffer(ctx.ARRAY_BUFFER, data.nor);
    var idxBuf = buffer(ctx.ELEMENT_ARRAY_BUFFER, data.idx);

    var aPos = ctx.getAttribLocation(prog, "aPos");
    var aNor = ctx.getAttribLocation(prog, "aNor");
    var uProj = ctx.getUniformLocation(prog, "uProj");
    var uView = ctx.getUniformLocation(prog, "uView");
    var uColor = ctx.getUniformLocation(prog, "uColor");
    var uWire = ctx.getUniformLocation(prog, "uWire");

    var lineIdx = null;
    function buildLines() {
      var set = {};
      var out = [];
      for (var i = 0; i < data.idx.length; i += 3) {
        var a = data.idx[i], b = data.idx[i + 1], c = data.idx[i + 2];
        [[a, b], [b, c], [c, a]].forEach(function (e) {
          var k = e[0] < e[1] ? e[0] + ":" + e[1] : e[1] + ":" + e[0];
          if (!set[k]) { set[k] = 1; out.push(e[0], e[1]); }
        });
      }
      return new Uint32Array(out);
    }

    var pos = data.pos || null;
    if (pos) {
      var lo = Infinity, hi = -Infinity;
      for (var iy = 1; iy < pos.length; iy += 3) {
        if (pos[iy] < lo) lo = pos[iy];
        if (pos[iy] > hi) hi = pos[iy];
      }
      gl.minY = lo; gl.maxY = hi;
    } else { gl.minY = -1; gl.maxY = 1; }

    function resize() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.viewport(0, 0, canvas.width, canvas.height);
      gl.ready = true;
    }
    resize();
    window.addEventListener("resize", resize);
    if (window.ResizeObserver) {
      new ResizeObserver(function () { resize(); }).observe(canvas);
    }

    function draw() {
      if (!gl.ready) return;
      var w = canvas.width, h = canvas.height;
      ctx.clearColor(0.03, 0.05, 0.07, 1);
      ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
      ctx.enable(ctx.DEPTH_TEST);
      ctx.enable(ctx.CULL_FACE);

      var proj = perspective(0.72, w / h, 0.05, 20);
      var view = mat4Mul(translate(0, 0, -mv.dist), rotXY(mv.yaw, mv.pitch));
      ctx.uniformMatrix4fv(uProj, false, proj);
      ctx.uniformMatrix4fv(uView, false, view);
      ctx.uniform3f(uColor, 0.94, 0.91, 0.85);
      ctx.uniform1f(uWire, gl.wire ? 1 : 0);

      ctx.bindBuffer(ctx.ARRAY_BUFFER, posBuf);
      ctx.enableVertexAttribArray(aPos);
      ctx.vertexAttribPointer(aPos, 3, ctx.FLOAT, false, 0, 0);
      ctx.bindBuffer(ctx.ARRAY_BUFFER, norBuf);
      ctx.enableVertexAttribArray(aNor);
      ctx.vertexAttribPointer(aNor, 3, ctx.FLOAT, false, 0, 0);

      if (gl.wire) {
        if (!lineIdx) lineIdx = buffer(ctx.ELEMENT_ARRAY_BUFFER, buildLines());
        else ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, lineIdx);
        ctx.disable(ctx.CULL_FACE);
        ctx.drawElements(ctx.LINES, lineIdx.length, ext32 ? ctx.UNSIGNED_INT : ctx.UNSIGNED_SHORT, 0);
      } else {
        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, idxBuf);
        ctx.drawElements(ctx.TRIANGLES, data.count, use32 ? ctx.UNSIGNED_INT : ctx.UNSIGNED_SHORT, 0);
      }
    }

    function loop(t) {
      if (mv.spin && !mv.drag && !reduced()) mv.yaw += 0.0035;
      draw();
      gl.raf = requestAnimationFrame(loop);
    }
    gl.raf = requestAnimationFrame(loop);

    /* orbit */
    canvas.addEventListener("pointerdown", function (e) {
      mv.drag = { x: e.clientX, y: e.clientY };
      mv.spin = false;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!mv.drag) return;
      // direct manipulation: the surface follows the finger, so a rightward drag
      // turns the near face right and a downward drag tips the top towards you.
      // direct manipulation: with this matrix, +yaw turns the near face right
      // and +pitch tips it towards the viewer, so the drag sign is positive.
      mv.yaw += (e.clientX - mv.drag.x) * 0.01;
      mv.pitch += (e.clientY - mv.drag.y) * 0.01;
      mv.pitch = Math.max(-1.3, Math.min(1.3, mv.pitch));
      mv.drag = { x: e.clientX, y: e.clientY };
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      canvas.addEventListener(ev, function () { mv.drag = null; });
    });
    canvas.addEventListener("wheel", function (e) {
      mv.dist = Math.max(1.4, Math.min(6, mv.dist + e.deltaY * 0.0016));
      e.preventDefault();
    }, { passive: false });

    var reset = document.getElementById("glReset");
    if (reset) reset.addEventListener("click", function () {
      mv.yaw = -0.55; mv.pitch = 0.18; mv.dist = 1.42; mv.spin = true;
    });

    var modelFull = document.getElementById("glFull");
    var modelClose = document.getElementById("glClose");
    var modelBox = document.querySelector("#s-pos .model");
    function setModelFull(on) {
      if (!modelBox) return;
      modelBox.classList.toggle("is-full", on);
      document.body.classList.toggle("has-full", on);
      if (modelFull) {
        modelFull.textContent = on ? "Exit full screen" : "Full screen";
        modelFull.setAttribute("aria-pressed", on ? "true" : "false");
      }
      window.setTimeout(resize, 60);
    }
    if (modelFull && modelBox) {
      modelFull.addEventListener("click", function () {
        setModelFull(!modelBox.classList.contains("is-full"));
      });
    }
    if (modelClose) {
      modelClose.addEventListener("click", function () { setModelFull(false); });
    }
    window.__modelExit = function () { if (modelBox && modelBox.classList.contains("is-full")) setModelFull(false); };
  }

  /* ---------------------------------------------------------------- media */
  function playVideos(on) {
    // the 3D renders are shown slower on purpose: at full speed the model turns
    // too fast to read what the anatomy is doing.
    qsa("#s-lab .vid video").forEach(function (v) {
      if (reduced()) return;
      v.playbackRate = 0.35;
      // re-assert on every play and on load: setting src resets the rate
      if (!v.getAttribute("data-slowed")) {
        v.setAttribute("data-slowed", "1");
        v.addEventListener("play", function () { if (!reduced()) v.playbackRate = 0.35; });
        v.addEventListener("loadeddata", function () { if (!reduced()) v.playbackRate = 0.35; });
      }
    });
    qsa(".vid video, #s-move video").forEach(function (v) {
      if (on) {
        if (!v.getAttribute("src") && v.getAttribute("data-src")) v.setAttribute("src", v.getAttribute("data-src"));
        if (v.play) v.play().catch(function () {});
      } else if (v.pause) { v.pause(); }
    });
  }

  function wireVideos() {
    qsa(".vid video").forEach(function (v) {
      var src = v.getAttribute("data-src") || v.getAttribute("src");
      v.removeAttribute("src");
      if (src) v.setAttribute("data-src", src);
      v.addEventListener("pointerenter", function () {
        if (!v.getAttribute("src") && v.getAttribute("data-src")) v.setAttribute("src", v.getAttribute("data-src"));
        if (v.play) v.play().catch(function () {});
      });
      // no pause on pointerleave: the lab clips loop for as long as the screen
      // is up, and playVideos(false) stops them when it is not
    });
  }

  var PRIME_URL = "https://primemri.netlify.app";

  function primeLoad(on) {
    var f = document.getElementById("primeFrame");
    if (!f) return;
    if (on) {
      if (f.getAttribute("data-live") !== "1") {
        f.setAttribute("src", PRIME_URL);
        f.setAttribute("data-live", "1");
        window.setTimeout(function () {
          var off = document.getElementById("primeOffline");
          if (off && f.getAttribute("data-live") === "1" && !f.dataset.loaded) off.hidden = false;
        }, 7000);
      }
    } else {
      // about:blank unloads the document, which stops video and audio from the tour
      if (f.getAttribute("data-live") === "1") {
        f.setAttribute("src", "about:blank");
        f.setAttribute("data-live", "0");
        var off = document.getElementById("primeOffline");
        if (off) off.hidden = true;
      }
    }
  }

  function wirePrimeFrame() {
    var frame = document.getElementById("primeFrame");
    var off = document.getElementById("primeOffline");
    if (!frame || !off) return;
    frame.addEventListener("load", function () {
      frame.dataset.loaded = "1";
      if (frame.getAttribute("data-live") === "1") off.hidden = true;
    });
  }

  /* ---------------------------------------------------------------- lab: the render gallery */
  var LAB_CASES = {
    foot: {
      src: "assets/cine/foot.jpg?v=20261110144811",
      cap: "Charcot arthropathy. The talar dome is articulating with the midfoot instead of the tibia, and a large effusion has displaced the ankle tendons.",
      alt: "Cinematic rendering of a Charcot foot: the talar dome articulating with the midfoot instead of the tibia."
    },
    scapula: {
      src: "assets/cine/scapula.jpg?v=20261110144811",
      cap: "Traumatic structural isolation of the scapula, with a comminuted scapular fracture and a displaced clavicle.",
      alt: "Cinematic rendering of a fractured scapula with a displaced clavicle and rib fractures."
    },
    ribs: {
      src: "assets/cine/ribs.jpg?v=20261110144811",
      cap: "Traumatic right rib fractures, rendered with the chest drain in place — the drain and the fractures in one view.",
      alt: "Cinematic rendering of traumatic right rib fractures with a chest drain in situ."
    }
  };

  function labSelect(key) {
    var c = LAB_CASES[key];
    if (!c) return;
    var img = document.getElementById("labImg");
    var cap = document.getElementById("labCap");
    var root = document.getElementById("labGallery");
    if (img) { img.src = c.src; img.alt = c.alt; }
    if (cap) cap.textContent = c.cap;
    if (root) root.setAttribute("data-case", key);
    qsa(".gallery__tab").forEach(function (b) {
      var on = b.getAttribute("data-case") === key;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  var SEE_CASES = {
    pelvis: {
      src: "assets/photos/ct-fbp-dlir-pelvis.jpg?v=20261110144811",
      cap: "One acquisition, two reconstructions. Left: the scan as conventionally rebuilt, grainy at this noise level. Right: the same raw data denoised by AI.",
      alt: "The same axial CT slice twice: filtered back projection, noise-grainy, and DLIR-High, clean."
    },
    abdomen: {
      src: "assets/photos/ct-fbp-dlir-abdomen.jpg?v=20261110144811",
      cap: "The same comparison higher in the abdomen, where low contrast detectability matters most.",
      alt: "An upper abdominal axial CT slice twice: filtered back projection and DLIR-High."
    },
    vendor: {
      src: "assets/photos/ge-truefidelity.jpg?v=20261110144811",
      cap: "Vendor example, not our data: conventional, half-strength and AI reconstruction at 0.625 mm, from the vendor brochure.",
      alt: "Three coronal CT reformats: FBP, ASiR-V 50 percent and TrueFidelity."
    }
  };

  function seeSelect(key) {
    var c = SEE_CASES[key];
    if (!c) return;
    var img = document.getElementById("seeImg");
    var cap = document.getElementById("seeCap");
    var root = document.getElementById("seeGallery");
    var flag = document.getElementById("seeFlag");
    if (img) { img.src = c.src; img.alt = c.alt; }
    if (cap) cap.textContent = c.cap;
    if (root) root.setAttribute("data-case", key);
    if (flag) flag.hidden = key !== "vendor";
    qsa("#seeGallery .gallery__tab").forEach(function (b) {
      var on = b.getAttribute("data-case") === key;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  var SPEED_CASES = {
    coronal: {
      src: "assets/cases/mri-drb-coronal-stir.jpg?v=20261110144811",
      cap: "Our own scan. Left: Deep Resolve Boost High. Right: the same patient a year earlier. Coronal T2 STIR through the posterior fossa and neck.",
      alt: "Coronal T2 STIR of the same patient: Deep Resolve Boost High on the left, the previous year's scan on the right."
    },
    axial: {
      src: "assets/cases/mri-drb-axial-stir.jpg?v=20261110144811",
      cap: "Our own scan, axial T2 STIR. Left: AI-accelerated reconstruction. Right: the conventional reconstruction of the same study.",
      alt: "Axial T2 STIR, Deep Resolve Boost study on the left and the earlier DIXON study on the right."
    },
    sagittal: {
      src: "assets/cases/mri-drb-sag-t1.jpg?v=20261110144811",
      cap: "Our own scan. Sagittal T1. Left: Deep Resolve Boost High study. Right: the earlier scan.",
      alt: "Sagittal T1 of the cervical spine: the Deep Resolve Boost High study on the left, the earlier scan on the right."
    }
  };

  function speedSelect(key) {
    var c = SPEED_CASES[key];
    if (!c) return;
    var img = document.getElementById("speedImg");
    var cap = document.getElementById("speedCap");
    var root = document.getElementById("speedGallery");
    // decode first, then swap: the old scan stays on screen instead of a blank
    if (img) {
      var next = new Image();
      next.onload = function () { img.src = c.src; img.alt = c.alt; };
      next.src = c.src;
    }
    if (cap) cap.textContent = c.cap;
    if (root) root.setAttribute("data-case", key);
    qsa("#speedGallery .gallery__tab").forEach(function (b) {
      var on = b.getAttribute("data-case") === key;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function preloadSpeed() {
    Object.keys(SPEED_CASES).forEach(function (k) {
      var i = new Image();
      i.src = SPEED_CASES[k].src;
    });
  }

  function wireSpeedGallery() {
    qsa("#speedGallery .gallery__tab").forEach(function (b) {
      b.addEventListener("click", function () { speedSelect(b.getAttribute("data-case")); });
    });
    speedSelect("axial");
    preloadSpeed();
  }

  function wireSeeGallery() {
    qsa("#seeGallery .gallery__tab").forEach(function (b) {
      b.addEventListener("click", function () { seeSelect(b.getAttribute("data-case")); });
    });
    seeSelect("pelvis");
  }

  /* each cinematic render gets airtime: the three cases rotate while the
     screen is up, and a tap takes over. */
  var LAB_ORDER = ["foot", "scapula", "ribs"];
  var labTimer = 0, labAt = 0;
  function stopLabRotation() {
    if (labTimer) { window.clearInterval(labTimer); labTimer = 0; }
  }
  function startLabRotation() {
    stopLabRotation();
    if (reduced()) return;
    labAt = Math.max(0, LAB_ORDER.indexOf((document.getElementById("labGallery") || {}).getAttribute
      ? document.getElementById("labGallery").getAttribute("data-case") : "foot"));
    labTimer = window.setInterval(function () {
      labAt = (labAt + 1) % LAB_ORDER.length;
      labSelect(LAB_ORDER[labAt]);
    }, 5200);
  }
  qsa("#labGallery .gallery__tab").forEach(function (b) {
    b.addEventListener("click", stopLabRotation);
  });

  function resetLab() { labSelect("foot"); }

  function wireGallery() {
    qsa(".gallery__tab").forEach(function (b) {
      b.addEventListener("click", function () { labSelect(b.getAttribute("data-case")); });
    });
  }

  /* ---------------------------------------------------------------- move: the 4D cine */
  var CINE_CASES = {
    knee: { cap: "Knee, through flexion. The volume render rebuilt from the same acquisition, phase by phase." },
    surface: { cap: "Hindfoot, rendered surface. One acquisition, stepped through the arc." },
    full: { cap: "Ankle and hindfoot, as it comes off the workstation: two volume renders above, two reformats below." },
    shoulder: { cap: "Shoulder. The humeral head through its range of motion, with surgical clips and vessels in view." }
  };

  function cineNodes() {
    var root = document.getElementById("moveCine");
    if (!root) return null;
    return {
      root: root,
      video: document.getElementById("cineVideo"),
      cap: document.getElementById("cineCap"),
      phase: document.getElementById("cinePhase"),
      tabs: qsa(".cine__tab", root)
    };
  }

  function cinePhaseOf(v) {
    if (!v || !isFinite(v.duration) || v.duration <= 0) return 1;
    return Math.min(12, Math.floor((v.currentTime / v.duration) * 12) + 1);
  }

  function cinePaintPhase() {
    var n = cineNodes();
    if (!n || !n.video || !n.phase) return;
    n.phase.textContent = "phase " + cinePhaseOf(n.video);
  }

  function cineStop() {
    var n = cineNodes();
    if (!n || !n.video) return;
    if (n.video.pause) n.video.pause();
    if (n.video.removeAttribute) n.video.removeAttribute("src");
    if (n.video.load) n.video.load();
    n.root.setAttribute("data-state", "idle");
    if (n.phase) n.phase.textContent = "phase 1";
  }

  function cineSelect(key) {
    var c = CINE_CASES[key];
    var n = cineNodes();
    if (!c || !n || !n.video) return;
    var wasPlaying = document.getElementById("s-move").classList.contains("is-active");
    cineStop();
    n.root.setAttribute("data-case", key);
    n.video.setAttribute("data-src", "assets/videos/4d-" + key + ".mp4");
    n.video.setAttribute("poster", "assets/videos/4d-" + key + ".jpg");
    if (n.cap) n.cap.textContent = c.cap;
    n.tabs.forEach(function (b) {
      var on = b.getAttribute("data-case") === key;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (wasPlaying) cinePlay();
  }

  function cinePlay() {
    var n = cineNodes();
    if (!n || !n.video) return;
    var v = n.video;
    if (!v.getAttribute("src")) {
      var src = v.getAttribute("data-src");
      if (src) v.setAttribute("src", src);
    }
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
    n.root.setAttribute("data-state", "playing");
  }

  function cinePause() {
    var n = cineNodes();
    if (!n || !n.video) return;
    if (n.video.pause) n.video.pause();
    n.root.setAttribute("data-state", "paused");
  }

  function cineReset() {
    var n = cineNodes();
    if (!n || !n.video) return;
    if (n.video.pause) n.video.pause();
    if (n.video.currentTime !== undefined) n.video.currentTime = 0;
    n.root.setAttribute("data-state", "idle");
    if (n.phase) n.phase.textContent = "phase 1";
  }

  function cineLeave() {
    var n = cineNodes();
    if (!n || !n.video || n.root.getAttribute("data-state") !== "playing") return;
    cineStop();
  }

  function resetCine() { cineSelect("knee"); }

  function wireCine() {
    var n = cineNodes();
    if (!n || !n.video) return;
    n.video.addEventListener("timeupdate", cinePaintPhase);
    // a big clip takes a moment to buffer: start it as soon as it can play,
    // and say so if the file is missing rather than showing a dead frame
    n.video.addEventListener("loadeddata", function () {
      if (document.getElementById("s-move").classList.contains("is-active") && n.video.paused) cinePlay();
    });
    n.video.addEventListener("error", function () {
      if (n.phase) n.phase.textContent = "clip unavailable";
    });
    n.video.addEventListener("play", function () { n.root.setAttribute("data-state", "playing"); });
    n.video.addEventListener("pause", function () {
      if (n.root.getAttribute("data-state") !== "idle") n.root.setAttribute("data-state", "paused");
    });
    qsa("[data-cine]").forEach(function (b) {
      var act = b.getAttribute("data-cine");
      b.addEventListener("click", function () {
        if (act === "play") cinePlay();
        else if (act === "pause") cinePause();
        else if (act === "reset") cineReset();
      });
    });
    n.tabs.forEach(function (b) {
      b.addEventListener("click", function () { cineSelect(b.getAttribute("data-case")); });
    });
    cineSelect("knee");
  }

  /* ---------------------------------------------------------------- move: three clips */
  function moveVideos(on) {
    qsa("#s-move video").forEach(function (v) {
      if (on) {
        if (!v.getAttribute("src") && v.getAttribute("data-src")) v.setAttribute("src", v.getAttribute("data-src"));
        if (v.play) v.play().catch(function () {});
      } else if (v.pause) { v.pause(); }
    });
  }

  /* ---------------------------------------------------------------- reset */
  function resetAll() {
    state.qIndex = 0;
    state.correct = 0;
    state.answered = {};
    state.interp = null;
    stopClock();

    lastGo = { name: "", at: 0 };
    if (toastEl) toastEl.hidden = true;
    window.clearTimeout(toastTimer);
    resetLab();
    resetCine();
    qsa(".qscore li").forEach(function (li) { li.classList.remove("is-right", "is-wrong"); });
    qsa(".btn--path").forEach(function (b) { b.classList.remove("is-chosen", "is-muted"); });
    var tk = document.getElementById("tkScore");
    if (tk) { tk.hidden = true; tk.textContent = ""; }

    renderFilm();
    closeOverlay();
    show("attract");
    qsa(".steps__item").forEach(function (el) { el.classList.remove("is-done", "is-live"); });
  }

  /* ---------------------------------------------------------------- summary overlay */
  function openOverlay() {
    overlay.hidden = false;
    if (idleTimer) window.clearTimeout(idleTimer);
    var btn = document.getElementById("closeTakeaway");
    if (btn) btn.focus();
    announce("Summary open.");
  }
  function closeOverlay() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    resetIdle();
  }

  /* ---------------------------------------------------------------- events */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-go], [data-answer], [data-view]");
    if (!t) return;

    if (t.hasAttribute("data-view")) {
      var bar = t.closest(".viewer__bar");
      var stage = bar.parentNode.querySelector(".viewer__stage");
      var cap = bar.parentNode.querySelector(".viewer__cap");
      setView(t.getAttribute("data-view"), stage.querySelector("img"), cap, bar);
      return;
    }
    if (t.hasAttribute("data-answer")) { answerFilm(t.getAttribute("data-answer")); return; }
    if (t.hasAttribute("data-go")) {
      var dest = t.getAttribute("data-go");
      if (dest === "attract") { resetAll(); return; }
      if (!state.running) startClock();
      go(dest);
    }
  });

  document.getElementById("restartBtn").addEventListener("click", resetAll);

  var qNextBtn = document.getElementById("qNext");
  if (qNextBtn) qNextBtn.addEventListener("click", nextFilm);

  var openBtn = document.getElementById("openTakeaway");
  if (openBtn) openBtn.addEventListener("click", openOverlay);
  var closeBtn = document.getElementById("closeTakeaway");
  if (closeBtn) closeBtn.addEventListener("click", closeOverlay);
  var printBtn = document.getElementById("printTakeaway");
  if (printBtn) printBtn.addEventListener("click", function () { window.print(); });

  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeOverlay(); });
  if (overlay) overlay.addEventListener("click", function (e) { if (e.target === overlay) closeOverlay(); });

  /* ---------------------------------------------------------------- image fallbacks
     Never replace the <img> node: the state machine holds a reference to it. */
  qsa("img").forEach(function (img) {
    img.addEventListener("error", function () {
      var host = img.parentNode;
      if (!host) return;
      img.style.visibility = "hidden";
      if (host.querySelector(".asset-missing")) return;
      var box = document.createElement("div");
      box.className = "asset-missing";
      box.textContent = "Image unavailable";
      host.appendChild(box);
    });
    img.addEventListener("load", function () {
      img.style.visibility = "";
      var box = img.parentNode && img.parentNode.querySelector(".asset-missing");
      if (box) box.remove();
    });
  });

  /* ---------------------------------------------------------------- breath caption */
  var breathText = document.getElementById("breathState");
  if (breathText && !reduced()) {
    var phases = ["Breathe in", "Hold", "Breathe out"], i = 0;
    window.setInterval(function () {
      if (state.screen !== "two") return;
      i = (i + 1) % phases.length;
      breathText.textContent = phases[i];
    }, 2600);
  }

  /* ---------------------------------------------------------------- image windowing */
  var WINDOWS = [];

  function initWindows() {
    [["plate", null]].forEach(function () {});

    function makeViewer(img, frame, bar) {
      if (!img || !frame) return null;
      var v = { img: img, frame: frame, b: 100, c: 100, z: 1, x: 0, y: 0, pointers: {} };
      var shell = frame.closest(".plate, .viewer");

      // Full screen is a CSS overlay, not the Fullscreen API: iOS Safari only
      // grants requestFullscreen to video, and this station runs on an iPad.
      function setFull(on) {
        if (!shell) return;
        shell.classList.toggle("is-full", on);
        document.body.classList.toggle("has-full", on);
        var btn = bar && bar.querySelector('[data-z="full"]');
        if (btn) {
          btn.textContent = on ? "Exit full screen" : "Full screen";
          btn.setAttribute("aria-pressed", on ? "true" : "false");
        }
        paint();
      }

      var bSlider = bar && bar.querySelector('[data-w="b"]');
      var cSlider = bar && bar.querySelector('[data-w="c"]');
      var zLabel = bar && bar.querySelector("[data-zval]");

      // The picture is drawn with object-fit: contain, so at 100% it usually
      // fills one axis and leaves slack on the other. Panning is allowed across
      // that slack as well as the overflow created by zoom, which is what makes
      // a drag feel like moving the film rather than nothing at all.
      function painted() {
        var fw = frame.clientWidth, fh = frame.clientHeight;
        var nw = img.naturalWidth || fw, nh = img.naturalHeight || fh;
        var s = Math.min(fw / nw, fh / nh);
        return { w: nw * s, h: nh * s, fw: fw, fh: fh };
      }
      function clampPan() {
        var p = painted();
        var slackX = Math.max(0, (p.fw - p.w) / 2);
        var slackY = Math.max(0, (p.fh - p.h) / 2);
        var zoomX = Math.max(0, (p.w * v.z - p.fw) / 2);
        var zoomY = Math.max(0, (p.h * v.z - p.fh) / 2);
        var maxX = slackX + zoomX, maxY = slackY + zoomY;
        v.x = Math.max(-maxX, Math.min(maxX, v.x));
        v.y = Math.max(-maxY, Math.min(maxY, v.y));
      }
      function paint() {
        clampPan();
        img.style.filter = "brightness(" + v.b + "%) contrast(" + v.c + "%)";
        img.style.transform = "translate(" + v.x.toFixed(1) + "px," + v.y.toFixed(1) + "px) scale(" + v.z.toFixed(2) + ")";
        if (zLabel) zLabel.textContent = Math.round(v.z * 100) + "%";
      }
      function reset() {
        v.b = 100; v.c = 100; v.z = 1; v.x = 0; v.y = 0;
        if (bSlider) bSlider.value = 100;
        if (cSlider) cSlider.value = 100;
        paint();
      }
      function zoomAt(factor) {
        v.z = Math.max(1, Math.min(4, v.z * factor));
        paint();
      }

      if (bSlider) bSlider.addEventListener("input", function () { v.b = +bSlider.value; paint(); });
      if (cSlider) cSlider.addEventListener("input", function () { v.c = +cSlider.value; paint(); });

      if (bar) {
        bar.addEventListener("click", function (e) {
          var t = e.target.closest("[data-z]");
          if (!t) return;
          var act = t.getAttribute("data-z");
          if (act === "in") zoomAt(1.25);
          if (act === "out") zoomAt(1 / 1.25);
          if (act === "reset") reset();
          if (act === "full") setFull(!shell.classList.contains("is-full"));
        });
      }

      /* drag to pan, wheel to zoom, two-finger pinch */
      frame.addEventListener("dragstart", function (e) { e.preventDefault(); });

      frame.addEventListener("pointerdown", function (e) {
        v.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        v.drag = true;
        frame.setPointerCapture && frame.setPointerCapture(e.pointerId);
        if (e.preventDefault) e.preventDefault();
      });
      frame.addEventListener("pointermove", function (e) {
        var p = v.pointers[e.pointerId];
        if (!p) return;
        var ids = Object.keys(v.pointers);
        if (ids.length === 2) {
          var other = v.pointers[ids[0] === String(e.pointerId) ? ids[1] : ids[0]];
          var before = Math.hypot(p.x - other.x, p.y - other.y);
          p.x = e.clientX; p.y = e.clientY;
          var after = Math.hypot(p.x - other.x, p.y - other.y);
          if (before > 8 && after > 8) zoomAt(after / before);
          return;
        }
        var dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        v.x += dx; v.y += dy;
        paint();
      });
      ["pointerup", "pointercancel"].forEach(function (ev) {
        frame.addEventListener(ev, function (e) { delete v.pointers[e.pointerId]; v.drag = false; });
      });
      frame.addEventListener("pointerleave", function (e) {
        if (!v.drag) delete v.pointers[e.pointerId];
      });
      frame.addEventListener("wheel", function (e) {
        if (Math.abs(e.deltaY) < 1) return;
        e.preventDefault();
        zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12);
      }, { passive: false });

      frame.setAttribute("tabindex", "0");
      frame.addEventListener("keydown", function (e) {
        var step = 18;
        if (e.key === "+" || e.key === "=") { zoomAt(1.2); e.preventDefault(); }
        else if (e.key === "-" || e.key === "_") { zoomAt(1 / 1.2); e.preventDefault(); }
        else if (e.key === "0") { reset(); e.preventDefault(); }
        else if (e.key === "ArrowLeft") { v.x += step; paint(); e.preventDefault(); }
        else if (e.key === "ArrowRight") { v.x -= step; paint(); e.preventDefault(); }
        else if (e.key === "ArrowUp") { v.y += step; paint(); e.preventDefault(); }
        else if (e.key === "ArrowDown") { v.y -= step; paint(); e.preventDefault(); }
      });

      /* reset the view when the image behind it changes */
      var lastSrc = img.getAttribute("src");
      window.setInterval(function () {
        var now = img.getAttribute("src");
        if (now !== lastSrc) { lastSrc = now; reset(); }
      }, 400);

      paint();
      return v;
    }

    var plate = document.querySelector("[data-win]");
    if (plate) WINDOWS.push(makeViewer(plate.querySelector(".plate__img"), plate.querySelector(".plate__frame"), plate.querySelector(".win__bar")));

    qsa(".win__bar[data-win-for]").forEach(function (bar) {
      var img = document.getElementById(bar.getAttribute("data-win-for"));
      var stage = img && img.closest(".viewer__stage");
      if (img && stage) WINDOWS.push(makeViewer(img, stage, bar));
    });

    WINDOWS = WINDOWS.filter(Boolean);
  }

  /* ---------------------------------------------------------------- priming chips */
  function wireChips() {
    var box = document.getElementById("primeChips");
    if (!box) return;
    box.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      chip.classList.toggle("is-on");
      chip.setAttribute("aria-pressed", chip.classList.contains("is-on") ? "true" : "false");
      var on = box.querySelectorAll(".chip.is-on").length;
      announce(on === 3
        ? "All three parts of the preparation rehearsed."
        : on + " of 3 parts of the preparation rehearsed.");
    });
  }

  /* ---------------------------------------------------------------- init */
  window.addEventListener("error", function () {
    toast("info", "Continuing — a display element failed to load.", 2200);
  });

  renderFilm();
  initWindows();
  wireVideos();
  wireChips();
  wireGallery();
  wireSeeGallery();
  wireSpeedGallery();
  wireCine();
  wirePrimeFrame();
  show("attract");
}());
