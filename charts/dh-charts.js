/* Shared chart motion. One observer. Plays once. */
(function () {
  var REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var EASE = "cubic-bezier(.22,1,.36,1)";
  var STONE = "#F6F4EF";
  var BRASS = "#B8965A";
  var BRASS_LT = "#D9BE8A";
  var MUTED = "#8E887C";
  var AXIS = "rgba(217,190,138,.72)";
  var BASE = "rgba(246,244,239,.28)";
  var BAND = "rgba(246,244,239,.08)";

  function el(parent, name, attrs) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    parent.appendChild(n);
    return n;
  }
  function ease(t) {
    var p = Math.min(1, Math.max(0, t));
    return 1 - Math.pow(1 - p, 3);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function fmt(n, dec) {
    var v = dec ? Number(n).toFixed(dec) : String(Math.round(n));
    return v.replace("-", "\u2212");
  }
  function narrow(svg) {
    var w = svg.getBoundingClientRect().width || svg.clientWidth || 720;
    return w < 520;
  }
  function tone(name) {
    if (name === "brass") return BRASS;
    if (name === "stone") return STONE;
    if (name === "muted") return MUTED;
    return name || BRASS;
  }

  function yearTicks(quarters, few, years) {
    years = years || (few ? [2016, 2020, 2026] : [2016, 2018, 2020, 2022, 2024, 2026]);
    return years.map(function (yr) {
      var hit = -1;
      quarters.forEach(function (q, i) {
        if (hit < 0 && String(q).indexOf(String(yr)) !== -1) hit = i;
      });
      return hit < 0 ? null : { i: hit, label: String(yr) };
    }).filter(Boolean);
  }

  function drawAxis(svg, plot, layout, spec) {
    var g = el(svg, "g", { class: "dh-axis" });
    var bottom = layout.H - layout.pad.b;
    el(g, "line", { x1: layout.pad.l, x2: layout.W - layout.pad.r, y1: bottom, y2: bottom, stroke: BASE, "stroke-width": "1" });
    var labels = [];
    if (spec.axis === "years" && spec.quarters) {
      var isNarrow = narrow(svg);
      var years = spec.years ? (isNarrow && spec.yearsNarrow ? spec.yearsNarrow : spec.years) : null;
      labels = yearTicks(spec.quarters, isNarrow, years).map(function (t) {
        return { x: layout.x(t.i), label: t.label };
      });
    } else if (spec.labels) {
      var step = 1;
      if (narrow(svg) && spec.labels.length > 6) step = 2;
      spec.labels.forEach(function (label, i) {
        if (i % step !== 0 && i !== spec.labels.length - 1) return;
        labels.push({ x: layout.x(i), label: label });
      });
    }
    labels.forEach(function (t) {
      el(g, "line", { x1: t.x, x2: t.x, y1: bottom, y2: bottom + 5, stroke: AXIS, "stroke-width": "1" });
      var text = el(g, "text", {
        x: t.x, y: bottom + 18, fill: AXIS, "font-size": String(layout.labelSize || 12), "text-anchor": "middle",
        "font-family": "Inter, system-ui, sans-serif"
      });
      text.textContent = t.label;
    });
    return g;
  }

  function layoutOf(spec, n) {
    var W = 720, H = spec.h || (spec.axis === "none" ? 220 : 280);
    var pad = { l: 36, r: 28, t: 16, b: spec.axis === "none" ? 16 : 36 };
    var yMin = spec.yMin, yMax = spec.yMax;
    function x(i) {
      if (n <= 1) return pad.l + (W - pad.l - pad.r) / 2;
      return pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
    }
    function y(v) {
      var t = (v - yMin) / (yMax - yMin || 1);
      return pad.t + (1 - t) * (H - pad.t - pad.b);
    }
    return { W: W, H: H, pad: pad, x: x, y: y };
  }

  function counts(root, p, bars) {
    root.querySelectorAll("[data-count-to]").forEach(function (node) {
      var to = parseFloat(node.getAttribute("data-count-to"));
      var dec = parseInt(node.getAttribute("data-decimals") || "0", 10);
      var prefix = node.getAttribute("data-prefix") || "";
      var local = p;
      var idx = node.getAttribute("data-count-i");
      if (idx !== null && bars && bars[idx]) local = bars[idx].p;
      var v = to * local;
      node.textContent = prefix + fmt(v, dec);
    });
  }

  function barProgress(i, p, n, dur) {
    var barMs = Math.min(3000, Math.max(2500, dur * 0.28));
    var stagger = n <= 1 ? 0 : Math.max(0, (dur - barMs) / (n - 1));
    var start = (stagger * i) / dur;
    var len = barMs / dur;
    return Math.min(1, Math.max(0, (p - start) / (len || 1)));
  }

  function finite(v) { return v != null && isFinite(v); }

  function nowFade(p, spec, n, dur) {
    var from = spec.now.from;
    var to = spec.now.to;
    if (spec.kind === "gap") {
      var a = barStart(from, n, dur);
      var b = Math.min(1, barEnd(to, n, dur));
      if (p <= a) return 0;
      if (p >= b) return 1;
      return (p - a) / (b - a || 1);
    }
    var head = p * (n - 1);
    if (head <= from) return 0;
    if (head >= to) return 1;
    return (head - from) / ((to - from) || 1);
  }

  function barStart(i, n, dur) {
    var barMs = Math.min(3000, Math.max(2500, dur * 0.28));
    var stagger = n <= 1 ? 0 : Math.max(0, (dur - barMs) / (n - 1));
    return (stagger * i) / dur;
  }

  function barEnd(i, n, dur) {
    var barMs = Math.min(3000, Math.max(2500, dur * 0.28));
    return barStart(i, n, dur) + barMs / dur;
  }

  function paintNow(g, spec, layout, p, dur) {
    var n = spec.quarters.length;
    var from = spec.now.from;
    var to = spec.now.to;
    var x0 = from <= 0 ? layout.pad.l : (layout.x(from - 1) + layout.x(from)) / 2;
    var x1 = to >= n - 1 ? layout.W - layout.pad.r : (layout.x(to) + layout.x(to + 1)) / 2;
    var fade = nowFade(p, spec, n, dur);
    var top = layout.pad.t;
    el(g, "rect", {
      x: x0, y: top, width: Math.max(0, x1 - x0), height: layout.H - top - layout.pad.b,
      fill: "rgba(217,190,138,.12)", opacity: String(fade)
    });
    var size = layout.labelSize || 12;
    var lines = layout.narrow && spec.now.lines ? spec.now.lines : [spec.now.label];
    lines.forEach(function (line, i) {
      var t = el(g, "text", {
        x: x1,
        y: top - 8 - (lines.length - 1 - i) * (size + 2),
        fill: AXIS,
        "font-size": String(size),
        "text-anchor": "end",
        "font-family": "Inter, system-ui, sans-serif",
        opacity: String(fade)
      });
      t.textContent = line;
    });
  }

  function paintEndLabels(g, spec, layout, p) {
    var n = spec.quarters.length;
    var size = layout.labelSize || 12;
    var minGap = size + 4;
    var items = [];
    (spec.series || []).forEach(function (s) {
      if (layout.narrow && s.hideNarrow) return;
      var last = -1;
      for (var i = 0; i < s.data.length; i++) if (finite(s.data[i])) last = i;
      if (last < 0) return;
      var head = p * (n - 1);
      var fade = Math.min(1, Math.max(0, (head - (last - 1.4)) / 1.4));
      if (fade <= 0) return;
      var val = s.data[last];
      var name = layout.narrow && s.short ? s.short : s.name;
      var sign = val > 0 ? "+" : "";
      items.push({
        s: s, last: last, y: layout.y(val), trueY: layout.y(val),
        text: name + " " + sign + val.toFixed(1) + "%",
        fade: fade, side: last < n - 1 ? "left" : "right", color: tone(s.color)
      });
    });
    ["left", "right"].forEach(function (side) {
      var group = items.filter(function (it) { return it.side === side; });
      group.sort(function (a, b) { return a.y - b.y; });
      var top = layout.pad.t + size;
      var bot = layout.H - layout.pad.b - 4;
      for (var i = 1; i < group.length; i++) {
        if (group[i].y < group[i - 1].y + minGap) group[i].y = group[i - 1].y + minGap;
      }
      if (group.length && group[group.length - 1].y > bot) {
        var shift = group[group.length - 1].y - bot;
        group.forEach(function (it) { it.y -= shift; });
      }
      if (group.length && group[0].y < top) {
        var shiftUp = top - group[0].y;
        group.forEach(function (it) { it.y += shiftUp; });
      }
      group.forEach(function (it) {
        var xPt = layout.x(it.last);
        var xText = it.side === "right" ? xPt + 8 : xPt - 8;
        el(g, "line", {
          x1: xPt, x2: it.side === "right" ? xPt + 6 : xPt - 6,
          y1: it.trueY, y2: it.y, stroke: it.color, "stroke-width": "1", opacity: String(it.fade)
        });
        var t = el(g, "text", {
          x: xText, y: it.y + 4, fill: it.color, "font-size": String(size),
          "text-anchor": it.side === "right" ? "start" : "end",
          "font-family": "Inter, system-ui, sans-serif", opacity: String(it.fade)
        });
        t.textContent = it.text;
      });
    });
  }

  function paint(svg, spec, p, dur) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var kind = spec.kind;
    if (kind === "donut") return paintDonut(svg, spec, p);

    var isNarrow = narrow(svg);
    var view = spec;
    if (isNarrow && spec.series && spec.series.some(function (s) { return s.hideNarrow; })) {
      view = Object.assign({}, spec, {series: spec.series.filter(function (s) { return !s.hideNarrow; })});
    }
    var n = (view.quarters && view.quarters.length) || (view.labels && view.labels.length) || (view.bars && view.bars.length) || 1;
    var cats = (view.labels || (view.bars || []).map(function (b) { return b.label; })).length || n;
    var layout = layoutOf(view, kind === "bars" || kind === "grouped" || kind === "stacked" ? cats : n);
    layout.narrow = isNarrow;
    layout.labelSize = isNarrow && spec.labelSize ? spec.labelSize : 12;
    if (spec.endLabels) layout.pad.r = isNarrow ? 200 : 128;
    if (spec.now) {
      var nLines = isNarrow && spec.now.lines ? spec.now.lines.length : 1;
      layout.pad.t = Math.max(layout.pad.t, 12 + nLines * (layout.labelSize + 3));
    }
    if (kind === "bars" || kind === "grouped" || kind === "stacked") {
      var inner = layout.W - layout.pad.l - layout.pad.r;
      var slot = inner / cats;
      layout.x = function (i) { return layout.pad.l + slot * (i + 0.5); };
    }
    svg.setAttribute("viewBox", "0 0 " + layout.W + " " + layout.H);
    drawAxis(svg, null, layout, view);
    var marks = el(svg, "g", {});
    var barStates = [];
    if (spec.now) paintNow(marks, spec, layout, p, dur);

    if (kind === "lines" || kind === "gap" || kind === "fuel") {
      paintLines(marks, view, layout, p);
      if (kind === "gap") paintGapBars(marks, view, layout, p, dur, barStates);
      if (kind === "fuel") paintFuelTicks(marks, view, layout, p);
      if (view.callout) paintCallout(marks, view, layout, p);
    } else if (kind === "bars") {
      paintBars(marks, spec, layout, p, dur, barStates);
    } else if (kind === "grouped") {
      paintGrouped(marks, spec, layout, p, dur, barStates);
    } else if (kind === "stacked") {
      paintStacked(marks, view, layout, p, dur, barStates);
    }
    if (spec.endLabels) paintEndLabels(marks, view, layout, p);
    return barStates;
  }

  function paintCallout(g, spec, layout, p) {
    var c = spec.callout;
    var i = (spec.quarters || []).indexOf(c.quarter);
    if (i < 0) return;
    var n = spec.quarters.length;
    if (p * (n - 1) < i) return;
    var series = spec.series && spec.series[0];
    if (!series || !finite(series.data[i])) return;
    var x = layout.x(i);
    var y = layout.y(series.data[i]);
    el(g, "circle", { cx: x, cy: y, r: "4", fill: BRASS_LT, stroke: BRASS, "stroke-width": "1.5" });
    var lines = layout.narrow && c.lines ? c.lines : [c.label];
    lines.forEach(function (line, k) {
      var t = el(g, "text", {
        x: x + 8, y: y - 10 - (lines.length - 1 - k) * 14,
        fill: AXIS, "font-size": "13", "font-family": "Inter, system-ui, sans-serif"
      });
      t.textContent = line;
    });
  }

  function paintLines(g, spec, layout, p) {
    var n = spec.quarters.length;
    var pos = p * (n - 1);
    var last = Math.floor(pos);
    var frac = pos - last;
    if (spec.band) {
      var y1 = layout.y(spec.band[1]);
      var y0 = layout.y(spec.band[0]);
      el(g, "rect", {
        x: layout.pad.l, y: Math.min(y0, y1), width: layout.W - layout.pad.l - layout.pad.r,
        height: Math.abs(y1 - y0), fill: BAND
      });
    }
    if (spec.shade) {
      spec.shade.forEach(function (s) {
        var a = layout.x(s.from);
        var b = layout.x(s.to);
        el(g, "rect", {
          x: Math.min(a, b), y: layout.pad.t, width: Math.abs(b - a),
          height: layout.H - layout.pad.t - layout.pad.b, fill: "rgba(184,150,90,.10)"
        });
      });
    }
    (spec.series || []).forEach(function (s) {
      if (layout.narrow && s.hideNarrow) return;
      var d = "";
      var pen = false;
      var end = Math.min(last, n - 1);
      for (var i = 0; i <= end; i++) {
        if (!finite(s.data[i])) { pen = false; continue; }
        d += (pen ? "L" : "M") + layout.x(i).toFixed(1) + " " + layout.y(s.data[i]).toFixed(1) + " ";
        pen = true;
      }
      if (frac > 0 && last < n - 1 && finite(s.data[last]) && finite(s.data[last + 1])) {
        var xx = lerp(layout.x(last), layout.x(last + 1), frac);
        var yy = lerp(layout.y(s.data[last]), layout.y(s.data[last + 1]), frac);
        d += "L" + xx.toFixed(1) + " " + yy.toFixed(1) + " ";
      }
      if (!d) return;
      var width = s.width || 2.5;
      if (layout.narrow && !s.emphasis) width = Math.min(width, 1.5);
      el(g, "path", {
        d: d, fill: "none", stroke: tone(s.color), "stroke-width": String(width),
        "stroke-linejoin": "round", "stroke-linecap": "round",
        "stroke-dasharray": s.dash || "none"
      });
    });
    if (spec.bracket && !spec.now) {
      var b = spec.bracket;
      var x1 = layout.x(b.from);
      var x2 = layout.x(b.to);
      var yb = layout.pad.t + 8;
      el(g, "path", {
        d: "M" + x1 + " " + (yb + 8) + " V" + yb + " H" + x2 + " V" + (yb + 8),
        fill: "none", stroke: BRASS_LT, "stroke-width": "1.25"
      });
    }
  }

  function paintGapBars(g, spec, layout, p, dur, states) {
    var n = spec.bars.length;
    var gap = (layout.W - layout.pad.l - layout.pad.r) / n;
    var bw = Math.max(2, gap * 0.62);
    var zero = layout.y(0);
    spec.bars.forEach(function (b, i) {
      var bp = barProgress(i, p, n, dur);
      states.push({ p: bp });
      var h = Math.abs(layout.y(0) - layout.y(b.value * bp));
      var top = b.value >= 0 ? layout.y(b.value * bp) : zero;
      el(g, "rect", {
        x: layout.x(i) - bw / 2, y: top, width: bw, height: Math.max(0, h),
        fill: b.value < 0 ? BRASS : "rgba(246,244,239,.28)"
      });
    });
  }

  function paintFuelTicks(g, spec, layout, p) {
    (spec.markers || []).forEach(function (m) {
      var last = spec.series[0].data.length - 1;
      var y = layout.y(m.value);
      var x = layout.x(Math.round(p * last));
      el(g, "line", {
        x1: layout.W - layout.pad.r - 70, x2: layout.W - layout.pad.r,
        y1: y, y2: y, stroke: "rgba(246,244,239,.45)", "stroke-width": "1", "stroke-dasharray": "3 3"
      });
      var t = el(g, "text", {
        x: layout.W - layout.pad.r - 74, y: y + 4, fill: AXIS, "font-size": "11",
        "text-anchor": "end", "font-family": "Inter, system-ui, sans-serif", opacity: String(Math.min(1, p * 1.4))
      });
      t.textContent = m.label;
      void x;
    });
  }

  function paintBars(g, spec, layout, p, dur, states) {
    var labels = spec.labels;
    var n = spec.bars.length;
    var inner = layout.W - layout.pad.l - layout.pad.r;
    var slot = inner / n;
    var bw = Math.min(36, slot * 0.62);
    var zero = layout.y(0);
    spec.bars.forEach(function (b, i) {
      var bp = barProgress(i, p, n, dur);
      states.push({ p: bp });
      var val = b.value * bp;
      var y = layout.y(Math.max(val, 0));
      var h = Math.abs(layout.y(val) - zero);
      el(g, "rect", {
        x: layout.pad.l + slot * i + (slot - bw) / 2,
        y: y, width: bw, height: Math.max(0.5, h), fill: tone(b.color)
      });
      void labels;
    });
  }

  function paintGrouped(g, spec, layout, p, dur, states) {
    var cats = spec.labels.length;
    var series = spec.series;
    var total = cats * series.length;
    var inner = layout.W - layout.pad.l - layout.pad.r;
    var slot = inner / cats;
    var bw = Math.min(18, (slot * 0.72) / series.length);
    var zero = layout.y(spec.yMin < 0 ? 0 : spec.yMin);
    var k = 0;
    for (var c = 0; c < cats; c++) {
      series.forEach(function (s, si) {
        var bp = barProgress(k, p, total, dur);
        states.push({ p: bp });
        var val = s.data[c] * bp;
        var y = layout.y(val);
        var h = Math.abs(zero - y);
        var base = spec.yMin < 0 ? layout.y(0) : layout.H - layout.pad.b;
        el(g, "rect", {
          x: layout.pad.l + slot * c + (slot - bw * series.length) / 2 + si * bw,
          y: Math.min(y, base), width: bw - 2, height: Math.max(0.5, h), fill: tone(s.color)
        });
        k += 1;
      });
    }
  }

  function paintStacked(g, spec, layout, p, dur, states) {
    var cats = spec.labels.length;
    var inner = layout.W - layout.pad.l - layout.pad.r;
    var slot = inner / cats;
    var bw = Math.min(42, slot * 0.5);
    var base = layout.H - layout.pad.b;
    spec.labels.forEach(function (_, c) {
      var bp = barProgress(c, p, cats, dur);
      states.push({ p: bp });
      var y = base;
      spec.series.forEach(function (s) {
        var h = ((layout.H - layout.pad.t - layout.pad.b) * ((s.data[c] * bp) / (spec.yMax || 100)));
        y -= h;
        el(g, "rect", { x: layout.pad.l + slot * c + (slot - bw) / 2, y: y, width: bw, height: Math.max(0, h), fill: tone(s.color) });
      });
    });
  }

  function paintDonut(svg, spec, p) {
    svg.setAttribute("viewBox", "0 0 280 220");
    var g = el(svg, "g", { class: "dh-axis" });
    var cx = 110, cy = 110, r = 68, sw = 18;
    var total = spec.segments.reduce(function (a, s) { return a + s.value; }, 0) || 1;
    var acc = 0;
    spec.segments.forEach(function (s) {
      var frac = s.value / total;
      var shown = Math.max(0, Math.min(frac, p * 1 - acc));
      var a0 = acc * Math.PI * 2 - Math.PI / 2;
      var a1 = (acc + shown) * Math.PI * 2 - Math.PI / 2;
      if (shown > 0.001) {
        var large = shown > 0.5 ? 1 : 0;
        var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
        var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
        el(g, "path", {
          d: "M" + x0 + " " + y0 + " A" + r + " " + r + " 0 " + large + " 1 " + x1 + " " + y1,
          fill: "none", stroke: tone(s.color), "stroke-width": sw, "stroke-linecap": "butt"
        });
      }
      acc += frac;
    });
    spec.segments.forEach(function (s, i) {
      var t = el(g, "text", {
        x: 200, y: 78 + i * 28, fill: AXIS, "font-size": "12", "font-family": "Inter, system-ui, sans-serif"
      });
      t.textContent = s.label;
    });
  }

  function mount(root) {
    var svg = root.querySelector("svg[data-plot]");
    var specNode = root.querySelector("script[data-spec]");
    if (!svg || !specNode) return null;
    var spec = JSON.parse(specNode.textContent);
    var dur = parseInt(root.getAttribute("data-duration") || "6500", 10);
    function frame(p) {
      var bars = paint(svg, spec, p, dur);
      counts(root, p, bars);
    }
    frame(REDUCE ? 1 : 0);
    return { frame: frame, dur: dur, root: root };
  }

  function play(item) {
    item.gen = (item.gen || 0) + 1;
    var gen = item.gen;
    if (REDUCE) { item.frame(1); return; }
    item.frame(0);
    var start = performance.now();
    function tick(now) {
      if (item.gen !== gen) return;
      var p = Math.min(1, (now - start) / item.dur);
      item.frame(ease(p));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function boot() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-dhc]"));
    var mounted = nodes.map(mount).filter(Boolean);
    window.dhReplayCharts = function () { mounted.forEach(play); };
    if (!mounted.length || REDUCE) return;
    if (!("IntersectionObserver" in window)) {
      mounted.forEach(play);
      return;
    }
    var seen = new WeakSet();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.35) return;
        var item = mounted.filter(function (m) { return m.root === entry.target; })[0];
        if (!item || seen.has(item.root)) return;
        seen.add(item.root);
        io.unobserve(item.root);
        play(item);
      });
    }, { threshold: [0, 0.35, 0.5] });
    mounted.forEach(function (m) { io.observe(m.root); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  void EASE;
})();
