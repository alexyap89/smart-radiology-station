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
  var ORDER = ["attract", "quiz", "pos", "neg", "lab", "see", "move", "speed", "two", "tools", "takeaway"];

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
        quiz: ["1", "RbFracture · the fracture copilot, on four emergency films"],
        pos:  ["1", "RbFracture · the case that went to CT"],
        neg:  ["1", "RbFracture · the case that stopped at CT"],
        lab:  ["2", "3D + 4D Lab · what the scan becomes"],
        see:  ["2", "3D + 4D Lab · the dose that buys the fourth dimension"],
        move: ["2", "3D + 4D Lab · the joint in motion"],
        speed:["3", "MRI acceleration · less time in the scanner"],
        two:  ["4", "pRIMe · the scan starts the night before"],
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

    if (name === "pos") startModel();
    if (name === "takeaway") {
      var answered = Object.keys(state.answered).length;
      var case1 = state.answered[0] === true && state.answered[1] === true;
      var case2 = state.answered[2] === true && state.answered[3] === true;
      var n = (case1 ? 1 : 0) + (case2 ? 1 : 0);
      var tk = document.getElementById("tkScore");
      if (tk && answered < 4) { tk.hidden = true; tk.textContent = ""; }
      else if (tk) {
        tk.hidden = false;
        tk.textContent = n === 2
          ? "Your calls matched the reporting radiologist on both cases."
          : "Your calls matched the reporting radiologist on " + n + " of 2 cases. The AI agreed with the radiologist in both.";
        tk.className = "verdict verdict--score" + (n === 2 ? " verdict--clear" : "");
      }
    }
    if (name !== "speed" && typeof pauseAcceleration === "function") pauseAcceleration();
    if (name !== "move") cineLeave();
    playVideos(name === "lab");
    primeLoad(name === "tools");
    if (name !== "takeaway") closeOverlay();
    resetIdle();
  }

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
    if (state.screen === "takeaway" || !overlay.hidden) return;
    idleTimer = window.setTimeout(function () {
      if (state.screen === "takeaway" || !overlay.hidden) return;
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
      img: "assets/cases/pos-film-ap.png", ai: "assets/cases/pos-ai-ap.png",
      cap: "Case 1 · right knee · AP", step: "Film 1 of 4", truth: "yes",
      pimg: "assets/img/patient-a.jpg",
      palt: "The patient: a man in his seventies in a hospital bed, right knee bandaged.",
      pmeta: "<b>Patient A</b> · cannot put weight on it · right knee",
      verdict: "Fracture detected.",
      comment: "RbFracture marked a lucent line across the lateral tibial plateau. The reporting radiologist agreed. Two independent reads, same answer.",
      nextLabel: "View the lateral film"
    },
    {
      title: "Same man, lateral view. The joint is swollen.",
      img: "assets/cases/pos-film-lat.png", ai: "assets/cases/pos-ai-lat.png",
      cap: "Case 1 · right knee · lateral", step: "Film 2 of 4", truth: "yes",
      pimg: "assets/img/patient-a.jpg",
      palt: "The patient: a man in his seventies in a hospital bed, right knee bandaged.",
      pmeta: "<b>Patient A</b> · cannot put weight on it · right knee",
      verdict: "Fracture, effusion and lipohaemarthrosis detected.",
      comment: "On the lateral view the AI also marks the effusion and a fat–blood level. In a knee that cannot bear weight, that is an intra-articular fracture until proven otherwise.",
      nextLabel: "Next case · a different knee"
    },
    {
      title: "Patient B fell too, but she could walk it off. This is her knee.",
      img: "assets/cases/neg-film-ap.png", ai: "assets/cases/neg-ai-ap.png",
      cap: "Case 2 · left knee · AP", step: "Film 3 of 4", truth: "no",
      pimg: "assets/img/patient-b.jpg",
      palt: "The patient: an elderly woman, awake and alert, phone in hand.",
      pmeta: "<b>Patient B</b> · walked in on it · left knee · no fracture",
      verdict: "No fracture detected.",
      comment: "Nothing flagged. The radiologist agreed: degenerative change, no acute fracture line.",
      nextLabel: "View the lateral film"
    },
    {
      title: "Patient B, lateral view. She walked in, but the pain has not settled.",
      img: "assets/cases/neg-film-lat.png", ai: "assets/cases/neg-ai-lat.png",
      cap: "Case 2 · left knee · lateral", step: "Film 4 of 4", truth: "no",
      pimg: "assets/img/patient-b.jpg",
      palt: "The patient: an elderly woman, awake and alert, phone in hand.",
      pmeta: "<b>Patient B</b> · walked in on it · left knee · no fracture",
      verdict: "No fracture detected. An effusion is.",
      comment: "Still no fracture — but the AI does mark an effusion, and it is right. A knee that cannot bear weight with fluid in it needs the next test, not a second opinion on the same film.",
      nextLabel: "See what the scans showed"
    }
  ];

  function renderFilm() {
    var f = FILMS[state.qIndex];
    var qImg = qs("#qImg");
    qImg.src = f.img;
    fitFrame(qImg);

    var pImg = qs("#qPatientImg");
    var pMeta = qs("#qPatientMeta");
    if (pImg && f.pimg) { pImg.src = f.pimg; pImg.alt = f.palt || ""; }
    if (pMeta && f.pmeta) { pMeta.innerHTML = f.pmeta; }
    qs("#qImg").alt = "De-identified knee radiograph, " + f.cap;
    qs("#qCap").textContent = f.cap;
    qs("#qStep").textContent = "1 · RbFracture · film " + (state.qIndex + 1) + " of 4";
    var title = document.getElementById("quiz-title");
    if (title && f.title) title.textContent = f.title;
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
    qs("#qReveal").classList.remove("is-in");
    void qs("#qReveal").offsetWidth;
    qs("#qReveal").classList.add("is-in");

    toast(right ? "right" : "wrong", right ? "Correct." : "Not this one.");
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
    var case1 = state.answered[0] === true && state.answered[1] === true;
    var case2 = state.answered[2] === true && state.answered[3] === true;
    var cases = (case1 ? 1 : 0) + (case2 ? 1 : 0);
    qs("#qScoreN").textContent = cases;
    qs("#qScoreN").className = cases === 2 ? "verdict--clear" : "";
  }

  /* ---------------------------------------------------------------- image tabs */
  var VIEWS = {
    ct:     { src: "assets/cases/pos-ct-coronal.png", cap: "Coronal bone window. A split fracture runs through the lateral tibial plateau." },
    bme:    { src: "assets/cases/pos-bme-fusion.png", cap: "Dual-energy fusion: the marrow oedema map. The bruise inside the bone, invisible on plain CT." },
    bmeneg: { src: "assets/cases/neg-bme-fusion.png", cap: "Dual-energy fusion: no marrow oedema. Nothing for the spectral map to flag." },
    sag:    { src: "assets/cases/neg-sag.png", cap: "Sagittal reformat: joint-space narrowing and osteophytes. Degenerative, not acute." }
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
  var mv = { yaw: -0.55, pitch: 0.18, dist: 1.35, drag: null, last: 0, spin: true };

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

    var ctx = canvas.getContext("webgl", { antialias: true, alpha: true, preserveDrawingBuffer: false });
    if (!ctx) { if (fallback) fallback.hidden = false; canvas.style.display = "none"; return; }
    var ext32 = ctx.getExtension("OES_element_index_uint");

    function shader(type, src) {
      var s = ctx.createShader(type);
      ctx.shaderSource(s, src); ctx.compileShader(s);
      return s;
    }
    var prog = ctx.createProgram();
    ctx.attachShader(prog, shader(ctx.VERTEX_SHADER, VS));
    ctx.attachShader(prog, shader(ctx.FRAGMENT_SHADER, FS));
    ctx.linkProgram(prog);
    ctx.useProgram(prog);

    var data = decodeMesh(mesh);
    var use32 = !(data.idx instanceof Uint16Array);
    if (use32 && !ext32) {
      // 32-bit indices unsupported: show the message rather than a blank canvas
      if (fallback) { fallback.hidden = false; }
      canvas.style.display = "none";
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
      mv.yaw -= (e.clientX - mv.drag.x) * 0.01;
      mv.pitch -= (e.clientY - mv.drag.y) * 0.01;
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
      mv.yaw = -0.55; mv.pitch = 0.18; mv.dist = 1.35; mv.spin = true;
    });
  }

  /* ---------------------------------------------------------------- media */
  function playVideos(on) {
    qsa(".vid video").forEach(function (v) {
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
      v.addEventListener("pointerleave", function () { if (v.pause) v.pause(); });
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

  /* ---------------------------------------------------------------- see: the dose ladder */
  // The rungs and the noise gate are the department's own pre-committed rules.
  // The curve below models that rule; it is not measured patient data, and the
  // screen says so in .dose__fine.
  var DOSE_GATE = 115;        // per cent of baseline noise, the QI plan's pass line
  var DOSE_TF = 0.0014;       // reconstruction-level compensation applied per per-cent of dose removed

  function doseNoisePct(r) {
    return 100 / Math.sqrt(1 - r / 100) * (1 - DOSE_TF * r);
  }

  function doseNodes() {
    return {
      root: document.getElementById("doseLadder"),
      range: document.getElementById("doseRange"),
      ctdi: document.getElementById("doseCtdi"),
      noise: document.getElementById("doseNoise"),
      gate: document.getElementById("doseGate"),
      out: document.getElementById("doseOut"),
      rungs: qsa(".dose__rung")
    };
  }

  function doseCopy(r) {
    if (r === 0) return "Baseline. Nothing has moved yet.";
    if (r > 0 && r <= 20) return "Tier 1 \u00b7 \u221220% CTDIvol. The gate wants median CTDIvol at or below 80% of baseline with image noise at or below 115%, assessed over 30 cases before the next rung opens.";
    if (r > 20 && r < 30) return "The ladder only moves in committed steps: \u221220%, then \u221230%. There is no rung at \u2212" + r + "%.";
    if (r === 30) return "Tier 2 \u00b7 \u221230% cumulative. The same noise gate, the same 30-case assessment. This is where the default ladder stops unless the margin is wide.";
    if (r > 30 && r < 40) return "No rung between \u221230% and the ceiling. The ladder is stepped on purpose.";
    return "The ceiling. Noise breaches the 115% gate here. Reconstruction reduces noise; it cannot create information, so the quality floor wins and the dose goes back up.";
  }

  function paintDose(r) {
    var n = doseNodes();
    if (!n.root) return;
    var noise = doseNoisePct(r);
    var pass = noise <= DOSE_GATE;
    var onRung = r === 0 || r === 20 || r === 30 || r === 40;
    var tier = r === 0 ? "t0" : (r < 30 ? "t1" : (r < 40 ? "t2" : "fail"));
    var gate = r === 0 ? "baseline" : (!onRung ? "no rung here" : (pass ? "passes" : "fails"));

    if (n.ctdi) n.ctdi.textContent = (100 - r) + "%";
    if (n.noise) n.noise.textContent = Math.round(noise) + "%";
    if (n.gate) n.gate.textContent = gate;
    if (n.out) n.out.textContent = doseCopy(r);
    n.root.setAttribute("data-tier", tier);

    n.rungs.forEach(function (el) {
      var at = Number(el.getAttribute("data-rung"));
      el.classList.toggle("is-on", r >= at && doseNoisePct(at) <= DOSE_GATE);
    });
  }

  function resetDose() {
    var n = doseNodes();
    if (n.range) n.range.value = "0";
    paintDose(0);
  }

  function wireDose() {
    var n = doseNodes();
    if (!n.range) return;
    n.range.addEventListener("input", function () { paintDose(Number(n.range.value) || 0); });
    paintDose(Number(n.range.value) || 0);
  }

  /* ---------------------------------------------------------------- lab: the render gallery */
  var LAB_CASES = {
    foot: {
      src: "assets/cine/foot.jpg",
      cap: "Charcot arthropathy. The talar dome is articulating with the midfoot instead of the tibia, and a large effusion has displaced the ankle tendons.",
      alt: "Cinematic rendering of a Charcot foot: the talar dome articulating with the midfoot instead of the tibia."
    },
    scapula: {
      src: "assets/cine/scapula.jpg",
      cap: "Traumatic structural isolation of the scapula, with a comminuted scapular fracture and a displaced clavicle.",
      alt: "Cinematic rendering of a fractured scapula with a displaced clavicle and rib fractures."
    },
    ribs: {
      src: "assets/cine/ribs.jpg",
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
    shoulder: { cap: "Shoulder. Volume render through the arc, with surgical clips and vessels in view." }
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
    resetAcceleration();
    resetDose();
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

      var bSlider = bar && bar.querySelector('[data-w="b"]');
      var cSlider = bar && bar.querySelector('[data-w="c"]');
      var zLabel = bar && bar.querySelector("[data-zval]");

      function clampPan() {
        var w = frame.clientWidth, h = frame.clientHeight;
        var maxX = Math.max(0, (v.z - 1) * w / 2);
        var maxY = Math.max(0, (v.z - 1) * h / 2);
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
        });
      }

      /* drag to pan, wheel to zoom, two-finger pinch */
      frame.addEventListener("pointerdown", function (e) {
        v.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        frame.setPointerCapture && frame.setPointerCapture(e.pointerId);
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
        if (v.z > 1) { v.x += dx; v.y += dy; paint(); }
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
        frame.addEventListener(ev, function (e) { delete v.pointers[e.pointerId]; });
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

  /* ---------------------------------------------------------------- acceleration simulator */
  var accel = { raf: 0, watchdog: 0, elapsed: 0, last: 0, ticks: 0, running: false, done: false, nodes: null, timed: false };

  function accelNodes() {
    if (accel.nodes) return accel.nodes;
    var sim = document.getElementById("scanSim");
    if (!sim) return null;
    accel.nodes = {
      sim: sim,
      stdFill: sim.querySelector('[data-lane="std"] .sim__fill'),
      fastFill: sim.querySelector('[data-lane="fast"] .sim__fill'),
      stdVal: sim.querySelector('[data-val="std"]'),
      fastVal: sim.querySelector('[data-val="fast"]'),
      bore: sim.querySelector(".sim__borefill"),
      play: sim.querySelector('[data-sim="play"]'),
      reset: sim.querySelector('[data-sim="reset"]'),
      out: document.getElementById("simOut")
    };
    return accel.nodes;
  }

  function paintAccel(progress) {
    var n = accelNodes();
    if (!n) return;
    var std = Math.round(progress * 100);
    var fast = Math.round(progress * 63);
    if (n.stdFill) n.stdFill.style.width = std + "%";
    if (n.fastFill) n.fastFill.style.width = fast + "%";
    if (n.stdVal) n.stdVal.textContent = std + "%";
    if (n.fastVal) n.fastVal.textContent = fast + "%";
    if (n.bore) n.bore.style.width = std + "%";
  }

  function accelCopy(state) {
    var n = accelNodes();
    if (!n || !n.out) return;
    n.out.textContent = state === "running"
      ? "Running — the standard scan is still going."
      : state === "done"
        ? "Fast scan finished at 63%. Standard scan continues — about a third more time inside the bore."
        : "Not started.";
  }

  function accelFinish() {
    var n = accelNodes();
    accel.running = false;
    accel.done = true;
    accel.elapsed = 6000;
    cancelAnimationFrame(accel.raf);
    window.clearTimeout(accel.watchdog);
    paintAccel(1);
    if (n) {
      n.sim.setAttribute("data-state", "done");
      if (n.play) n.play.textContent = "Run again";
      if (n.bore) n.bore.classList.add("is-done");
    }
    accelCopy("done");
  }

  function accelStep() {
    accel.ticks += 1;
    var now = performance.now();
    if (!accel.last) accel.last = now;
    accel.elapsed += Math.min(160, now - accel.last);
    accel.last = now;
    if (accel.elapsed >= 6000) { accelFinish(); return; }
    paintAccel(accel.elapsed / 6000);
    accel.watchdog = window.setTimeout(accelStep, 50);
  }

  function accelStart() {
    // timer-driven, so the run completes even when the browser throttles frames
    // (background tab, kiosk sleep): progress comes from wall-clock time, not frames
    accel.last = 0;
    accel.ticks = 0;
    accel.watchdog = window.setTimeout(accelStep, 50);
  }

  function accelPlay() {
    var n = accelNodes();
    if (!n) return;
    if (accel.done) resetAcceleration();
    if (accel.running) {
      accel.running = false;
      cancelAnimationFrame(accel.raf);
      window.clearTimeout(accel.watchdog);
      if (n.play) n.play.textContent = "Continue";
      accelCopy("idle");
      return;
    }
    accel.running = true;
    accel.last = 0;
    if (n.sim) n.sim.setAttribute("data-state", "running");
    if (n.play) n.play.textContent = "Pause";
    accelCopy("running");

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { accelFinish(); return; }
    accelStart();
  }

  function resetAcceleration() {
    var n = accelNodes();
    accel.running = false;
    accel.done = false;
    accel.elapsed = 0;
    accel.last = 0;
    accel.timed = false;
    cancelAnimationFrame(accel.raf);
    window.clearTimeout(accel.watchdog);
    if (!n) return;
    if (n.stdFill) n.stdFill.style.width = "0%";
    if (n.fastFill) n.fastFill.style.width = "0%";
    if (n.stdVal) n.stdVal.textContent = "0%";
    if (n.fastVal) n.fastVal.textContent = "0%";
    if (n.bore) { n.bore.style.width = "0%"; n.bore.classList.remove("is-done"); }
    if (n.play) n.play.textContent = "Run the scan";
    if (n.sim) n.sim.setAttribute("data-state", "idle");
    accelCopy("idle");
  }

  function pauseAcceleration() {
    if (!accel.running) return;
    var n = accelNodes();
    accel.running = false;
    cancelAnimationFrame(accel.raf);
    window.clearTimeout(accel.watchdog);
    if (n) {
      if (n.play) n.play.textContent = "Continue";
      if (n.sim) n.sim.setAttribute("data-state", "idle");
    }
  }

  function wireAcceleration() {
    var n = accelNodes();
    if (!n) return;
    if (n.play) n.play.addEventListener("click", accelPlay);
    if (n.reset) n.reset.addEventListener("click", resetAcceleration);
    paintAccel(0);
    accelCopy("idle");
  }

  /* ---------------------------------------------------------------- init */
  window.addEventListener("error", function () {
    toast("info", "Continuing — a display element failed to load.", 2200);
  });

  renderFilm();
  initWindows();
  wireVideos();
  wireChips();
  wireAcceleration();
  wireDose();
  wireGallery();
  wireCine();
  wirePrimeFrame();
  show("attract");
}());
