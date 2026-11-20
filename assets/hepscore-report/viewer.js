// =============================================================
// HEP Benchmark Suite report viewer
// -------------------------------------------------------------
// Client-side viewer for the JSON produced by the HEP Benchmark Suite
// (v3.x), or the same document wrapped as an OpenSearch hit
// (`_source.message`) or search response (`hits.hits[0]`).
// Page markup is viewer.html, styles are viewer.css. Everything runs in
// the browser; dropped files are never uploaded. A downloaded report is
// still one self-contained HTML file.
//
// Pipeline (top to bottom in this file):
//   1. Helpers           — small pure utilities (stats, formatting, escaping).
//   2. unwrapSuite(data) — peels an OpenSearch wrapper down to the suite JSON.
//   3. parseReport(data) — turns the raw suite JSON into a flat, render-ready
//                          object `r` (scores, host/HW info, telemetry series).
//   4. renderHTML(r)     — builds the single-report HTML string + chart specs.
//   5. renderComparison  — one view for two reports: deltas and overlaid series.
//   6. drawCharts(specs) — renders the telemetry line charts with Chart.js.
//   7. UI wiring         — drag & drop, sample loading, standalone export.
//
// Relevant shape of the suite JSON:
//   {
//     "_id", "_timestamp", "_timestamp_end",     // run identity / window
//     "host": { "HW": {...}, "SW": {...}, ... },  // static machine inventory
//     "suite": { "version", "flags": {...} },
//     "profiles": {                               // one benchmark "profile"
//       "<benchmark>": { "value"|"score", "unit", "wl-scores": {...}, "benchmarks": {...} }
//     },
//     "plugins": {                                // dynamic time-series data
//       "CommandExecutor": {
//         "<phase>": { "<metric>": { values:[...], config:{unit}, ... } }
//       }
//     }
//   }
// The viewer is benchmark-agnostic: it auto-detects the profile and plots
// every time-series metric it finds, so new benchmarks/plugins work without
// code changes.
// =============================================================

// -------------------------------------------------------------
// Helpers — small pure utilities used throughout.
// -------------------------------------------------------------

// Linear-interpolated percentile (p in [0,1]); null for empty input.
function percentile(arr, p) {
  if (!arr || !arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const k = (s.length - 1) * p;
  const lo = Math.floor(k), hi = Math.ceil(k);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (k - lo);
}
function mean(arr) {
  return arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}
function median(arr) { return percentile(arr, 0.5); }

// Human-friendly number formatting. Missing values are an em dash.
// At most two fraction digits; a smaller `d` is kept (counts stay whole).
function fmt(x, d) {
  if (x === null || x === undefined || Number.isNaN(Number(x))) return "—";
  let digits = 2;
  if (d !== undefined && Number.isFinite(Number(d))) digits = Math.max(0, Math.min(2, Number(d)));
  return Number(x).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function smtLabel(smt) {
  const s = String(smt ?? "—");
  if (["1", "true", "True", "yes"].includes(s)) return "enabled";
  if (["0", "false", "False", "no"].includes(s)) return "disabled";
  return s || "—";
}

function memLabel(mb) {
  if (!Number.isFinite(mb) || mb <= 0) return "—";
  return `${fmt(mb / 1024)} GiB`;
}

function freqRangeLabel(r) {
  const min = Number(r.cpuMinMhz), max = Number(r.cpuMaxMhz);
  if (Number.isFinite(min) && min > 0 && Number.isFinite(max) && max > 0) {
    return `${fmt(min)}–${fmt(max)} MHz`;
  }
  if (Number.isFinite(max) && max > 0) return `${fmt(max)} MHz max`;
  return "—";
}

function nominalFreqLabel(r) {
  const nom = Number(r.cpuMhz);
  return Number.isFinite(nom) && nom > 0 ? `${fmt(nom)} MHz` : "—";
}

// Safe nested lookup: get(obj, ["a","b"], def) returns obj.a.b or `def`
// if any step is missing. Avoids long `obj && obj.a && obj.a.b` chains.
function get(obj, path, def) {
  let cur = obj;
  for (const p of path) {
    if (!cur || typeof cur !== "object" || !(p in cur)) return def;
    cur = cur[p];
  }
  return cur;
}

// Escape a value for safe insertion into HTML (report is built as strings).
function esc(s) {
  return String(s ?? "—").replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Signed formatting for comparison deltas. Missing values stay an em dash.
function fmtSigned(x, d) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  const body = fmt(Math.abs(x), d);
  if (x > 0) return "+" + body;
  if (x < 0) return "-" + body;
  return body;
}

function deltaNum(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return b - a;
}
function deltaPct(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / Math.abs(a)) * 100;
}
function deltaLine(a, b) {
  const d = deltaNum(a, b);
  if (d === null) return "—";
  const p = deltaPct(a, b);
  return p === null ? fmtSigned(d) : `${fmtSigned(d)} (${fmtSigned(p, 1)}%)`;
}

// A success checkmark only for a completed run. Failed OpenSearch documents
// (status "failed", score -1) stay readable without looking successful.
function statusText(status) {
  const s = String(status || "—");
  return /^(ok|success|succeeded|passed)$/i.test(s) ? `✓ ${s}` : s;
}

function reportHasContent(r) {
  return Number.isFinite(r.score) || (r.hostname && r.hostname !== "—") || !!r.profileKey;
}

// Peel OpenSearch wrappers down to the suite document parseReport expects.
// A bare suite JSON is returned unchanged. A search response uses the first hit.
function unwrapSuite(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("JSON must be an object");
  }
  const hits = data.hits && Array.isArray(data.hits.hits) ? data.hits.hits : null;
  if (hits && hits.length) return unwrapSuite(hits[0]);
  const message = data._source && data._source.message;
  if (message && typeof message === "object" && !Array.isArray(message) &&
      (message.host || message.profiles || message.suite)) {
    return message;
  }
  const source = data._source;
  if (source && typeof source === "object" && !Array.isArray(source) &&
      (source.host || source.profiles)) {
    return source;
  }
  return data;
}

// -------------------------------------------------------------
// Parse benchmark JSON -> normalized report object
// -------------------------------------------------------------

// Presentation hints for the well-known suite metrics: nice title, unit,
// line color, and which aggregate reference lines to overlay on the chart
// ("mean" and/or "q85"). Unknown metrics fall back to auto-generated meta.
const METRIC_META = {
  "power-consumption": { title: "Power consumption", unit: "W",
                         color: "rgb(3, 102, 214)", aggs: ["mean", "q85"] },
  "load":              { title: "Load average",     unit: "load",
                         color: "rgb(203, 36, 49)", aggs: ["mean"] },
  "used-memory":       { title: "Used memory",       unit: "MiB",
                         color: "rgb(34, 134, 58)", aggs: ["mean"] },
  "used-swap-memory":  { title: "Used swap",         unit: "MiB",
                         color: "rgb(176, 136, 0)", aggs: ["mean"] },
  "cpu-frequency":     { title: "CPU frequency",    unit: "MHz",
                         color: "rgb(111, 66, 193)", aggs: ["mean"] },
};
// Preferred display order for known metrics; anything else sorts after them.
const METRIC_ORDER = [
  "power-consumption", "cpu-frequency", "load", "used-memory", "used-swap-memory",
];
// Colors cycled through for auto-discovered (unknown) metrics, e.g. GPU series.
const METRIC_PALETTE = [
  "rgb(3, 102, 214)", "rgb(203, 36, 49)", "rgb(34, 134, 58)", "rgb(176, 136, 0)",
  "rgb(111, 66, 193)", "rgb(227, 98, 9)", "rgb(3, 102, 214)", "rgb(115, 92, 15)",
  "rgb(0, 134, 138)", "rgb(130, 80, 223)", "rgb(207, 34, 46)", "rgb(52, 105, 162)",
];
// Plugin keys that are not benchmark phases (control/metadata, not metrics).
const PHASE_SKIP = new Set(["pre", "post", "status"]);

// A metric entry is any object carrying a numeric `values` array (a time series).
function isMetricEntry(obj) {
  return obj && typeof obj === "object" && Array.isArray(obj.values);
}

// List the metric names directly inside a container object (one phase / plugin).
function discoverMetricKeys(phase) {
  if (!phase || typeof phase !== "object") return [];
  return Object.keys(phase).filter(k => !PHASE_SKIP.has(k) && isMetricEntry(phase[k]));
}

// True if `obj` directly holds one or more metric series.
function isMetricContainer(obj) {
  return discoverMetricKeys(obj).length > 0;
}

// Turn a raw metric key into a readable chart title, e.g.
// "gpu-power-consumption-0" -> "GPU Power Consumption (GPU 0)".
function metricTitle(name) {
  return name
    .replace(/-(\d+)$/, " (GPU $1)")
    .replace(/-/g, " ")
    .replace(/\bgpu\b/gi, "GPU")
    .replace(/\bcpu\b/gi, "CPU")
    .replace(/\bgr\b/gi, "graphics")
    .replace(/\bsm\b/gi, "SM")
    .replace(/\bmem\b/gi, "memory")
    .replace(/\babs\b/gi, "used")
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Resolve presentation meta for a metric: use the curated entry if known
// (returned as a copy, since callers may tweak the title), otherwise derive
// title/unit/color and add a Q85 line for anything power-related.
function metricMetaFor(name, series, index) {
  const known = METRIC_META[name];
  if (known) return { ...known };
  return {
    title: metricTitle(name),
    unit: series.unit || "",
    color: METRIC_PALETTE[index % METRIC_PALETTE.length],
    aggs: /power/i.test(name) ? ["mean", "q85"] : ["mean"],
  };
}

// Order metrics for display: known metrics first (by METRIC_ORDER), then
// non-GPU before GPU, with GPU series grouped by type and numbered by device.
function sortMetricKeys(keys) {
  const orderIndex = new Map(METRIC_ORDER.map((k, i) => [k, i]));
  return [...keys].sort((a, b) => {
    const ai = orderIndex.has(a) ? orderIndex.get(a) : 1000;
    const bi = orderIndex.has(b) ? orderIndex.get(b) : 1000;
    if (ai !== bi) return ai - bi;
    const ag = a.startsWith("gpu-"), bg = b.startsWith("gpu-");
    if (ag !== bg) return ag ? 1 : -1;
    if (ag && bg) {
      const prefix = s => s.replace(/-\d+$/, "");
      const pa = prefix(a), pb = prefix(b);
      if (pa !== pb) return pa.localeCompare(pb);
      const na = Number((a.match(/-(\d+)$/) || [])[1] || 0);
      const nb = Number((b.match(/-(\d+)$/) || [])[1] || 0);
      return na - nb;
    }
    return a.localeCompare(b);
  });
}

// Build a DOM-safe canvas id from a metric key (may contain ":" / "-").
function chartIdFor(key) {
  return "chart_" + key.replace(/[^a-zA-Z0-9_]/g, "_");
}

// Extract one metric time series into a normalized shape. Drops null/invalid
// samples (e.g. an IPMI reading that returned nothing); returns null if the
// series ends up empty so the caller can skip it entirely.
function parseSeries(phase, name) {
  const raw = phase && phase[name];
  if (!raw || !Array.isArray(raw.values)) return null;
  const values = raw.values
    .map(v => (v === null || v === undefined ? NaN : Number(v)))
    .filter(v => !Number.isNaN(v));
  if (!values.length) return null;
  return {
    name,
    unit: get(raw, ["config", "unit"], ""),
    values,
    start: raw.start_time || null,
    end:   raw.end_time   || null,
  };
}

// Pick which benchmark "profile" this report is about and extract its headline
// score. HEPscore is the canonical case (score under `.score`); other suite
// benchmarks (DB12, containerized apps, ...) expose `.value`/`.unit`, sometimes
// nested one level deeper (e.g. profiles.docker_img.DockerImg.value).
function selectProfile(profiles) {
  if (profiles && profiles.hepscore) {
    return { key: "hepscore", label: "HEPscore23", obj: profiles.hepscore,
             score: get(profiles, ["hepscore", "score"], NaN),
             unit: "", status: get(profiles, ["hepscore", "status"], "—") };
  }
  const keys = profiles ? Object.keys(profiles) : [];
  if (!keys.length) return { key: "", label: "Benchmark", obj: {}, score: NaN, unit: "", status: "—" };
  const key = keys[0];
  const obj = profiles[key] || {};
  let label = key;
  let score = get(obj, ["value"], NaN);
  let unit = get(obj, ["unit"], "");
  let status = get(obj, ["status"], "—");
  if (!Number.isFinite(Number(score))) {
    const innerKeys = Object.keys(obj).filter(k => obj[k] && typeof obj[k] === "object");
    if (innerKeys.length) {
      const innerKey = innerKeys[0];
      const inner = obj[innerKey] || {};
      label = key === "docker_img" ? innerKey : key;
      score = get(inner, ["value"], NaN);
      unit = get(inner, ["unit"], "");
      status = get(inner, ["status"], status);
    }
  }
  return { key, label, obj, score, unit, status };
}

// Case-insensitive key comparison (suite uses e.g. "DB12" vs "db12").
function keysMatch(a, b) {
  return String(a || "").toLowerCase() === String(b || "").toLowerCase();
}

// First non-reference number in a wl-scores map, plus its "<kind>_ref" value.
// Returns null when the map has no usable throughput.
function pickWorkloadScore(myScores) {
  if (!myScores || typeof myScores !== "object" || Array.isArray(myScores)) return null;
  let score = null, kind = "";
  for (const [k, v] of Object.entries(myScores)) {
    if (String(k).endsWith("_ref")) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    score = n;
    kind = k;
    break;
  }
  if (score === null) return null;
  let ref = null;
  const refRaw = myScores[`${kind}_ref`];
  if (refRaw !== undefined && refRaw !== null && Number.isFinite(Number(refRaw))) {
    ref = Number(refRaw);
  }
  const relative = (ref && ref > 0) ? score / ref : null;
  return { kind, score, ref, relative };
}

// Find the metric container(s) inside a single plugin and which phase each
// came from. Returns [{ plugin, phase, data }, ...]. Two plugin layouts:
//   - Phased (like CommandExecutor): metrics live under phase keys; we prefer
//     the phase matching the benchmark profile, then "hepscore", else take all
//     (skipping the brief "pre"/"post" snapshots).
//   - Flat: metrics sit directly at the plugin root (phase = "").
function metricContainersInPlugin(pluginData, profileKey, pluginName) {
  if (!pluginData || typeof pluginData !== "object") return [];

  const phases = Object.keys(pluginData).filter(k =>
    !PHASE_SKIP.has(k) && isMetricContainer(pluginData[k])
  );
  if (phases.length) {
    const matched = profileKey && phases.find(k => keysMatch(k, profileKey));
    const chosen = matched ? [matched]
      : phases.includes("hepscore") ? ["hepscore"]
      : phases;
    return chosen.map(phase => ({ plugin: pluginName, phase, data: pluginData[phase] }));
  }

  if (isMetricContainer(pluginData)) {
    return [{ plugin: pluginName, phase: "", data: pluginData }];
  }
  return [];
}

// Gather every telemetry series across all plugins into three parallel
// structures keyed by a unique metric key:
//   series     — { key: {values, unit, start, end} }
//   metricMeta — { key: {title, unit, color, aggs} }
//   metricKeys — ordered list of keys (drives chart order)
// On name collisions across plugins the key is prefixed ("Plugin:metric"), and
// titles get a "Plugin (phase): " prefix so the source stays clear.
function collectAllMetrics(plugins, profileKey) {
  const series = {};
  const metricMeta = {};
  const metricKeys = [];
  const seen = new Set();
  let idx = 0;

  for (const pluginName of Object.keys(plugins || {})) {
    const containers = metricContainersInPlugin(plugins[pluginName], profileKey, pluginName);
    for (const { plugin, phase, data } of containers) {
      for (const key of sortMetricKeys(discoverMetricKeys(data))) {
        const s = parseSeries(data, key);
        if (!s) continue;

        const fullKey = seen.has(key) ? `${plugin}:${key}` : key;
        seen.add(key);

        series[fullKey] = s;
        const meta = metricMetaFor(key, s, idx);
        const fromOtherPlugin = pluginName !== "CommandExecutor";
        const needsLabel = fromOtherPlugin || fullKey !== key || (phase && !keysMatch(phase, profileKey));
        if (needsLabel) {
          const label = phase ? `${plugin} (${phase})` : plugin;
          meta.title = `${label}: ${meta.title}`;
        }
        metricMeta[fullKey] = meta;
        metricKeys.push(fullKey);
        idx++;
      }
    }
  }
  return { series, metricMeta, metricKeys };
}

// Main entry point: convert the raw suite JSON into a flat object that the
// render functions can consume directly. Every field is defaulted so that
// partial/older reports still render (missing values just show as "—").
function parseReport(data) {
  // Pull the major sub-trees up front; `get` returns {} when a branch is absent.
  const host = get(data, ["host"], {}) || {};
  const hw = get(host, ["HW"], {}) || {};
  const sw = get(host, ["SW"], {}) || {};
  const cpu = get(hw, ["CPU"], {}) || {};
  const os_ = get(sw, ["OS"], {}) || {};
  const kern = get(sw, ["kernel"], {}) || {};
  const mem = get(hw, ["MEMORY"], {}) || {};
  const gpus = get(hw, ["GPU"], {}) || {};
  const profiles = get(data, ["profiles"], {}) || {};
  const plugins = get(data, ["plugins"], {}) || {};
  const profileInfo = selectProfile(profiles);
  const profileKey = profileInfo.key;
  const profileLabel = profileInfo.label;
  const profileObj = profileInfo.obj || {};
  const scoreUnit = profileInfo.unit || "";

  // GPU label (first entry)
  let gpu = "—";
  for (const k in gpus) {
    if (gpus[k] && gpus[k].name) { gpu = gpus[k].name; break; }
  }

  // Time series from all suite plugins (CommandExecutor and others)
  const { series, metricMeta, metricKeys } = collectAllMetrics(plugins, profileKey);

  // Headline score plus two derived efficiency metrics. Score/W uses the Q85
  // (85th percentile) of the power series as a representative load power.
  const score = Number(profileInfo.score);
  const ncores = Number(get(data, ["suite", "flags", "ncores"],
                             cpu.CPU_num || 1)) || 1;
  const scorePerCore = Number.isFinite(score) ? score / ncores : null;
  const power = series["power-consumption"];
  const q85Power = power ? percentile(power.values, 0.85) : null;
  const scorePerWatt = (Number.isFinite(score) && q85Power && q85Power > 0) ? score / q85Power : null;

  // Per-workload breakdown. Full suite JSON lists each workload under
  // `benchmarks` (with per-run durations). Summary documents, such as an
  // OpenSearch procurement hit, omit that tree and keep only `wl-scores`.
  // Flat benchmarks like DB12 have neither, leaving this array empty.
  const benchmarks = [];
  const bms = get(profileObj, ["benchmarks"], {}) || {};
  const wlScores = get(profileObj, ["wl-scores"], {}) || {};
  const workloadStarts = []; // { name, ts } in ISO
  if (bms && typeof bms === "object" && !Array.isArray(bms)) {
    for (const [name, bm] of Object.entries(bms)) {
      if (!bm || typeof bm !== "object") continue;
      // The workload score may live in the top-level wl-scores map or nested
      // in the first run's report; "*_ref" entries are reference values.
      const myScores = wlScores[name] || {};
      const picked = pickWorkloadScore(myScores)
        || pickWorkloadScore(get(bm, ["run0", "report", "wl-scores"], {}) || {});
      if (!picked) continue;
      const { kind, score: bmScore, ref, relative } = picked;

      // Average duration across all "runN" entries that report one.
      const durations = [];
      for (const k of Object.keys(bm)) {
        if (k.startsWith("run") && bm[k] && typeof bm[k].duration === "number") {
          durations.push(bm[k].duration);
        }
      }

      // Optional workload start time markers (best-effort).
      // Some suite JSON variants include ISO timestamps per workload run, e.g.
      // benchmarks.<wl>.run0.start_time / start / begin / timestamp.
      // If present, we use the earliest run timestamp as the workload start marker.
      try {
        const runKeys = Object.keys(bm).filter(k => k.startsWith("run"));
        const isoLike = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s);
        const tsVals = [];
        for (const rk of runKeys) {
          const ro = bm[rk];
          if (!ro || typeof ro !== "object") continue;
          const candKeys = ["start_time", "start", "begin", "timestamp", "_timestamp"];
          for (const ck of candKeys) {
            const v = ro[ck];
            if (isoLike(v)) tsVals.push(v);
          }
          // allow nested report timestamps too
          const rep = ro.report;
          if (rep && typeof rep === "object") {
            for (const ck of candKeys) {
              const v = rep[ck];
              if (isoLike(v)) tsVals.push(v);
            }
          }
        }
        if (tsVals.length) {
          tsVals.sort((a, b) => new Date(a) - new Date(b));
          workloadStarts.push({ name, ts: tsVals[0] });
        }
      } catch (_) { /* best-effort, ignore */ }

      benchmarks.push({
        name, kind, score: bmScore, ref, relative,
        version: String(bm.version || get(bm, ["app", "version"], "") || ""),
        runs: durations.length,
        avgDuration: durations.length ? mean(durations) : NaN,
        description: get(bm, ["app", "description"], ""),
      });
    }
  }

  // Workloads present only in wl-scores (no per-run `benchmarks` entry).
  const named = new Set(benchmarks.map(b => b.name));
  if (wlScores && typeof wlScores === "object" && !Array.isArray(wlScores)) {
    for (const [name, myScores] of Object.entries(wlScores)) {
      if (named.has(name)) continue;
      const picked = pickWorkloadScore(myScores);
      if (!picked) continue;
      benchmarks.push({
        name,
        kind: picked.kind,
        score: picked.score,
        ref: picked.ref,
        relative: picked.relative,
        version: "",
        runs: null,
        avgDuration: NaN,
        description: "",
      });
    }
  }

  // Flat, render-ready view model. Telemetry (series/metricMeta/metricKeys)
  // and benchmarks are already normalized above; the rest is host/HW/run meta.
  return {
    runId: data._id || "",
    tsStart: data._timestamp || "",
    tsEnd: data._timestamp_end || "",
    hostname: host.hostname || "—",
    ip: (Array.isArray(host.ip) ? host.ip.filter(Boolean).join(", ") : host.ip) || "—",
    site: get(host, ["tags", "site"], "—"),
    osLabel: `${os_.id || "?"} ${get(os_, ["version", "major"], "?")}.${get(os_, ["version", "minor"], "?")}`,
    kernel: `${kern.version || "?"}.${kern.major || "?"}.${kern.minor || "?"}-${kern.ABI || "?"}`,
    python: sw.python_version || "—",
    singularity: sw.singularity || "—",
    bios: `${get(hw, ["BIOS", "Vendor"], "?")} ${get(hw, ["BIOS", "Version"], "?")} (${get(hw, ["BIOS", "Release_data"], "?")})`,
    isVM: !!get(hw, ["SYSTEM", "isVM"], false),
    cpuModel: cpu.CPU_Model || "—",
    cpuArch: cpu.Architecture || "—",
    cpuSockets: Number(cpu.Sockets || 1),
    cpuCores: Number(cpu.Cores_per_socket || 0),
    cpuThreadsPerCore: Number(cpu.Threads_per_core || 1),
    cpuTotal: Number(cpu.CPU_num || 0),
    cpuMinMhz: Number(cpu.CPU_Min_Speed_MHz || 0),
    cpuMaxMhz: Number(cpu.CPU_Max_Speed_MHz || 0),
    cpuMhz: Number(cpu.CPU_MHz),
    cpuL2: cpu.L2_cache || "—",
    cpuL3: cpu.L3_cache || "—",
    powerPolicy: cpu.Power_Policy || "—",
    powerDriver: cpu.Power_Driver || "—",
    smt: String(cpu.SMT_Enabled ?? "—"),
    memTotalMb: Math.floor(Number(mem.Mem_Total || 0) / 1024),
    memAvailMb: Math.floor(Number(mem.Mem_Available || 0) / 1024),
    swapTotalMb: Math.floor(Number(mem.Mem_Swap || 0) / 1024),
    gpu,
    suiteVersion: String(get(data, ["suite", "version"], "—")),
    profileKey,
    profileLabel,
    benchmarkName: String(get(profileObj, ["settings", "name"], "") || profileLabel),
    scoreUnit,
    hepscoreVersion: String(get(profileObj, ["app_info", "hepscore_ver"], "—")),
    runMode: String(get(data, ["suite", "flags", "run_mode"], "—")),
    ncores,
    registry: String(get(profileObj, ["settings", "registry"], "—")),
    method: String(get(profileObj, ["settings", "method"], "—")),
    scaling: Number(get(profileObj, ["settings", "scaling"], 1)),
    repetitions: Number(get(profileObj, ["settings", "repetitions"], 1)),
    referenceMachine: String(get(profileObj, ["settings", "reference_machine"], "—")),
    score, scorePerCore, scorePerWatt, q85Power,
    series, metricMeta, metricKeys, benchmarks, workloadStarts,
    status: String(profileInfo.status || "—"),
  };
}

// -------------------------------------------------------------
// Render — turn the report object into HTML + chart specifications.
// -------------------------------------------------------------

// One-line "mean · median · min · max" summary shown under each chart title.
function summaryLine(s) {
  const parts = [];
  const m = mean(s.values), me = median(s.values);
  if (m !== null) parts.push(`mean ${fmt(m)}`);
  if (me !== null) parts.push(`median ${fmt(me)}`);
  if (s.values.length) {
    parts.push(`min ${fmt(Math.min(...s.values))}`);
    parts.push(`max ${fmt(Math.max(...s.values))}`);
  }
  return parts.join(" · ");
}

// X-axis labels for a series. Samples are evenly spaced between the series'
// start and end timestamps, so we render "HH:MM" labels; if timestamps are
// missing we fall back to plain sample indices.
function timeLabels(s) {
  const n = s.values.length;
  if (n <= 1 || !s.start || !s.end) return s.values.map((_, i) => String(i));
  const t0 = new Date(s.start), t1 = new Date(s.end);
  const step = (t1 - t0) / (n - 1);
  return s.values.map((_, i) => {
    const d = new Date(t0.getTime() + step * i);
    return d.toISOString().substring(11, 16);
  });
}

// Build the per-chart configuration consumed by drawCharts(). For each metric
// we compute its line data, labels, overlay aggregate lines (mean/Q85), a text
// summary, and the x-positions of any workload-start markers.
function chartSpecs(r) {
  const specs = [];
  // Workload start times, parsed and sorted, used to draw vertical markers.
  const markers = (r.workloadStarts || [])
    .map(m => ({ name: m.name, t: new Date(m.ts) }))
    .filter(m => Number.isFinite(+m.t))
    .sort((a, b) => a.t - b.t);

  for (const key of r.metricKeys) {
    const s = r.series[key];
    const meta = r.metricMeta[key];
    // Horizontal reference lines overlaid on the series (per metric meta).
    const agg = [];
    if ((meta.aggs || []).includes("mean")) {
      const m = mean(s.values);
      if (m !== null) agg.push({ name: "mean", value: +m.toFixed(2),
                                 color: "rgb(203, 36, 49)", dash: [6, 4] });
    }
    if ((meta.aggs || []).includes("q85")) {
      const q = percentile(s.values, 0.85);
      if (q !== null) agg.push({ name: "Q85", value: +q.toFixed(2),
                                 color: "rgb(176, 136, 0)", dash: [2, 3] });
    }
    const unit = meta.unit || s.unit || "";
    specs.push({
      id: chartIdFor(key),
      title: meta.title, unit, color: meta.color,
      values: s.values, labels: timeLabels(s), agg,
      summary: summaryLine(s),
      // Map each workload start time onto a fractional sample index along this
      // series' time span, so the marker lines up with the right point.
      markerIdx: (() => {
        if (!markers.length || !s.start || !s.end) return [];
        const t0 = new Date(s.start), t1 = new Date(s.end);
        const span = t1 - t0;
        if (!Number.isFinite(span) || span <= 0) return [];
        const n = s.values.length;
        const out = [];
        for (const m of markers) {
          const frac = (+m.t - +t0) / span;
          if (frac < 0 || frac > 1) continue;
          out.push({ idx: frac * (n - 1), name: m.name });
        }
        return out;
      })(),
    });
  }
  return specs;
}

// Assemble the full report markup from the view model. Returns the HTML string
// plus the chart specs (which drawCharts needs once the HTML is in the DOM).
// The report is composed of five sections: hero, host/HW, telemetry, workload
// results, and run metadata.
function renderHTML(r) {
  const specs = chartSpecs(r);
  const scorePerWattHTML = r.scorePerWatt !== null
    ? `<div class="score">${fmt(r.scorePerWatt)}</div>
       <div class="hero-sub">${fmt(r.score)} / ${fmt(r.q85Power, 1)} W (Q85 power)</div>`
    : `<div class="score">—</div>
       <div class="hero-sub">power series not available</div>`;
  const scoreUnit = r.scoreUnit ? ` ${esc(r.scoreUnit)}` : "";
  const scoreLabel = r.profileLabel || "Benchmark";
  const heroMethod = r.method !== "—" ? esc(r.method) : "scaling";
  const heroScaling = Number.isFinite(r.scaling) ? `× ${fmt(r.scaling, 0)}` : "";

  // Hero banner: title with benchmark-type badge and the three headline scores.
  const hero = `
<header>
  <h1>${esc(scoreLabel)} · ${esc(r.hostname)} (${esc(r.site)}) · ${esc((r.tsStart || "").slice(0, 10))}
    <span class="badge">Benchmark type: ${esc(scoreLabel)}</span>
  </h1>
  <div class="sub">Run ID <code>${esc(r.runId)}</code> · ${esc(r.tsStart)} → ${esc(r.tsEnd)}</div>
</header>
<div class="hero">
  <div class="hero-scores">
    <div class="hero-metric">
      <div class="score-label">Final score</div>
      <div class="score">${fmt(r.score)}${scoreUnit}</div>
      <div class="hero-sub">${heroMethod} ${heroScaling}</div>
    </div>
    <div class="hero-metric">
      <div class="score-label">Score / core</div>
      <div class="score">${fmt(r.scorePerCore)}</div>
      <div class="hero-sub">${fmt(r.score)} / ${r.ncores} cores</div>
    </div>
    <div class="hero-metric">
      <div class="score-label">Score / W</div>
      ${scorePerWattHTML}
    </div>
  </div>
  <div class="meta">
    <div><strong>Host:</strong> ${esc(r.hostname)} @ ${esc(r.site)}</div>
    <div><strong>CPU:</strong> ${esc(r.cpuModel)} · ${r.cpuTotal} CPUs
         (${r.cpuSockets}S × ${r.cpuCores}C × ${r.cpuThreadsPerCore}T)</div>
    <div><strong>GPU:</strong> ${esc(r.gpu)}</div>
    <div><strong>Status:</strong> ${esc(statusText(r.status))}</div>
  </div>
</div>`;

  // Static inventory: host identity/software on the left, hardware on the right.
  const hostCard = `
<section>
  <div class="grid grid-2">
    <div class="card">
      <h2>Host</h2>
      <dl class="kv">
        <dt>Hostname</dt><dd>${esc(r.hostname)}</dd>
        <dt>IP</dt><dd>${esc(r.ip)}</dd>
        <dt>Site</dt><dd>${esc(r.site)}</dd>
        <dt>OS</dt><dd>${esc(r.osLabel)} · kernel ${esc(r.kernel)}</dd>
        <dt>Python</dt><dd>${esc(r.python)}</dd>
        <dt>Singularity</dt><dd>${esc(r.singularity)}</dd>
        <dt>BIOS</dt><dd>${esc(r.bios)}</dd>
        <dt>Virtualised</dt><dd>${r.isVM ? "Yes" : "No (bare metal)"}</dd>
      </dl>
    </div>
    <div class="card">
      <h2>Hardware</h2>
      <dl class="kv">
        <dt>Architecture</dt><dd>${esc(r.cpuArch)}</dd>
        <dt>CPU</dt><dd>${esc(r.cpuModel)}</dd>
        <dt>Topology</dt>
        <dd>${r.cpuSockets} socket · ${r.cpuCores} cores ·
            ${r.cpuThreadsPerCore} thread/core · ${r.cpuTotal} CPUs</dd>
        <dt>Clock</dt>
        <dd>${esc(freqRangeLabel(r))}${nominalFreqLabel(r) !== "—" ? ` · nominal ${esc(nominalFreqLabel(r))}` : ""}</dd>
        <dt>Governor</dt><dd>${esc(r.powerPolicy)}</dd>
        <dt>Power driver</dt><dd>${esc(r.powerDriver)}</dd>
        <dt>L2 / L3</dt><dd>${esc(r.cpuL2)} / ${esc(r.cpuL3)}</dd>
        <dt>SMT</dt><dd>${esc(smtLabel(r.smt))}</dd>
        <dt>Memory</dt>
        <dd>${esc(memLabel(r.memTotalMb))} total,
            ${esc(memLabel(r.memAvailMb))} avail.</dd>
        <dt>Swap</dt><dd>${esc(memLabel(r.swapTotalMb))}</dd>
        <dt>GPU</dt><dd>${esc(r.gpu)}</dd>
      </dl>
    </div>
  </div>
</section>`;

  // Telemetry: one chart card per discovered metric (empty-state if none).
  const telemetry = `
<section>
  <h2>System telemetry during ${esc(scoreLabel)} phase</h2>
  ${specs.length === 0
    ? `<div class="card"><em>No plugin time-series available in this report.</em></div>`
    : `<div class="sub" style="margin-bottom:14px">${specs.length} metrics · ${specs[0].values.length} samples each (first series) · recorded by suite plugins</div>
       <div class="grid grid-2">
         ${specs.map(c => `
           <div class="card">
             <h3>${esc(c.title)} (${esc(c.unit)})</h3>
             <div class="sub" style="margin-bottom:6px">${esc(c.summary)}</div>
             <div class="chart-wrap"><canvas id="${c.id}"></canvas></div>
           </div>`).join("")}
       </div>`}
</section>`;

  // Workload results table; benchmarks without a per-workload breakdown (e.g.
  // DB12) show a short empty-state card instead.
  const bench = r.benchmarks.length
    ? `
<section>
  <h2>${esc(r.benchmarkName)} workload results</h2>
  <div class="sub" style="margin-bottom:14px">
    ${r.benchmarks.length} benchmarks · ${r.repetitions} repetitions each ·
    relative score = throughput / reference
  </div>
  <div class="card table-scroll" style="padding:0">
  <table>
    <thead><tr>
      <th>Benchmark</th><th>Kind</th><th>Version</th>
      <th class="num">Throughput</th>
      <th class="num">Relative score</th><th class="num">Runs</th>
      <th class="num">Duration (avg)</th>
    </tr></thead>
    <tbody>
      ${r.benchmarks.map(b => `
        <tr>
          <td><strong>${esc(b.name)}</strong>
              <div class="sub" style="font-size:11px">${esc(b.description)}</div></td>
          <td><code>${esc(b.kind)}</code></td>
          <td>${esc(b.version || "—")}</td>
          <td class="num">${fmt(b.score)}</td>
          <td class="num">${b.relative !== null ? fmt(b.relative) : "—"}</td>
          <td class="num">${b.runs === null || b.runs === undefined ? "—" : b.runs}</td>
          <td class="num">${fmt(b.avgDuration)} s</td>
        </tr>`).join("")}
    </tbody>
  </table>
  </div>
</section>`
    : `
<section>
  <h2>${esc(r.benchmarkName)} results</h2>
  <div class="card"><em>No per-workload breakdown found in this report.</em></div>
</section>`;

  // Run metadata: build the left column row-by-row so optional fields (registry,
  // method, HEPscore version, ...) are omitted entirely when absent.
  const metaRowsLeft = [
    ["Suite version", esc(r.suiteVersion)],
    ["Benchmark", `${esc(scoreLabel)}${scoreUnit ? " (" + scoreUnit + ")" : ""}`],
  ];
  if (r.profileKey === "hepscore") {
    metaRowsLeft.push(["HEPscore", `v${esc(r.hepscoreVersion)}`]);
  }
  metaRowsLeft.push(["Run mode", `${esc(r.runMode)} (apptainer ${esc(r.singularity)})`]);
  if (r.registry !== "—") metaRowsLeft.push(["Registry", `<code>${esc(r.registry)}</code>`]);
  if (r.method !== "—") metaRowsLeft.push(["Method", `${esc(r.method)} · scaling ×${fmt(r.scaling, 0)}`]);
  if (Number.isFinite(r.repetitions)) metaRowsLeft.push(["Repetitions", `${r.repetitions}`]);
  metaRowsLeft.push(["Cores used", `${r.ncores}`]);
  if (r.referenceMachine !== "—") metaRowsLeft.push(["Reference machine", esc(r.referenceMachine)]);

  const meta = `
<section>
  <h2>Run metadata</h2>
  <div class="grid grid-2">
    <div class="card">
      <dl class="kv">
        ${metaRowsLeft.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}
      </dl>
    </div>
    <div class="card">
      <dl class="kv">
        <dt>Run window</dt><dd>${esc(r.tsStart)} → ${esc(r.tsEnd)}</dd>
        <dt>Report generated</dt><dd>${new Date().toISOString().replace("T", " ").substring(0, 19)} UTC</dd>
      </dl>
    </div>
  </div>
</section>`;

  // Raw JSON explorer: a collapsed-by-default searchable tree of the full
  // suite document. The mount div is populated by initJsonExplorer().
  const rawJson = `
<section>
  <h2>Raw JSON</h2>
  <details class="card">
    <summary style="cursor:pointer; font-weight:600">Explore the full benchmark JSON</summary>
    <div class="sub" style="margin:8px 0 10px">Search any key or value to find details not shown above. Everything stays in your browser.</div>
    <div class="json-explorer" id="jsonExplorer"></div>
  </details>
</section>`;

  return { html: hero + hostCard + telemetry + bench + meta + rawJson, specs };
}

// -------------------------------------------------------------
// Comparison — one view for two already-parsed reports.
// Delta is always B − A. Telemetry x-axis is percent of each run.
// -------------------------------------------------------------

function runLabel(r, filename) {
  const host = r.hostname && r.hostname !== "—" ? r.hostname : (filename || "run");
  const date = (r.tsStart || "").slice(0, 10);
  return date ? `${host} · ${date}` : host;
}

function toPercentPoints(values) {
  const n = values.length;
  return values.map((y, i) => ({ x: n <= 1 ? 0 : (i / (n - 1)) * 100, y }));
}

function meanCaption(s) {
  if (!s || !s.values || !s.values.length) return "—";
  const m = mean(s.values);
  return m === null ? "—" : fmt(m);
}

function renderComparison(entryA, entryB) {
  const a = entryA.r;
  const b = entryB.r;
  let labelA = runLabel(a, entryA.filename);
  let labelB = runLabel(b, entryB.filename);
  if (labelA === labelB) {
    labelA += " (A)";
    labelB += " (B)";
  }
  const scoreLabel = a.profileLabel && b.profileLabel && a.profileLabel !== b.profileLabel
    ? `${a.profileLabel} / ${b.profileLabel}`
    : (a.profileLabel || b.profileLabel || "Benchmark");
  const unit = a.scoreUnit || b.scoreUnit || "";

  function cmpMetric(label, va, vb) {
    const d = deltaNum(va, vb);
    const p = deltaPct(va, vb);
    const cls = d === null || d === 0 ? "" : (d > 0 ? "up" : "down");
    const deltaText = d === null ? "" : (p === null ? `Δ ${fmtSigned(d)}` : `Δ ${fmtSigned(d)} (${fmtSigned(p)}%)`);
    const deltaHtml = d === null
      ? `<div class="hero-sub">Δ not available</div>`
      : `<div class="cmp-delta ${cls}">${esc(deltaText)}</div>`;
    return `
      <div class="hero-metric">
        <div class="score-label">${esc(label)}</div>
        <div class="cmp-line"><span class="cmp-tag">A</span>${esc(fmt(va))}</div>
        <div class="cmp-line"><span class="cmp-tag">B</span>${esc(fmt(vb))}</div>
        ${deltaHtml}
      </div>`;
  }

  function runCard(tag, label, r, filename) {
    const mem = memLabel(r.memTotalMb);
    return `
      <div class="card">
        <h2>${esc(tag)} · ${esc(label)}</h2>
        ${filename ? `<div class="sub" style="margin:-8px 0 10px">${esc(filename)}</div>` : ""}
        <dl class="kv">
          <dt>Host</dt><dd>${esc(r.hostname)} @ ${esc(r.site)}</dd>
          <dt>CPU</dt><dd>${esc(r.cpuModel)}</dd>
          <dt>Cores</dt><dd>${esc(r.ncores)}</dd>
          <dt>Sockets</dt><dd>${esc(r.cpuSockets)}</dd>
          <dt>Governor</dt><dd>${esc(r.powerPolicy)}</dd>
          <dt>Memory</dt><dd>${mem}</dd>
          <dt>Python</dt><dd>${esc(r.python)}</dd>
          <dt>Singularity</dt><dd>${esc(r.singularity)}</dd>
          <dt>GPU</dt><dd>${esc(r.gpu)}</dd>
          <dt>Status</dt><dd>${esc(statusText(r.status))}</dd>
          <dt>Run window</dt><dd>${esc(r.tsStart)} → ${esc(r.tsEnd)}</dd>
        </dl>
      </div>`;
  }

  const hero = `
<header>
  <h1>Comparison · ${esc(labelA)} vs ${esc(labelB)}
    <span class="badge">Benchmark type: ${esc(scoreLabel)}</span>
  </h1>
  <div class="sub">A is ${esc(labelA)} · B is ${esc(labelB)} · delta is B − A</div>
</header>
<div class="hero">
  <div class="hero-scores">
    ${cmpMetric(`Final score${unit ? " (" + unit + ")" : ""}`, a.score, b.score)}
    ${cmpMetric("Score / core", a.scorePerCore, b.scorePerCore)}
    ${cmpMetric("Score / W", a.scorePerWatt, b.scorePerWatt)}
  </div>
</div>`;

  const setupRows = [
    ["CPU", a.cpuModel, b.cpuModel],
    ["Governor", a.powerPolicy, b.powerPolicy],
    ["Power driver", a.powerDriver, b.powerDriver],
    ["Cores used", String(a.ncores), String(b.ncores)],
    ["Sockets", String(a.cpuSockets), String(b.cpuSockets)],
    ["SMT", smtLabel(a.smt), smtLabel(b.smt)],
    ["CPU frequency", freqRangeLabel(a), freqRangeLabel(b)],
    ["Nominal frequency", nominalFreqLabel(a), nominalFreqLabel(b)],
    ["L2 cache", a.cpuL2, b.cpuL2],
    ["L3 cache", a.cpuL3, b.cpuL3],
    ["Memory", memLabel(a.memTotalMb), memLabel(b.memTotalMb)],
    ["Python", a.python, b.python],
    ["Singularity", a.singularity, b.singularity],
  ];

  const runs = `
<section>
  <h2>Runs</h2>
  <div class="grid grid-2">
    ${runCard("A", labelA, a, entryA.filename)}
    ${runCard("B", labelB, b, entryB.filename)}
  </div>
</section>`;

  const mapA = new Map((a.benchmarks || []).map(item => [item.name, item]));
  const mapB = new Map((b.benchmarks || []).map(item => [item.name, item]));
  const names = [];
  for (const name of [...mapA.keys(), ...mapB.keys()]) {
    if (!names.includes(name)) names.push(name);
  }
  const scoreCell = item => (item && Number.isFinite(item.score)) ? fmt(item.score) : "—";
  const relCell = item => (item && item.relative !== null && Number.isFinite(item.relative)) ? fmt(item.relative) : "—";
  const versionDiffNames = names.filter(name => {
    const va = ((mapA.get(name) || {}).version) || "";
    const vb = ((mapB.get(name) || {}).version) || "";
    return va && vb && va !== vb;
  });
  const setupDiffs = setupRows.filter(([, va, vb]) => String(va) !== String(vb));
  const diffLabels = setupDiffs.map(([label]) => label);
  if (versionDiffNames.length) diffLabels.push("workload versions");
  const setupBanner = diffLabels.length
    ? `<div class="diffs-banner"><strong>${diffLabels.length} difference${diffLabels.length === 1 ? "" : "s"} to check:</strong> ${diffLabels.map(esc).join(", ")}. Highlighted rows are not the same in A and B.</div>`
    : `<div class="sub" style="margin-bottom:12px">Governor, cores, memory, caches, frequency, SMT, Python, and Singularity match.</div>`;
  const setup = `
<section>
  <h2>Setup comparison</h2>
  ${setupBanner}
  <div class="card table-scroll" style="padding:0">
  <table>
    <thead><tr><th>Field</th><th>A</th><th>B</th></tr></thead>
    <tbody>
      ${setupRows.map(([label, va, vb]) => {
        const differ = String(va) !== String(vb);
        return `<tr class="${differ ? "diff" : ""}"><td>${esc(label)}</td><td>${esc(va)}</td><td>${esc(vb)}</td></tr>`;
      }).join("")}
    </tbody>
  </table>
  </div>
</section>`;
  const benchName = a.benchmarkName || b.benchmarkName || scoreLabel;
  const bench = names.length ? `
<section>
  <h2>${esc(benchName)} workload results</h2>
  <div class="sub" style="margin-bottom:14px">${names.length} benchmarks · delta is B − A · relative score = throughput / reference · a blank version means that run did not report one</div>
  <div class="card table-scroll" style="padding:0">
  <table>
    <thead><tr>
      <th>Benchmark</th><th>Kind</th>
      <th>Version A</th><th>Version B</th>
      <th class="num">Throughput A</th><th class="num">Throughput B</th>
      <th class="num">Relative A</th><th class="num">Relative B</th>
      <th class="num">Δ</th><th class="num">Δ %</th>
    </tr></thead>
    <tbody>
      ${names.map(name => {
        const ba = mapA.get(name);
        const bb = mapB.get(name);
        const sa = ba && Number.isFinite(ba.score) ? ba.score : NaN;
        const sb = bb && Number.isFinite(bb.score) ? bb.score : NaN;
        const d = deltaNum(sa, sb);
        const p = deltaPct(sa, sb);
        const cls = d === null || d === 0 ? "" : (d > 0 ? "up" : "down");
        const kind = (ba && ba.kind) || (bb && bb.kind) || "—";
        const va = (ba && ba.version) || "";
        const vb = (bb && bb.version) || "";
        const vCls = va && vb && va !== vb ? "diff" : "";
        return `
        <tr>
          <td><strong>${esc(name)}</strong></td>
          <td><code>${esc(kind)}</code></td>
          <td class="${vCls}">${esc(va || "—")}</td>
          <td class="${vCls}">${esc(vb || "—")}</td>
          <td class="num">${scoreCell(ba)}</td>
          <td class="num">${scoreCell(bb)}</td>
          <td class="num">${relCell(ba)}</td>
          <td class="num">${relCell(bb)}</td>
          <td class="num ${cls}">${d === null ? "—" : esc(fmtSigned(d))}</td>
          <td class="num ${cls}">${p === null ? "—" : esc(fmtSigned(p) + "%")}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>
  </div>
</section>` : `
<section>
  <h2>${esc(benchName)} workload results</h2>
  <div class="card"><em>No per-workload breakdown found in either report.</em></div>
</section>`;

  const COLOR_A = "rgb(3, 102, 214)";
  const COLOR_B = "rgb(203, 36, 49)";
  const keys = [];
  for (const key of [...(a.metricKeys || []), ...(b.metricKeys || [])]) {
    if (!keys.includes(key)) keys.push(key);
  }
  const specs = keys.map(key => {
    const sA = a.series && a.series[key];
    const sB = b.series && b.series[key];
    const meta = (a.metricMeta && a.metricMeta[key]) || (b.metricMeta && b.metricMeta[key]) || {};
    const unitText = meta.unit || (sA && sA.unit) || (sB && sB.unit) || "";
    const series = [];
    if (sA && sA.values && sA.values.length) {
      series.push({ label: labelA, color: COLOR_A, points: toPercentPoints(sA.values) });
    }
    if (sB && sB.values && sB.values.length) {
      series.push({ label: labelB, color: COLOR_B, points: toPercentPoints(sB.values) });
    }
    return {
      id: chartIdFor(key),
      mode: "compare",
      title: meta.title || key,
      unit: unitText,
      series,
      summary: `A mean ${meanCaption(sA)} · B mean ${meanCaption(sB)}`,
    };
  }).filter(spec => spec.series.length);

  const telemetry = `
<section>
  <h2>System telemetry</h2>
  ${specs.length === 0
    ? `<div class="card"><em>No plugin time-series available in either report.</em></div>`
    : `<div class="sub" style="margin-bottom:14px">${specs.length} metrics · time scaled to each run's own duration</div>
       <div class="grid grid-2">
         ${specs.map(c => `
           <div class="card">
             <h3>${esc(c.title)} (${esc(c.unit)})</h3>
             <div class="sub" style="margin-bottom:6px">${esc(c.summary)}</div>
             <div class="chart-wrap"><canvas id="${c.id}"></canvas></div>
           </div>`).join("")}
       </div>`}
</section>`;

  // Raw JSON explorers: one searchable tree per run (A and B).
  const rawJson = `
<section>
  <h2>Raw JSON</h2>
  <details class="card">
    <summary style="cursor:pointer; font-weight:600">Explore the full benchmark JSON</summary>
    <div class="sub" style="margin:8px 0 10px">Search a key, a value, or a dotted path such as HW.CPU. The same field is shown from both runs.</div>
    <div class="json-explorer" id="jsonExplorerCompare"></div>
  </details>
</section>`;

  return { html: hero + setup + runs + bench + telemetry + rawJson, specs };
}

// Render the telemetry charts into the canvases created by renderHTML.
// Defined as a standalone, dependency-free function on purpose: the "Download
// as standalone HTML" button serializes it with `.toString()` and re-runs it
// in the exported file, so it must not reference any outer-scope variables.
function drawCharts(specs) {
  // Chart.js plugin that draws dashed vertical lines (with labels) at each
  // workload start position supplied via the chart's `workloadMarkers` options.
  const workloadMarkerPlugin = {
    id: "workloadMarkers",
    afterDatasetsDraw(chart, args, opts) {
      const marks = (opts && opts.marks) || [];
      if (!marks.length) return;
      const { ctx, chartArea, scales } = chart;
      const xScale = scales.x;
      if (!xScale || !chartArea) return;

      ctx.save();
      ctx.strokeStyle = "rgba(88, 96, 105, 0.6)";
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1;

      // If there are many workloads, limit labels to avoid clutter.
      const labelEvery = marks.length > 10 ? 2 : 1;
      let labelIdx = 0;

      for (const m of marks) {
        if (!Number.isFinite(m.idx)) continue;
        const x = xScale.getPixelForValue(m.idx);
        if (x < chartArea.left || x > chartArea.right) continue;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();

        if (m.name && (labelIdx % labelEvery === 0)) {
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(88, 96, 105, 0.9)";
          ctx.font = "10px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          const label = String(m.name).length > 22 ? String(m.name).slice(0, 19) + "…" : String(m.name);
          ctx.fillText(label, Math.min(x + 4, chartArea.right - 40), chartArea.top + 4);
          ctx.setLineDash([5, 4]);
        }
        labelIdx++;
      }
      ctx.restore();
    },
  };

  // One Chart.js line chart per spec: the metric series plus any aggregate
  // reference lines (mean/Q85) as flat dashed datasets.
  function formatTick(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v ?? "");
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  function tooltipLabel(ctx) {
    const y = ctx.parsed ? ctx.parsed.y : ctx.raw;
    const name = ctx.dataset && ctx.dataset.label ? ctx.dataset.label + ": " : "";
    return name + formatTick(y);
  }

  specs.forEach(cfg => {
    const el = document.getElementById(cfg.id);
    if (!el) return;
    if (cfg.mode === "compare") {
      const datasets = (cfg.series || []).map(s => ({
        label: s.label,
        data: s.points,
        borderColor: s.color,
        backgroundColor: s.color.replace("rgb", "rgba").replace(")", ",0.12)"),
        borderWidth: 1.6, pointRadius: 0, tension: 0.15, fill: false,
      }));
      new Chart(el, {
        type: "line",
        data: { datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          parsing: { xAxisKey: "x", yAxisKey: "y" },
          interaction: { mode: "nearest", intersect: false },
          scales: {
            x: { type: "linear", min: 0, max: 100,
                 title: { display: true, text: "% of run" },
                 ticks: { maxTicksLimit: 6 } },
            y: { beginAtZero: true, title: { display: true, text: cfg.unit || "" },
                 ticks: { callback: formatTick } },
          },
          plugins: {
            legend: { position: "top", labels: { boxWidth: 14, font: { size: 11 } } },
            tooltip: { callbacks: { label: tooltipLabel } },
          },
        },
      });
      return;
    }
    const datasets = [{
      label: cfg.unit,
      data: cfg.values,
      borderColor: cfg.color,
      backgroundColor: cfg.color.replace("rgb", "rgba").replace(")", ",0.12)"),
      borderWidth: 1.4, pointRadius: 0, tension: 0.2, fill: true,
    }];
    (cfg.agg || []).forEach(a => {
      datasets.push({
        label: `${a.name} = ${a.value}`,
        data: Array(cfg.values.length).fill(a.value),
        borderColor: a.color, borderDash: a.dash,
        borderWidth: 1.4, pointRadius: 0, fill: false,
      });
    });
    new Chart(el, {
      type: "line",
      data: { labels: cfg.labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: { ticks: { maxTicksLimit: 8 } },
          y: { beginAtZero: true, title: { display: true, text: cfg.unit },
               ticks: { callback: formatTick } },
        },
        plugins: {
          legend: { position: "top",
                    labels: { boxWidth: 14, font: { size: 11 } } },
          tooltip: { callbacks: { label: tooltipLabel } },
          workloadMarkers: { marks: cfg.markerIdx || [] },
        },
      },
      plugins: [workloadMarkerPlugin],
    });
  });
}

// Build an interactive, searchable tree view of a raw JSON document inside
// `rootEl`. Like drawCharts, this is intentionally self-contained (it does not
// reference any outer-scope variable) so the "Download as standalone HTML"
// button can serialize it with `.toString()` and re-run it in the export.
function initJsonExplorer(rootEl, data, opts) {
  if (!rootEl) return;
  opts = opts || {};
  rootEl.innerHTML = "";
  const CHUNK = 100; // large arrays are shown in slices of this many items

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function typeOf(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    return typeof v;
  }
  function previewVal(v) {
    const t = typeOf(v);
    if (t === "string") {
      const s = v.length > 80 ? v.slice(0, 77) + "…" : v;
      return '<span class="je-str">"' + escHtml(s) + '"</span>';
    }
    if (t === "number") return '<span class="je-num">' + escHtml(v) + "</span>";
    if (t === "boolean") return '<span class="je-bool">' + v + "</span>";
    if (t === "null") return '<span class="je-null">null</span>';
    return "";
  }
  function summaryPreview(v) {
    const t = typeOf(v);
    if (t === "array") return '<span class="je-type">[' + v.length + "]</span>";
    const keys = Object.keys(v);
    const list = keys.slice(0, 6).join(", ") + (keys.length > 6 ? ", …" : "");
    return '<span class="je-type">{' + keys.length + "}</span> " +
           '<span class="je-preview">' + escHtml(list) + "</span>";
  }
  function summaryText(v) {
    const t = typeOf(v);
    return t === "array" ? "[" + v.length + "]" : "{" + Object.keys(v).length + "}";
  }
  function valueText(v) {
    const t = typeOf(v);
    if (t === "string") return '"' + v + '"';
    if (t === "null") return "null";
    return String(v);
  }
  function pathToStr(path) {
    let out = "";
    for (const k of path) {
      if (typeof k === "number") out += "[" + k + "]";
      else if (/^[A-Za-z_$][\w$]*$/.test(k)) out += (out ? "." : "") + k;
      else out += '["' + String(k).replace(/"/g, '\\"') + '"]';
    }
    return out || "(root)";
  }

  function makeCopyBtn(path) {
    const b = document.createElement("span");
    b.className = "je-copy";
    b.textContent = "copy path";
    b.title = "Copy this path to the clipboard";
    b.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      const str = pathToStr(path);
      try { navigator.clipboard.writeText(str); } catch (_) { /* ignore */ }
      b.textContent = "copied";
      setTimeout(() => { b.textContent = "copy path"; }, 1000);
    });
    return b;
  }

  function keyLabelHTML(keyLabel) {
    return keyLabel === null ? "" : '<span class="je-key">' + escHtml(keyLabel) + "</span>: ";
  }

  function makeLeaf(keyLabel, v, path) {
    const row = document.createElement("div");
    row.className = "je-node";
    const inner = document.createElement("div");
    inner.className = "je-row";
    inner.innerHTML = keyLabelHTML(keyLabel) + previewVal(v);
    inner.appendChild(makeCopyBtn(path));
    row.appendChild(inner);
    row.dataset.path = JSON.stringify(path);
    return row;
  }

  function makeBranch(keyLabel, v, path) {
    const det = document.createElement("details");
    det.className = "je-branch je-node";
    det.dataset.path = JSON.stringify(path);
    const sum = document.createElement("summary");
    sum.className = "je-row";
    sum.innerHTML = keyLabelHTML(keyLabel) + summaryPreview(v);
    sum.appendChild(makeCopyBtn(path));
    det.appendChild(sum);
    let built = false;
    det._build = () => { if (!built) { built = true; buildChildren(det, v, path); } };
    det.addEventListener("toggle", () => { if (det.open) det._build(); });
    return det;
  }

  function makeChunk(v, start, end, path) {
    const det = document.createElement("details");
    det.className = "je-branch je-chunk-wrap je-node";
    const sum = document.createElement("summary");
    sum.className = "je-row";
    sum.innerHTML = '<span class="je-chunk">[' + start + " … " + (end - 1) + "]</span>";
    det.appendChild(sum);
    let built = false;
    det._build = () => {
      if (built) return;
      built = true;
      for (let i = start; i < end; i++) det.appendChild(nodeFor(i, v[i], path.concat(i)));
    };
    det.addEventListener("toggle", () => { if (det.open) det._build(); });
    return det;
  }

  function buildChildren(container, v, path) {
    const t = typeOf(v);
    if (t === "object") {
      for (const k of Object.keys(v)) container.appendChild(nodeFor(k, v[k], path.concat(k)));
    } else if (t === "array") {
      if (v.length <= CHUNK) {
        for (let i = 0; i < v.length; i++) container.appendChild(nodeFor(i, v[i], path.concat(i)));
      } else {
        for (let start = 0; start < v.length; start += CHUNK) {
          container.appendChild(makeChunk(v, start, Math.min(start + CHUNK, v.length), path));
        }
      }
    }
  }

  function nodeFor(keyLabel, v, path) {
    const t = typeOf(v);
    return (t === "object" || t === "array")
      ? makeBranch(keyLabel, v, path)
      : makeLeaf(keyLabel, v, path);
  }

  // Locate the direct child node for `wantJson`, descending into (and opening)
  // array chunk wrappers as needed. Returns the matching element or null.
  function locateChild(container, wantJson) {
    for (const kid of container.children) {
      if (kid.dataset && kid.dataset.path === wantJson) return kid;
    }
    for (const kid of container.children) {
      if (kid.tagName === "DETAILS" && kid.classList.contains("je-chunk-wrap")) {
        kid.open = true;
        if (kid._build) kid._build();
        for (const g of kid.children) {
          if (g.dataset && g.dataset.path === wantJson) return g;
        }
      }
    }
    return null;
  }

  // Open every ancestor branch down to `path` (building lazily as we go) and
  // return the final node element, or null if the path can't be resolved.
  function expandToPath(path) {
    let container = tree;
    let node = null;
    for (let depth = 0; depth < path.length; depth++) {
      node = locateChild(container, JSON.stringify(path.slice(0, depth + 1)));
      if (!node) return null;
      if (node.tagName === "DETAILS") {
        node.open = true;
        if (node._build) node._build();
      }
      container = node;
    }
    return node;
  }

  function revealPath(path, quiet) {
    const node = expandToPath(path);
    if (!node) return;
    tree.querySelectorAll(".je-hit").forEach(e => e.classList.remove("je-hit"));
    const target = node.tagName === "DETAILS"
      ? node.querySelector(":scope > summary")
      : (node.querySelector(":scope > .je-row") || node);
    (target || node).classList.add("je-hit");
    if (!quiet) node.scrollIntoView({ block: "center" });
  }

  // "HW.CPU" matches a path ending in those segments. "values[0]" is the same as "values.0".
  function normQuery(q) {
    return String(q || "").trim().toLowerCase()
      .replace(/\[(\d+)\]/g, ".$1")
      .replace(/\.+/g, ".")
      .replace(/^\./, "")
      .replace(/\.$/, "");
  }
  // "HW.CPU.CPU" matches every path whose tail starts that way, so CPU_Model,
  // CPU_num, and the rest all show up. Each segment is a prefix of the key.
  function pathMatches(path, v, query) {
    const q = normQuery(query);
    if (!q || !path.length) return false;
    if (q.includes(".")) {
      const qsegs = q.split(".").filter(Boolean);
      const segs = path.map(k => String(k).toLowerCase());
      if (!qsegs.length || segs.length < qsegs.length) return false;
      const start = segs.length - qsegs.length;
      for (let i = 0; i < qsegs.length; i++) {
        if (!segs[start + i].startsWith(qsegs[i])) return false;
      }
      return true;
    }
    const lastKey = String(path[path.length - 1]).toLowerCase();
    if (lastKey.includes(q)) return true;
    const t = typeOf(v);
    return t !== "object" && t !== "array" && String(v).toLowerCase().includes(q);
  }

  function runSearch(q) {
    results.innerHTML = "";
    const query = normQuery(q);
    if (!query) return;
    const MAX = 200;
    const matches = [];
    (function walk(v, path) {
      if (matches.length >= MAX) return;
      if (pathMatches(path, v, query)) matches.push({ path, v });
      if (matches.length >= MAX) return;
      const t = typeOf(v);
      if (t === "object") for (const k of Object.keys(v)) walk(v[k], path.concat(k));
      else if (t === "array") for (let i = 0; i < v.length; i++) walk(v[i], path.concat(i));
    })(data, []);

    if (!matches.length) {
      results.innerHTML = '<div class="je-empty">No matches.</div>';
      return;
    }
    const shown = matches.slice(0, MAX);
    const head = document.createElement("div");
    head.className = "je-empty";
    head.textContent = (shown.length > 1
      ? shown.length + " matches · click one to open it in the JSON"
      : "1 match");
    results.appendChild(head);
    for (const m of shown) {
      const t = typeOf(m.v);
      const valStr = (t === "object" || t === "array") ? summaryText(m.v) : valueText(m.v);
      const row = document.createElement("div");
      row.className = "je-result";
      row.innerHTML = '<span class="je-path">' + escHtml(pathToStr(m.path)) +
                      "</span> = " + escHtml(valStr);
      row.addEventListener("click", () => revealPath(m.path));
      results.appendChild(row);
    }
    // Open the tree only when the search identifies a single node.
    if (shown.length === 1) revealPath(shown[0].path);
  }

  // Toolbar: search box + expand/collapse controls.
  const toolbar = document.createElement("div");
  toolbar.className = "je-toolbar";
  const search = document.createElement("input");
  search.type = "search";
  search.className = "je-search";
  search.placeholder = "Search keys, values, or a path like HW.CPU";
  const expandBtn = document.createElement("button");
  expandBtn.type = "button";
  expandBtn.className = "je-btn";
  expandBtn.textContent = "Expand top level";
  const collapseBtn = document.createElement("button");
  collapseBtn.type = "button";
  collapseBtn.className = "je-btn";
  collapseBtn.textContent = "Collapse all";
  if (!opts.hideSearch) toolbar.appendChild(search);
  toolbar.appendChild(expandBtn);
  toolbar.appendChild(collapseBtn);

  const tree = document.createElement("div");
  tree.className = "je-tree";
  const results = document.createElement("div");
  results.className = "je-results";

  rootEl.appendChild(toolbar);
  rootEl.appendChild(results);
  rootEl.appendChild(tree);

  // Root level is rendered eagerly; nested branches build on first open.
  buildChildren(tree, data, []);

  expandBtn.addEventListener("click", () => {
    for (const kid of tree.children) {
      if (kid.tagName === "DETAILS") {
        kid.open = true;
        if (kid._build) kid._build();
      }
    }
  });
  collapseBtn.addEventListener("click", () => {
    tree.querySelectorAll("details.je-branch").forEach(d => { d.open = false; });
  });

  if (!opts.hideSearch) {
    let searchTimer = null;
    search.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => runSearch(search.value), 200);
    });
  }
  return { reveal: revealPath };
}

// One search across two suite documents. A dotted path such as HW.CPU
// resolves in both trees, and each matching field is shown side by side.
function initCompareJsonExplorer(rootEl, dataA, dataB, labelA, labelB) {
  if (!rootEl) return;
  rootEl.innerHTML = "";
  const nameA = labelA || "A";
  const nameB = labelB || "B";

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function kind(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    return typeof v;
  }
  function pathLabel(path) {
    let out = "";
    for (const k of path) {
      if (typeof k === "number") out += "[" + k + "]";
      else out += (out ? "." : "") + k;
    }
    return out || "(root)";
  }
  function normQuery(q) {
    return String(q || "").trim().toLowerCase()
      .replace(/\[(\d+)\]/g, ".$1")
      .replace(/\.+/g, ".")
      .replace(/^\./, "")
      .replace(/\.$/, "");
  }
  function pathMatches(path, v, query) {
    const q = normQuery(query);
    if (!q) return false;
    if (q.includes(".")) {
      const qsegs = q.split(".").filter(Boolean);
      const segs = path.map(k => String(k).toLowerCase());
      if (!qsegs.length || segs.length < qsegs.length) return false;
      const start = segs.length - qsegs.length;
      for (let i = 0; i < qsegs.length; i++) {
        if (!segs[start + i].startsWith(qsegs[i])) return false;
      }
      return true;
    }
    const lastKey = path.length ? String(path[path.length - 1]).toLowerCase() : "";
    if (lastKey.includes(q)) return true;
    const t = kind(v);
    return t !== "object" && t !== "array" && String(v).toLowerCase().includes(q);
  }
  function lookup(data, path) {
    let cur = data;
    for (const p of path) {
      if (cur == null || typeof cur !== "object" || !(p in cur)) return undefined;
      cur = cur[p];
    }
    return cur;
  }
  function collect(data, query) {
    const out = [];
    (function walk(v, path) {
      if (out.length >= 80) return;
      if (path.length && pathMatches(path, v, query)) out.push(path);
      if (out.length >= 80) return;
      const t = kind(v);
      if (t === "object") for (const k of Object.keys(v)) walk(v[k], path.concat(k));
      else if (t === "array") for (let i = 0; i < v.length; i++) walk(v[i], path.concat(i));
    })(data, []);
    return out;
  }
  function preview(v) {
    if (v === undefined) return "—";
    const t = kind(v);
    if (t === "string") return v.length > 80 ? v.slice(0, 77) + "…" : v;
    if (t === "array") return "[" + v.length + "]";
    if (t === "object") {
      const keys = Object.keys(v);
      return "{" + keys.length + "} " + keys.slice(0, 4).join(", ") + (keys.length > 4 ? ", …" : "");
    }
    if (v === null) return "null";
    return String(v);
  }
  function same(a, b) {
    if (a === undefined && b === undefined) return true;
    if (a === undefined || b === undefined) return false;
    const ta = kind(a), tb = kind(b);
    if (ta !== tb) return false;
    if (ta === "object" || ta === "array") {
      try { return JSON.stringify(a) === JSON.stringify(b); }
      catch (_) { return false; }
    }
    return a === b;
  }

  const toolbar = document.createElement("div");
  toolbar.className = "je-toolbar";
  const search = document.createElement("input");
  search.type = "search";
  search.className = "je-search";
  search.placeholder = "Search both runs, e.g. HW.CPU";
  toolbar.appendChild(search);
  const results = document.createElement("div");
  results.className = "je-results";
  const sides = document.createElement("div");
  sides.className = "grid grid-2 je-sides";
  const colA = document.createElement("div");
  const colB = document.createElement("div");
  colA.innerHTML = '<h3>A · ' + escHtml(nameA) + "</h3>";
  colB.innerHTML = '<h3>B · ' + escHtml(nameB) + "</h3>";
  const treeA = document.createElement("div");
  const treeB = document.createElement("div");
  colA.appendChild(treeA);
  colB.appendChild(treeB);
  sides.appendChild(colA);
  sides.appendChild(colB);
  rootEl.appendChild(toolbar);
  rootEl.appendChild(results);
  rootEl.appendChild(sides);

  const expA = initJsonExplorer(treeA, dataA, { hideSearch: true });
  const expB = initJsonExplorer(treeB, dataB, { hideSearch: true });

  function show(q) {
    results.innerHTML = "";
    const query = normQuery(q);
    if (!query) return;
    const seen = new Set();
    const paths = [];
    for (const path of collect(dataA, query).concat(collect(dataB, query))) {
      const id = JSON.stringify(path);
      if (seen.has(id)) continue;
      seen.add(id);
      paths.push(path);
    }
    const rows = paths.map(path => ({
      path,
      a: lookup(dataA, path),
      b: lookup(dataB, path),
    }));
    if (!rows.length) {
      results.innerHTML = '<div class="je-empty">No matches.</div>';
      return;
    }
    const table = document.createElement("table");
    table.className = "je-cmp";
    const shown = rows.slice(0, 80);
    table.innerHTML = "<thead><tr><th>Field</th><th>A</th><th>B</th></tr></thead>";
    const body = document.createElement("tbody");
    for (const row of shown) {
      const tr = document.createElement("tr");
      if (!same(row.a, row.b)) tr.className = "je-diff";
      tr.innerHTML = '<td class="je-path">' + escHtml(pathLabel(row.path)) + "</td>" +
        '<td class="je-val">' + escHtml(preview(row.a)) + "</td>" +
        '<td class="je-val">' + escHtml(preview(row.b)) + "</td>";
      tr.addEventListener("click", () => {
        if (expA && expA.reveal) expA.reveal(row.path);
        if (expB && expB.reveal) expB.reveal(row.path);
      });
      body.appendChild(tr);
    }
    table.appendChild(body);
    const head = document.createElement("div");
    head.className = "je-empty";
    head.textContent = rows.length > shown.length
      ? "Showing first " + shown.length + " fields"
      : shown.length + " field" + (shown.length > 1 ? "s" : "") + " · differing values are emphasized";
    results.appendChild(head);
    results.appendChild(table);
    if (shown.length === 1) {
      if (expA && expA.reveal) expA.reveal(shown[0].path);
      if (expB && expB.reveal) expB.reveal(shown[0].path);
    }
  }

  let timer = null;
  search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => show(search.value), 200);
  });
}

// -------------------------------------------------------------
// UI wiring — drag & drop, error display, and report lifecycle.
// -------------------------------------------------------------
const fileInput = document.getElementById("fileInput");
const fileInputB = document.getElementById("fileInputB");
const landing = document.getElementById("landing");
const landingFooter = document.getElementById("landingFooter");
const report = document.getElementById("report");
const reportBody = document.getElementById("reportBody");
const errorBox = document.getElementById("error");
// Holds the last successfully rendered report so the Download button can
// re-serialize it into a standalone HTML file.
let lastReport = null;
// slotA is the primary run. slotB is optional and switches on comparison.
let slotA = null;
let slotB = null;

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}
function clearError() { errorBox.classList.add("hidden"); }

function fail(err) {
  const msg = (err && err.message) ? err.message : String(err);
  if (/^(Could not|No benchmark|JSON must)/.test(msg)) showError(msg);
  else showError(`Failed to render: ${msg}`);
}

function destroyCharts() {
  if (!window.Chart || !Chart.instances) return;
  Object.values(Chart.instances).forEach(c => { try { c.destroy(); } catch (_) {} });
}

function showSlotNames() {
  const a = document.getElementById("slotAName");
  const b = document.getElementById("slotBName");
  if (a) a.textContent = slotA ? `Loaded: ${slotA.filename}` : "";
  if (b) {
    b.textContent = !slotB ? ""
      : slotA ? `Loaded: ${slotB.filename}`
      : `Loaded: ${slotB.filename} — drop the first JSON to compare`;
  }
}

function readJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)); }
      catch (err) { reject(new Error(`Could not parse JSON: ${err.message}`)); }
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsText(file);
  });
}

function entryFrom(data, filename) {
  const suite = unwrapSuite(data);
  return { data: suite, r: parseReport(suite), filename: filename || "" };
}

const NO_SCORE = "No benchmark score found in profiles.* — is this the right JSON?";

function renderSlots() {
  if (!slotA) {
    showSlotNames();
    return;
  }
  const view = slotB ? renderComparison(slotA, slotB) : renderHTML(slotA.r);
  destroyCharts();
  reportBody.innerHTML = view.html;
  drawCharts(view.specs);
  if (slotB) {
    initCompareJsonExplorer(
      document.getElementById("jsonExplorerCompare"),
      slotA.data, slotB.data,
      runLabel(slotA.r, slotA.filename),
      runLabel(slotB.r, slotB.filename)
    );
  } else {
    initJsonExplorer(document.getElementById("jsonExplorer"), slotA.data);
  }
  landing.classList.add("hidden");
  landingFooter.classList.add("hidden");
  report.classList.remove("hidden");
  const btn = document.getElementById("btnCompare");
  if (btn) btn.textContent = slotB ? "Replace comparison JSON" : "Compare with another JSON";
  lastReport = slotB
    ? {
        r: {
          hostname: `${slotA.r.hostname}_vs_${slotB.r.hostname}`,
          tsStart: slotA.r.tsStart || "",
        },
        html: view.html,
        specs: view.specs,
        dataA: slotA.data,
        dataB: slotB.data,
        labelA: runLabel(slotA.r, slotA.filename),
        labelB: runLabel(slotB.r, slotB.filename),
      }
    : { r: slotA.r, html: view.html, specs: view.specs, data: slotA.data };
  showSlotNames();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyEntry(slot, entry) {
  if (slot === "a") {
    if (!slotB && !Number.isFinite(entry.r.score)) throw new Error(NO_SCORE);
    if (slotB && !reportHasContent(entry.r) && !reportHasContent(slotB.r)) throw new Error(NO_SCORE);
    slotA = entry;
  } else {
    if (slotA && !reportHasContent(slotA.r) && !reportHasContent(entry.r)) throw new Error(NO_SCORE);
    slotB = entry;
  }
  renderSlots();
}

async function loadSlot(slot, file) {
  clearError();
  try {
    applyEntry(slot, entryFrom(await readJson(file), file.name));
  } catch (err) {
    fail(err);
  }
}

function loadPasted(slot, textarea, filename) {
  clearError();
  try {
    const trimmed = (textarea.value || "").trim();
    if (!trimmed) throw new Error("Could not parse JSON: the box is empty.");
    let data;
    try { data = JSON.parse(trimmed); }
    catch (err) { throw new Error(`Could not parse JSON: ${err.message}`); }
    applyEntry(slot, entryFrom(data, filename));
    textarea.value = "";
  } catch (err) {
    fail(err);
  }
}

async function loadPair(fileA, fileB) {
  clearError();
  try {
    const [dataA, dataB] = await Promise.all([readJson(fileA), readJson(fileB)]);
    const entryA = entryFrom(dataA, fileA.name);
    const entryB = entryFrom(dataB, fileB.name);
    if (!reportHasContent(entryA.r) && !reportHasContent(entryB.r)) throw new Error(NO_SCORE);
    slotA = entryA;
    slotB = entryB;
    renderSlots();
  } catch (err) {
    fail(err);
  }
}

function bindDropzone(el, input, slot) {
  input.addEventListener("click", e => e.stopPropagation());
  el.addEventListener("click", e => {
    if (e.target.closest("a, textarea, button, input")) return;
    input.click();
  });
  input.addEventListener("change", e => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (files.length >= 2) loadPair(files[0], files[1]);
    else if (files[0]) loadSlot(slot, files[0]);
  });
  ["dragenter", "dragover"].forEach(ev => el.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation(); el.classList.add("hover");
  }));
  ["dragleave", "drop"].forEach(ev => el.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation(); el.classList.remove("hover");
  }));
  el.addEventListener("drop", e => {
    const files = [...(e.dataTransfer.files || [])];
    if (files.length >= 2) loadPair(files[0], files[1]);
    else if (files[0]) loadSlot(slot, files[0]);
  });
}

bindDropzone(document.getElementById("dropzone"), fileInput, "a");
bindDropzone(document.getElementById("dropzoneB"), fileInputB, "b");

// "Load another file": reset back to the landing/drop-zone state.
document.getElementById("btnNew").addEventListener("click", () => {
  destroyCharts();
  slotA = null;
  slotB = null;
  lastReport = null;
  report.classList.add("hidden");
  landing.classList.remove("hidden");
  landingFooter.classList.remove("hidden");
  reportBody.innerHTML = "";
  fileInput.value = "";
  fileInputB.value = "";
  document.getElementById("fileInputCompare").value = "";
  document.getElementById("pasteInput").value = "";
  document.getElementById("pasteInputB").value = "";
  document.getElementById("pasteReportInput").value = "";
  document.getElementById("pasteReport").classList.add("hidden");
  const btn = document.getElementById("btnCompare");
  if (btn) btn.textContent = "Compare with another JSON";
  showSlotNames();
  clearError();
});

document.getElementById("btnCompare").addEventListener("click", () => {
  const panel = document.getElementById("pasteReport");
  panel.classList.remove("hidden");
  const box = document.getElementById("pasteReportInput");
  box.focus();
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
document.getElementById("btnCompareFile").addEventListener("click", () => {
  document.getElementById("fileInputCompare").click();
});
document.getElementById("fileInputCompare").addEventListener("change", e => {
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  if (f) loadSlot("b", f);
});

document.getElementById("btnPasteA").addEventListener("click", e => {
  e.stopPropagation();
  loadPasted("a", document.getElementById("pasteInput"), "pasted.json");
});
document.getElementById("btnPasteB").addEventListener("click", e => {
  e.stopPropagation();
  loadPasted("b", document.getElementById("pasteInputB"), "pasted comparison");
});
document.getElementById("btnPasteToggle").addEventListener("click", () => {
  document.getElementById("pasteReport").classList.toggle("hidden");
});
document.getElementById("btnPasteReportA").addEventListener("click", () => {
  loadPasted("a", document.getElementById("pasteReportInput"), "pasted.json");
});
document.getElementById("btnPasteReportB").addEventListener("click", () => {
  loadPasted("b", document.getElementById("pasteReportInput"), "pasted comparison");
});

// "Download as standalone HTML": bundle the current report markup, the page
// CSS, Chart.js (CDN), and an inlined drawCharts() call into a single self-
// contained .html file the user can save and share offline.
document.getElementById("btnDownload").addEventListener("click", async () => {
  if (!lastReport) return;
  // Inline the vendored Chart.js so the exported file is fully self-contained
  // (no third-party CDN request — works offline and isn't blocked by Firefox
  // tracking protection / extensions). The `</script` guard prevents the
  // library source from prematurely closing the inline <script> element.
  let chartJS;
  try {
    const libSrc = await fetch("chart.umd.min.js").then(res => {
      if (!res.ok) throw new Error(res.status);
      return res.text();
    });
    chartJS = `<script>${libSrc.replace(/<\/script/gi, "<\\/script")}<\/script>`;
  } catch (_) {
    // Fall back to the CDN if the local copy can't be read for some reason.
    chartJS = `<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"><\/script>`;
  }
  // The live page keeps CSS in viewer.css. The export inlines it so the
  // saved report does not depend on this directory.
  let css = "";
  try {
    css = await fetch("viewer.css").then(res => {
      if (!res.ok) throw new Error(res.status);
      return res.text();
    });
  } catch (_) {
    const style = document.querySelector("style");
    css = style ? style.textContent : "";
  }
  const specsJSON = JSON.stringify(lastReport.specs);
  const chartInit = `(${drawCharts.toString()})(${specsJSON});`;
  // Embed the raw JSON and wire up the explorer(s) in the export too. Escaping
  // "<" prevents the serialized data from closing the inline <script> early.
  const safeJson = obj => JSON.stringify(obj).replace(/</g, "\\u003c");
  let explorerInit = "";
  if (lastReport.dataA !== undefined && lastReport.dataB !== undefined) {
    const labelA = JSON.stringify(lastReport.labelA || "A").replace(/</g, "\\u003c");
    const labelB = JSON.stringify(lastReport.labelB || "B").replace(/</g, "\\u003c");
    explorerInit = `${initJsonExplorer.toString()}\n${initCompareJsonExplorer.toString()}\n`
      + `initCompareJsonExplorer(document.getElementById("jsonExplorerCompare"), ${safeJson(lastReport.dataA)}, ${safeJson(lastReport.dataB)}, ${labelA}, ${labelB});`;
  } else if (lastReport.data !== undefined) {
    explorerInit = `(${initJsonExplorer.toString()})(document.getElementById("jsonExplorer"), ${safeJson(lastReport.data)});`;
  }
  const full = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>HEPscore report · ${esc(lastReport.r.hostname)}</title>${chartJS}<style>${css}</style></head><body><div class="container">${lastReport.html}</div><script>${chartInit}${explorerInit}<\/script></body></html>`;
  const blob = new Blob([full], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (lastReport.r.hostname || "report").replace(/[^a-z0-9._-]+/gi, "_");
  const tsPart = (lastReport.r.tsStart || "").replace(/[-:T]/g, "").slice(0, 15);
  a.download = `hepscore_${safeName}_${tsPart}.html`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
});

// Load the bundled example report (via the link or ?sample=1 in the URL).
function loadSample() {
  clearError();
  fetch("/assets/hepscore-report/sample.json")
    .then(r => r.ok ? r.json() : Promise.reject(new Error("sample not available")))
    .then(data => {
      const entry = entryFrom(data, "sample.json");
      if (!slotB && !Number.isFinite(entry.r.score)) throw new Error(NO_SCORE);
      slotA = entry;
      renderSlots();
    })
    .catch(err => showError(`Could not load example: ${err.message}`));
}

document.getElementById("sampleLink").addEventListener("click", e => {
  e.preventDefault();
  e.stopPropagation();
  loadSample();
});

// Allow deep-linking straight to the example, e.g. viewer.html?sample=1
if (new URLSearchParams(window.location.search).get("sample") === "1") {
  loadSample();
}
