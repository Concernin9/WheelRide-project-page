/* WheelRide project page: the ink hero, the two animated decisions, the ride replay, counters and clips.
   No libraries. Data come from static/data/*.js (window.WR), so the page also opens straight from disk. */
(function () {
  'use strict';
  var WR = window.WR || {};
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COL = { ink: '#2a2738', ink2: '#4b4860', violet: '#5E4BDD', violetD: '#3C2DAD', violetL: '#CDC6F8',
              amber: '#D29A30', amberD: '#8A5E12', teal: '#4FA596', g5: '#77748a', g3: '#d9d7e2', cand: '#c4c2cf' };
  var LINE = { 7: '#7d72cf', 5: '#a39be2', 3: '#c9c3f0', 1: '#aeaac0', 2: '#b9ddd6', 4: '#8cc3b9', 6: '#5f9f95' };
  var LINE_D = { 7: '#5a4fb8', 5: '#7d72cf', 3: '#9c93df', 1: '#8a879c', 2: '#7dbcb0', 4: '#5ea597', 6: '#3f8075' };
  var MONO = "'JetBrains Mono', Menlo, Consolas, monospace";
  var SANS = "Inter, 'Helvetica Neue', Arial, sans-serif";

  // ---------------------------------------------------------------- helpers
  function fit(cv) {
    var dpr = Math.min(2, window.devicePixelRatio || 1), r = cv.getBoundingClientRect();
    cv.width = Math.max(10, Math.round(r.width * dpr)); cv.height = Math.max(10, Math.round(r.height * dpr));
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, W: r.width, H: r.height };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(t) { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function visible(el, cb, th) {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    new IntersectionObserver(function (es) { es.forEach(function (e) { cb(e.isIntersecting); }); }, { threshold: th || 0.15 }).observe(el);
  }
  function cloudShade(c, cmax) {             // light to darker grey by log hits, as in the paper's clouds
    var t = clamp(Math.log(1 + c) / Math.log(1 + cmax), 0, 1);
    var r = Math.round(212 + (92 - 212) * t), g = Math.round(211 + (90 - 211) * t), b = Math.round(221 + (110 - 221) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function pct(arr, q) { var a = arr.slice().sort(function (x, y) { return x - y; }); return a[Math.floor(q * (a.length - 1))]; }
  // a polyline cut at fraction f of its length
  function partial(pts, f) {
    if (f >= 1) return pts;
    var L = [0], i; for (i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    var tgt = f * L[L.length - 1], out = [pts[0]];
    for (i = 1; i < pts.length; i++) {
      if (L[i] <= tgt) { out.push(pts[i]); continue; }
      var u = (tgt - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
      out.push([pts[i - 1][0] + u * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + u * (pts[i][1] - pts[i - 1][1])]); break;
    }
    return out;
  }
  function stroke(ctx, pts, col, w, dash, alpha) {
    if (!pts || pts.length < 2) return;
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke(); ctx.restore();
  }
  function label(ctx, s, x, y, o) {
    o = o || {};
    ctx.save(); ctx.font = (o.italic ? 'italic ' : '') + (o.bold ? '600 ' : '500 ') + (o.size || 13) + 'px ' + SANS;
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'middle'; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (o.minX != null) { var w = ctx.measureText(s).width, left = ctx.textAlign === 'right' ? x - w : (ctx.textAlign === 'center' ? x - w / 2 : x);
      if (left < o.minX) x += o.minX - left; }
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(244,243,247,0.95)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y);
    ctx.fillStyle = o.col || COL.ink; ctx.fillText(s, x, y); ctx.restore();
  }
  function chair(ctx, u, v, ang, s, col) {        // a small chair marker, heading ang (canvas radians, 0 = up)
    ctx.save(); ctx.translate(u, v); ctx.rotate(ang); ctx.fillStyle = col || COL.ink;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.72, s * 0.62); ctx.lineTo(0, s * 0.3); ctx.lineTo(-s * 0.72, s * 0.62); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function badge(ctx, u, v, k, col, a) {
    ctx.save(); ctx.globalAlpha = a == null ? 1 : a; ctx.beginPath(); ctx.arc(u, v, 8, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 1.3; ctx.strokeStyle = col; ctx.stroke(); ctx.fillStyle = COL.ink; ctx.font = '600 11px ' + SANS;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(k), u, v + 0.5); ctx.restore();
  }
  // ego frame (x forward, y left) to canvas, forward up
  function egoMap(W, H, xr, yr, pad) {
    pad = pad || 14;
    var s = Math.min((H - 2 * pad) / (xr[1] - xr[0]), (W - 2 * pad) / (yr[1] - yr[0]));
    var yc = (yr[0] + yr[1]) / 2, xc = (xr[0] + xr[1]) / 2;
    var f = function (x, y) { return [W / 2 - (y - yc) * s, H / 2 - (x - xc) * s]; };
    f.s = s; return f;
  }
  function animLoop(draw, dur, el) {               // runs draw(t) while visible, loops every dur seconds
    var t0 = null, on = false, raf = null;
    function frame(ts) { if (!on) return; if (t0 === null) t0 = ts; var t = (ts - t0) / 1000; if (t > dur) { t0 = ts; t = 0; } draw(t); raf = requestAnimationFrame(frame); }
    var api = { restart: function () { t0 = null; }, show: function (t) { draw(t); } };
    if (REDUCE) { draw(dur * 0.8); return api; }
    visible(el, function (v) { if (v && !on) { on = true; raf = requestAnimationFrame(frame); } else if (!v && on) { on = false; cancelAnimationFrame(raf); } }, 0.2);
    return api;
  }

  // ---------------------------------------------------------------- 1 the ink hero: the lobby-to-street ride as characters
  function asciiHero() {
    var cv = document.getElementById('ascii'); if (!cv || !WR.ride) return;
    var R = WR.ride, g, cols, rows, cw, ch, grid, cellsOn, delays, routeC, marksC, ramp = ' .:-=+*#%@';
    function build() {
      g = fit(cv);
      ch = g.W < 420 ? 8.5 : 10; cw = ch * 0.6;
      cols = Math.floor((g.W - 16) / cw); rows = Math.floor((g.H - 16) / ch);
      var xs = R.cells.map(function (c) { return c[0]; }), ys = R.cells.map(function (c) { return c[1]; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      var s = Math.min((cols * cw) / (x1 - x0), (rows * ch) / (y1 - y0));
      var ox = 8 + (g.W - 16 - (x1 - x0) * s) / 2, oy = 8 + (g.H - 16 - (y1 - y0) * s) / 2;
      var P = function (x, y) { return [ox + (x - x0) * s, oy + (y1 - y) * s]; };
      grid = new Float32Array(cols * rows);
      R.cells.forEach(function (c) {
        var p = P(c[0], c[1]), i = Math.floor(p[1] / ch), j = Math.floor(p[0] / cw);
        if (i >= 0 && i < rows && j >= 0 && j < cols) grid[i * cols + j] += Math.log(1 + c[2]);
      });
      var nz = []; for (var k = 0; k < grid.length; k++) if (grid[k] > 0) nz.push(grid[k]);
      var hi = pct(nz, 0.9) || 1;
      cellsOn = [];
      for (k = 0; k < grid.length; k++) if (grid[k] > 0) {
        var v = clamp(grid[k] / hi, 0, 1);
        cellsOn.push({ i: Math.floor(k / cols), j: k % cols, v: v, ch: ramp[1 + Math.min(8, Math.floor(v * 8.999))], d: Math.random() * 1.6 });
      }
      routeC = R.route.map(function (r) { var p = P(r[0], r[1]); return [p[0], p[1], r[2], r[3]]; });
      marksC = R.marks.map(function (m) { var p = P(m.x, m.y); return { u: p[0], v: p[1], t: m.t, n: m.n }; });
    }
    build();
    var DUR = 15.5, TRACE0 = 2.4, TRACE1 = 12.0, T_END = R.duration;
    function draw(t) {
      var ctx = g.ctx; ctx.clearRect(0, 0, g.W, g.H);
      var fade = 1 - seg(t, DUR - 0.8, DUR);
      ctx.font = '500 ' + ch + 'px ' + MONO; ctx.textBaseline = 'top';
      for (var n = 0; n < cellsOn.length; n++) {
        var c = cellsOn[n], a = (t - c.d) / 0.5;
        if (a <= 0) continue;
        var glyph = a < 1 ? ramp[1 + Math.floor(Math.random() * 9)] : c.ch;
        ctx.fillStyle = 'rgba(42,39,56,' + ((0.26 + 0.70 * c.v) * Math.min(1, a) * fade).toFixed(3) + ')';
        ctx.fillText(glyph, c.j * cw, c.i * ch);
      }
      // the chair's trail, in time with the ride
      var tr = seg(t, TRACE0, TRACE1) * T_END, k = 0;
      while (k < routeC.length - 1 && routeC[k + 1][3] <= tr) k++;
      if (t > TRACE0) {
        var pts = routeC.slice(0, k + 1);
        stroke(ctx, pts, COL.violet, 2.2, null, 0.9 * fade);
        marksC.forEach(function (m) {
          if (m.t > tr) return;
          ctx.save(); ctx.globalAlpha = fade; ctx.beginPath(); ctx.arc(m.u, m.v, 4.2, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
          ctx.lineWidth = 1.4; ctx.strokeStyle = COL.violetD; ctx.stroke(); ctx.restore();
        });
        var h = routeC[k];
        ctx.save(); ctx.globalAlpha = fade; ctx.beginPath(); ctx.arc(h[0], h[1], 11, 0, 7); ctx.fillStyle = 'rgba(94,75,221,0.14)'; ctx.fill(); ctx.restore();
        chair(ctx, h[0], h[1], Math.PI / 2 - h[2], 7, COL.violetD);
      }
      ctx.save(); ctx.globalAlpha = 0.9 * fade; ctx.font = '500 11px ' + MONO; ctx.fillStyle = COL.g5; ctx.textBaseline = 'alphabetic';
      ctx.fillText('t = ' + tr.toFixed(1) + ' s', 12, g.H - 12); ctx.textAlign = 'right';
      ctx.fillText(R.cells.length.toLocaleString('en-US') + ' LiDAR cells, 5 cm', g.W - 12, g.H - 12); ctx.restore();
    }
    var api = animLoop(draw, DUR, cv);
    window.addEventListener('resize', function () { build(); api.show(DUR * 0.8); });
  }

  // ---------------------------------------------------------------- 2 seeing is not deciding: the campus exit
  function decision() {
    var cv = document.getElementById('decision'); if (!cv || !WR.decision) return;
    var D = WR.decision, g, M, cells, lines, rider, goal, dl, dz, cmax;
    function build() {
      g = fit(cv);
      var xs = [], ys = [];
      D.lines.forEach(function (l) { l.xy.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
      D.rider_path.forEach(function (p) { if (p[0] < 13.5) { xs.push(p[0]); ys.push(p[1]); } });
      var xr = [-1.2, Math.max.apply(null, xs) + 1.2], yr = [Math.min.apply(null, ys) - 1.6, Math.max.apply(null, ys) + 1.6];
      var span = Math.max(xr[1] - xr[0], yr[1] - yr[0]);
      var yc = (yr[0] + yr[1]) / 2; yr = [yc - span / 2, yc + span / 2]; xr = [xr[1] - span, xr[1]];
      M = egoMap(g.W, g.H, xr, yr, 10);
      cmax = pct(D.cells.map(function (c) { return c[2]; }), 0.9);
      cells = D.cells.map(function (c) { var p = M(c[0], c[1]); return [p[0], p[1], cloudShade(c[2], cmax)]; });
      lines = D.lines.map(function (l) { return { k: l.k, open: l.open, pts: l.xy.map(function (p) { return M(p[0], p[1]); }) }; });
      rider = D.rider_path.filter(function (p) { return p[0] < 13.5; }).map(function (p) { return M(p[0], p[1]); });
      goal = M(D.goal[0], D.goal[1]);
      dl = D.driven_linepilot.map(function (p) { return M(p[0], p[1]); });
      dz = D.driven_zeroshot.map(function (p) { return M(p[0], p[1]); });
    }
    build();
    function lineOf(k) { for (var i = 0; i < lines.length; i++) if (lines[i].k === k) return lines[i]; }
    function at(k, frac) { var p = lineOf(k).pts; return p[Math.min(p.length - 1, Math.floor(frac * (p.length - 1)))]; }
    var DUR = 13;
    function draw(t) {
      var ctx = g.ctx; ctx.clearRect(0, 0, g.W, g.H);
      var fade = 1 - seg(t, DUR - 0.7, DUR), a0 = seg(t, 0, 0.8) * fade;
      ctx.globalAlpha = a0;
      cells.forEach(function (c) { ctx.fillStyle = c[2]; ctx.fillRect(c[0] - 0.9, c[1] - 0.9, 1.8, 1.8); });
      ctx.globalAlpha = 1;
      var order = [7, 5, 3, 1, 2, 4, 6];
      order.forEach(function (k, i) {
        var f = ease(seg(t, 0.6 + i * 0.18, 1.6 + i * 0.18)), l = lineOf(k);
        stroke(ctx, partial(l.pts, f), l.open ? COL.cand : '#e2e0e8', 1.2, l.open ? null : [3, 3], fade);
      });
      var gA = seg(t, 2.4, 2.9) * fade;
      if (gA > 0) {
        ctx.save(); ctx.globalAlpha = gA; ctx.beginPath(); ctx.arc(goal[0], goal[1], 5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.beginPath(); ctx.arc(goal[0], goal[1], 2, 0, 7); ctx.fillStyle = COL.ink; ctx.fill(); ctx.restore();
        label(ctx, 'goal, 12 m on', goal[0] + 10, goal[1] - 6, { col: COL.g5, size: 12, alpha: gA });
        label(ctx, 'the rider’s path', goal[0] + 10, goal[1] + 9, { col: COL.g5, size: 12, alpha: gA });
        var van = M(D.van[0], D.van[1]);
        ctx.save(); ctx.globalAlpha = gA; ctx.setLineDash([3, 3]); ctx.strokeStyle = COL.g5; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(van[0], van[1], 1.3 * M.s, 1.0 * M.s, 0, 0, 7); ctx.stroke(); ctx.restore();
        label(ctx, 'van', van[0] + 1.3 * M.s + 5, van[1], { col: COL.g5, size: 12, italic: true, alpha: gA });
      }
      var zA = ease(seg(t, 3.2, 4.4));
      if (zA > 0) {
        stroke(ctx, partial(lineOf(D.zeroshot).pts, zA), COL.amber, 3, null, fade);
        var p = at(D.zeroshot, 0.5), la = seg(t, 4.2, 4.7) * fade;
        label(ctx, '5 of 6 zero-shot', p[0] - 10, p[1] - 16, { col: COL.amberD, bold: true, align: 'right', alpha: la, minX: 8 });
        label(ctx, 'models: line ' + D.zeroshot, p[0] - 10, p[1], { col: COL.amberD, bold: true, align: 'right', alpha: la, minX: 8 });
        label(ctx, '“avoids the van”', p[0] - 10, p[1] + 16, { col: COL.amberD, italic: true, align: 'right', alpha: la, minX: 8 });
      }
      var lA = ease(seg(t, 5.0, 6.2));
      if (lA > 0) {
        stroke(ctx, partial(rider, lA), COL.ink, 1.4, [4, 3], fade);
        stroke(ctx, partial(lineOf(D.linepilot).pts, lA), COL.violet, 3.4, null, fade);
        var q = at(D.linepilot, 0.36), lb = seg(t, 6.0, 6.5) * fade;
        label(ctx, 'LinePilot: line ' + D.linepilot, q[0] + 12, q[1] - 7, { col: COL.violetD, bold: true, alpha: lb });
        label(ctx, 'as the rider', q[0] + 12, q[1] + 9, { col: COL.violetD, alpha: lb });
      }
      var dA = seg(t, 6.8, 8.8);
      if (dA > 0) {
        [[dz, COL.amberD], [dl, COL.violetD]].forEach(function (pc) {
          var n = Math.max(1, Math.round(dA * (pc[0].length - 1)));
          for (var i = 0; i <= n; i += 1) { ctx.save(); ctx.globalAlpha = fade; ctx.beginPath(); ctx.arc(pc[0][i][0], pc[0][i][1], 2.1, 0, 7); ctx.fillStyle = pc[1]; ctx.fill(); ctx.restore(); }
        });
        var e = dl[Math.max(1, Math.round(dA * (dl.length - 1)))];
        label(ctx, 'driven 3 s', e[0] + 8, e[1] + 2, { col: COL.ink2, size: 12, italic: true, alpha: seg(t, 8.4, 8.9) * fade });
      }
      var o = M(0, 0); chair(ctx, o[0], o[1], 0, 7, COL.ink);
    }
    var api = animLoop(draw, DUR, cv);
    hookReplay('decision', api);
    window.addEventListener('resize', function () { build(); api.show(DUR * 0.8); });
  }

  // ---------------------------------------------------------------- 3 choosing is not driving: the commandability fan
  function fan() {
    var cv = document.getElementById('fan'); if (!cv || !WR.fan) return;
    var F = WR.fan, g, M, cells, lines, paths, rider, cmax;
    function build() {
      g = fit(cv);
      var xr = [-0.9, 6.6], yr = [-3.8, 3.8];
      var ys = []; Object.keys(F.driven).forEach(function (k) { F.driven[k].forEach(function (p) { ys.push(p[1]); }); });
      var yc = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
      yr = [yc - 3.75, yc + 3.75];
      M = egoMap(g.W, g.H, xr, yr, 10);
      cmax = pct(F.cells.map(function (c) { return c[2]; }), 0.9);
      cells = F.cells.filter(function (c) { return c[0] < 7.2; }).map(function (c) { var p = M(c[0], c[1]); return [p[0], p[1], cloudShade(c[2], cmax)]; });
      lines = F.lines.map(function (l) { return { k: l.k, pts: l.xy.filter(function (p) { return p[0] < 7.4; }).map(function (p) { return M(p[0], p[1]); }) }; });
      paths = {}; Object.keys(F.driven).forEach(function (k) { paths[k] = F.driven[k].map(function (p) { return M(p[0], p[1]); }); });
      rider = F.rider_path.filter(function (p) { return p[0] < 7.2; }).map(function (p) { return M(p[0], p[1]); });
    }
    build();
    var DUR = 11;
    function draw(t) {
      var ctx = g.ctx; ctx.clearRect(0, 0, g.W, g.H);
      var fade = 1 - seg(t, DUR - 0.7, DUR);
      ctx.globalAlpha = seg(t, 0, 0.8) * fade;
      cells.forEach(function (c) { ctx.fillStyle = c[2]; ctx.fillRect(c[0] - 0.9, c[1] - 0.9, 1.8, 1.8); });
      ctx.globalAlpha = 1;
      lines.forEach(function (l, i) { stroke(ctx, partial(l.pts, ease(seg(t, 0.5 + i * 0.12, 1.6 + i * 0.12))), LINE[l.k], 1.4, null, 0.75 * fade); });
      stroke(ctx, partial(rider, ease(seg(t, 1.6, 2.6))), COL.ink, 1.2, [4, 3], 0.8 * fade);
      var gA = seg(t, 2.6, 5.8);
      if (gA > 0) {
        Object.keys(paths).forEach(function (k) {
          var p = paths[k], n = Math.max(1, Math.round(gA * (p.length - 1)));
          var part = p.slice(0, n + 1);
          stroke(ctx, part, LINE_D[k], 2.4, null, fade);
          ctx.save(); ctx.globalAlpha = fade; ctx.beginPath(); ctx.arc(part[part.length - 1][0], part[part.length - 1][1], 3.2, 0, 7); ctx.fillStyle = LINE_D[k]; ctx.fill(); ctx.restore();
        });
      }
      var bA = seg(t, 5.8, 6.4) * fade;
      if (bA > 0) {
        var ends = Object.keys(paths).map(function (k) { var p = paths[k]; return { u: p[p.length - 1][0], v: p[p.length - 1][1], k: k }; });
        ends.sort(function (a, b) { return a.u - b.u; });
        var groups = [];
        ends.forEach(function (e) {
          var gq = groups[groups.length - 1];
          if (gq && Math.hypot(e.u - gq[gq.length - 1].u, e.v - gq[gq.length - 1].v) < 20) gq.push(e); else groups.push([e]);
        });
        groups.forEach(function (gq) {
          var mu = gq.reduce(function (a, e) { return a + e.u; }, 0) / gq.length, mv = Math.min.apply(null, gq.map(function (e) { return e.v; }));
          gq.forEach(function (e, i) {
            var u = mu + (i - (gq.length - 1) / 2) * 18, v = mv - 18;
            if (gq.length > 1) stroke(ctx, [[e.u, e.v], [u, v + 8]], LINE_D[e.k], 0.8, null, 0.6 * bA);
            badge(ctx, u, v, e.k, LINE_D[e.k], bA);
          });
        });
        label(ctx, F.slope.toFixed(2) + ' m sideways per metre of shift', g.W / 2, g.H - 22, { col: COL.ink, bold: true, align: 'center', alpha: bA });
        label(ctx, 'seven lines, the same 3.2 s of logged frames', g.W / 2, g.H - 6 - 0, { col: COL.g5, size: 12, align: 'center', alpha: bA });
      }
      var o = M(0, 0); chair(ctx, o[0], o[1], 0, 7, COL.ink);
      label(ctx, '← left', 12, 16, { col: COL.g5, size: 12, alpha: fade });
      label(ctx, 'right →', g.W - 12, 16, { col: COL.g5, size: 12, align: 'right', alpha: fade });
    }
    var api = animLoop(draw, DUR, cv);
    hookReplay('fan', api);
    window.addEventListener('resize', function () { build(); api.show(DUR * 0.8); });
  }

  function hookReplay(id, api) {
    var b = document.querySelector('.replay[data-target="' + id + '"]');
    if (b) b.addEventListener('click', function () { api.restart(); });
  }

  // ---------------------------------------------------------------- 4 the ride, replayed with its decisions and frames
  function rideReplay() {
    var cv = document.getElementById('ridemap'); if (!cv || !WR.ride) return;
    var R = WR.ride, img = document.getElementById('ridecam'), note = document.getElementById('camnote');
    var out = document.getElementById('readout'), btn = document.getElementById('rideplay'), scrub = document.getElementById('ridescrub');
    var tlab = document.getElementById('ridetime');
    var g, P, bg, routeC, marksC, cmax, T = 0, playing = true, last = null, onScreen = false, curSrc = null, holdUntil = 0;
    scrub.max = R.duration.toFixed(1);
    function build() {
      g = fit(cv);
      var xs = R.cells.map(function (c) { return c[0]; }).concat(R.route.map(function (r) { return r[0]; }));
      var ys = R.cells.map(function (c) { return c[1]; }).concat(R.route.map(function (r) { return r[1]; }));
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      var pad = 14, s = Math.min((g.W - 2 * pad) / (x1 - x0), (g.H - 2 * pad) / (y1 - y0));
      var ox = (g.W - (x1 - x0) * s) / 2, oy = (g.H - (y1 - y0) * s) / 2;
      P = function (x, y) { return [ox + (x - x0) * s, oy + (y1 - y) * s]; }; P.s = s;
      cmax = pct(R.cells.map(function (c) { return c[2]; }), 0.9);
      bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
      var b = bg.getContext('2d'), dpr = cv.width / g.W; b.setTransform(dpr, 0, 0, dpr, 0, 0);
      R.cells.forEach(function (c) { var p = P(c[0], c[1]); b.fillStyle = cloudShade(c[2], cmax); b.fillRect(p[0] - 0.8, p[1] - 0.8, 1.6, 1.6); });
      routeC = R.route.map(function (r) { var p = P(r[0], r[1]); return [p[0], p[1], r[2], r[3]]; });
      stroke(b, routeC, '#bdbacb', 1.2, [2, 3]);
      marksC = R.marks.map(function (m) {
        return { m: m, u: P(m.x, m.y), lines: m.lines.map(function (l) { return { k: l.k, open: l.open, pts: l.xy.map(function (p) { return P(p[0], p[1]); }) }; }) };
      });
    }
    build();
    // preload the frames once the replay is on screen
    var loaded = false;
    function preload() { if (loaded) return; loaded = true; R.marks.forEach(function (m) { if (m.sprite) { var i = new Image(); i.src = m.sprite.src; } }); }
    function showFrame(m, i) {
      var sp = m.sprite, c = i % sp.cols, r = Math.floor(i / sp.cols);
      img.style.backgroundImage = 'url(' + sp.src + ')';
      img.style.backgroundSize = (sp.cols * 100) + '% ' + (sp.rows * 100) + '%';
      img.style.backgroundPosition = (sp.cols > 1 ? c / (sp.cols - 1) * 100 : 0) + '% ' + (sp.rows > 1 ? r / (sp.rows - 1) * 100 : 0) + '%';
    }
    function activeMark(t) {
      for (var i = 0; i < marksC.length; i++) { var m = marksC[i].m; if (t >= m.t - 2.0 && t <= m.t + 3.0) return marksC[i]; }
      return null;
    }
    function draw() {
      var ctx = g.ctx; ctx.clearRect(0, 0, g.W, g.H); ctx.drawImage(bg, 0, 0, g.W, g.H);
      var k = 0; while (k < routeC.length - 1 && routeC[k + 1][3] <= T) k++;
      stroke(ctx, routeC.slice(0, k + 1), COL.violet, 2.4);
      var A = activeMark(T);
      marksC.forEach(function (mc) {
        var done = mc.m.t <= T, act = A === mc;
        ctx.beginPath(); ctx.arc(mc.u[0], mc.u[1], act ? 9 : 7.5, 0, 7); ctx.fillStyle = act ? COL.violet : '#fff'; ctx.fill();
        ctx.lineWidth = 1.3; ctx.strokeStyle = done ? COL.violetD : '#a9a6b8'; ctx.stroke();
        ctx.fillStyle = act ? '#fff' : (done ? COL.violetD : COL.g5); ctx.font = '600 10.5px ' + SANS; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(mc.m.n), mc.u[0], mc.u[1] + 0.5);
      });
      if (A) {
        var a = Math.min(1, (T - (A.m.t - 2.0)) / 0.6, ((A.m.t + 3.0) - T) / 0.6);
        A.lines.forEach(function (l) { stroke(ctx, l.pts, l.open ? LINE_D[l.k] : '#cfcdd8', 1.3, l.open ? null : [3, 3], 0.85 * a); });
        if (A.m.speed === 'go') {
          var tl = A.lines.filter(function (l) { return l.k === A.m.truth; })[0];
          if (tl) stroke(ctx, tl.pts, COL.ink, 2.6, null, a);
        }
      }
      var h = routeC[k];
      ctx.beginPath(); ctx.arc(h[0], h[1], 12, 0, 7); ctx.fillStyle = 'rgba(94,75,221,0.15)'; ctx.fill();
      chair(ctx, h[0], h[1], Math.PI / 2 - h[2], 7.5, COL.violetD);
      // scale bar
      ctx.strokeStyle = COL.ink2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(14, g.H - 14); ctx.lineTo(14 + 5 * P.s, g.H - 14); ctx.stroke();
      ctx.fillStyle = COL.ink2; ctx.font = '500 11px ' + SANS; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('5 m', 14, g.H - 19);
      // camera and readout
      var fr = null;
      if (A && A.m.frames.length) {
        var best = 1e9; A.m.frames.forEach(function (f) { var d = Math.abs(f.t - T); if (d < best) { best = d; fr = f; } });
      }
      if (fr) { var key = A.m.n + ':' + fr.i; if (curSrc !== key) { showFrame(A.m, fr.i); curSrc = key; } img.classList.remove('dim'); note.style.display = 'none'; }
      else { img.classList.add('dim'); note.style.display = 'block'; if (!curSrc) { showFrame(R.marks[1], 0); curSrc = 'init'; } }
      if (A) {
        var where = A.m.n <= 4 ? 'inside the lobby' : 'outside';
        var what = A.m.speed === 'stop' ? 'the rider <b>stops</b>' : 'the rider takes <b>line ' + A.m.truth + '</b>';
        var open = A.m.lines.filter(function (l) { return l.open; }).length;
        out.innerHTML = '<b>Decision ' + A.m.n + ' of ' + R.marks.length + '</b>, ' + where + '. ' + open + ' of 7 lines open, ' + what + '.' +
          (A.m.frames.length ? '' : ' <span class="small">(no frames shown for this one)</span>');
      } else {
        out.innerHTML = 'A ride in ' + R.city + ', ' + R.what + '. <span class="small">' + R.distance.toFixed(1) + ' m in ' + R.duration.toFixed(0) + ' s.</span>';
      }
      tlab.textContent = T.toFixed(1) + ' s';
      if (document.activeElement !== scrub) scrub.value = T.toFixed(1);
    }
    function tick(ts) {
      if (!onScreen) { last = null; return; }
      if (last === null) last = ts;
      var dt = Math.min(0.1, (ts - last) / 1000); last = ts;
      if (playing && ts > holdUntil) {
        var A = activeMark(T), speed = (A && A.m.frames.length) ? 1.0 : (A ? 2.0 : 5.0);
        T += dt * speed;
        if (T >= R.duration) { T = 0; holdUntil = ts + 1200; }
      }
      draw();
      requestAnimationFrame(tick);
    }
    btn.addEventListener('click', function () { playing = !playing; btn.innerHTML = playing ? '&#10074;&#10074;' : '&#9654;'; });
    scrub.addEventListener('input', function () { T = parseFloat(scrub.value); playing = false; btn.innerHTML = '&#9654;'; draw(); });
    if (REDUCE) { playing = false; btn.innerHTML = '&#9654;'; T = R.marks[4].t; }
    visible(cv, function (v) { if (v) { preload(); if (!onScreen) { onScreen = true; requestAnimationFrame(tick); } } else onScreen = false; }, 0.1);
    draw();
    window.addEventListener('resize', function () { build(); draw(); });
  }

  // ---------------------------------------------------------------- 5 counters, clips, lightbox, reveal, nav
  function counters() {
    var box = document.getElementById('stats'); if (!box) return;
    var done = false;
    visible(box, function (v) {
      if (!v || done) return; done = true;
      box.querySelectorAll('.v').forEach(function (el) {
        var to = parseFloat(el.dataset.to), dec = parseInt(el.dataset.dec || '0', 10), suf = el.dataset.suf || '', sep = el.dataset.sep;
        var t0 = null, D = REDUCE ? 1 : 1400;
        function fmt(x) { var s = x.toFixed(dec); if (sep) s = Number(s).toLocaleString('en-US'); return s + suf; }
        function f(ts) { if (t0 === null) t0 = ts; var u = Math.min(1, (ts - t0) / D); el.textContent = fmt(to * (1 - Math.pow(1 - u, 3))); if (u < 1) requestAnimationFrame(f); }
        requestAnimationFrame(f);
      });
    }, 0.3);
  }
  function clips() {
    var box = document.getElementById('clips'); if (!box || !WR.clips) return;
    WR.clips.forEach(function (c) {
      var fig = document.createElement('figure'); fig.className = 'clip';
      var v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', '');
      v.preload = 'none'; v.poster = c.poster; v.dataset.src = c.src;
      var cap = document.createElement('figcaption');
      var cls = c.setting.indexOf('door') >= 0 ? 'doorway' : c.setting;
      cap.innerHTML = '<span class="chip ' + cls + '">' + c.setting + '</span><span>' + c.place + '</span>';
      fig.appendChild(v); fig.appendChild(cap); box.appendChild(fig);
      visible(v, function (on) {
        if (on) { if (!v.src) v.src = v.dataset.src; if (!REDUCE) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } }
        else if (!v.paused) v.pause();
      }, 0.3);
    });
  }
  function lightbox() {
    var lb = document.getElementById('lightbox'), im = lb.querySelector('img');
    document.querySelectorAll('.zoomable img').forEach(function (i) {
      i.addEventListener('click', function () { im.src = i.src; im.alt = i.alt; lb.classList.add('on'); lb.setAttribute('aria-hidden', 'false'); });
    });
    lb.addEventListener('click', function () { lb.classList.remove('on'); lb.setAttribute('aria-hidden', 'true'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') lb.classList.remove('on'); });
  }
  function reveal() {
    document.querySelectorAll('.section > *').forEach(function (el) {
      el.classList.add('reveal');
      visible(el, function (v) { if (v) el.classList.add('in'); }, 0.05);
    });
  }
  function nav() {
    var n = document.getElementById('topnav');
    window.addEventListener('scroll', function () { n.classList.toggle('scrolled', window.scrollY > 10); }, { passive: true });
  }

  function start() { asciiHero(); decision(); fan(); rideReplay(); counters(); clips(); lightbox(); reveal(); nav(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else window.addEventListener('load', start);
})();
