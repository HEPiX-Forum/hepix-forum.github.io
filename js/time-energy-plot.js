(function () {
  'use strict';

  var root = document.getElementById('tes-plot-root');
  var canvas = document.getElementById('tes-plot');
  var dataEl = document.getElementById('tes-data');
  if (!root || !canvas || !dataEl) {
    return;
  }

  function showFallback(message) {
    canvas.innerHTML =
      '<p class="tes-plot__fallback">' + message +
      ' See the reference plot in the section below.</p>';
  }

  if (typeof Plotly === 'undefined') {
    showFallback('The interactive plot could not be loaded.');
    return;
  }

  var rawRows;
  try {
    rawRows = JSON.parse(dataEl.textContent);
  } catch (err) {
    showFallback('The plot data could not be parsed.');
    return;
  }

  var num = function (v) {
    if (v === null || v === undefined || v === '') return null;
    var n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  var rows = rawRows
    .map(function (r) {
      return {
        cpu: r.cpu || '',
        site: r.site || '',
        smtOn: String(r.smt) === '1',
        sockets: r.sockets || '',
        coresPerSocket: r.cores_per_socket || '',
        threadsPerCore: r.threads_per_core || '',
        ncores: r.ncores || '',
        ram: r.ram || '',
        powerPolicy: r.power_policy || '',
        meas: r.meas || '',
        score: num(r.score),
        scorePerNcores: r.score_per_ncores || '',
        spread: r.spread || '',
        powerMean: num(r.power_mean),
        powerStd: num(r.power_std),
        hs23PerW: r.hs23_per_w || '',
        wPerHs23: r.w_per_hs23 || '',
        x: num(r.x),
        y: num(r.y),
        firstDate: r.first_date || '',
        lastDate: r.last_date || ''
      };
    })
    .filter(function (r) {
      return r.x !== null && r.y !== null && r.x > 0 && r.y > 0;
    });

  if (!rows.length) {
    showFallback('No power-reporting configurations are available yet.');
    return;
  }

  var shortName = function (name) {
    if (name.indexOf('Neoverse') !== -1) {
      name = name.split(' ')[0];
    }
    return name
      .replace(' Processor', '')
      .replace('(R)', '')
      .replace('CPU', '')
      .split('@')[0]
      .trim();
  };

  var vendorOf = function (name) {
    var up = name.toUpperCase();
    if (up.indexOf('AMD') !== -1 || up.indexOf('EPYC') !== -1) return 'AMD';
    if (up.indexOf('INTEL') !== -1 || up.indexOf('XEON') !== -1) return 'Intel';
    if (up.indexOf('NEOVERSE') !== -1 || up.indexOf('CORTEX') !== -1 ||
        up.indexOf('ARM') !== -1 || up.indexOf('GRACE') !== -1) return 'ARM';
    return 'Other';
  };

  rows.forEach(function (r) {
    r.model = shortName(r.cpu) + ' , ' + r.sockets;
    r.vendor = vendorOf(r.cpu);
  });

  var PALETTE = [
    '#0284c7', '#dc2626', '#059669', '#7c3aed', '#ea580c',
    '#0891b2', '#c026d3', '#65a30d', '#e11d48', '#2563eb',
    '#b45309', '#0d9488', '#9333ea', '#16a34a', '#db2777'
  ];
  var SYMBOLS = [
    'circle', 'square', 'diamond', 'triangle-up', 'triangle-down',
    'hexagon', 'cross', 'x', 'star', 'pentagon', 'hourglass', 'bowtie'
  ];

  var controls = {
    colorby: document.getElementById('tes-colorby'),
    site: document.getElementById('tes-site'),
    smt: document.getElementById('tes-smt'),
    scale: document.getElementById('tes-scale'),
    search: document.getElementById('tes-search'),
    fit: document.getElementById('tes-fit'),
    reset: document.getElementById('tes-reset'),
    count: document.getElementById('tes-count')
  };

  var sites = rows
    .map(function (r) { return r.site; })
    .filter(function (v, i, a) { return v && a.indexOf(v) === i; })
    .sort();
  sites.forEach(function (s) {
    var opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    controls.site.appendChild(opt);
  });

  var esc = function (v) {
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  var fmt = function (v) {
    return v === null || v === undefined || v === '' ? '&ndash;' : esc(v);
  };

  var hoverFor = function (r) {
    var power = r.powerMean === null ? '&ndash;' :
      esc(r.powerMean) + (r.powerStd !== null ? ' &plusmn; ' + esc(r.powerStd) : '') + ' W';
    return [
      '<b>' + esc(r.cpu) + '</b>',
      'Site: ' + fmt(r.site) + '   |   SMT: ' + (r.smtOn ? 'enabled' : 'disabled'),
      'Layout: ' + fmt(r.sockets) + ' socket(s) &times; ' + fmt(r.coresPerSocket) +
        ' cores, ' + fmt(r.threadsPerCore) + ' thr/core (' + fmt(r.ncores) + ' cores)',
      'RAM: ' + fmt(r.ram) + '   |   Power policy: ' + fmt(r.powerPolicy),
      'HS23 score: ' + fmt(r.score) + '   |   Power: ' + power,
      'HS23/W: ' + fmt(r.hs23PerW) + '   |   W/HS23: ' + fmt(r.wPerHs23),
      'Rel. time to solution: ' + fmt(r.x),
      'Rel. energy to solution: ' + fmt(r.y),
      'Measurements: ' + fmt(r.meas),
      'Measured: ' + fmt(r.firstDate) + ' &rarr; ' + fmt(r.lastDate)
    ].join('<br>') + '<extra></extra>';
  };

  var currentFilter = function () {
    var selectedSites = Array.prototype.slice
      .call(controls.site.selectedOptions)
      .map(function (o) { return o.value; });
    var smtMode = controls.smt.value;
    var query = (controls.search.value || '').trim().toLowerCase();

    return rows.filter(function (r) {
      if (selectedSites.length && selectedSites.indexOf(r.site) === -1) return false;
      if (smtMode === 'on' && !r.smtOn) return false;
      if (smtMode === 'off' && r.smtOn) return false;
      if (query && r.cpu.toLowerCase().indexOf(query) === -1) return false;
      return true;
    });
  };

  var groupKey = function (r) {
    switch (controls.colorby.value) {
      case 'site': return r.site || 'Unknown';
      case 'vendor': return r.vendor;
      case 'smt': return r.smtOn ? 'SMT enabled' : 'SMT disabled';
      default: return r.model;
    }
  };

  var powerLawFit = function (pts) {
    if (pts.length < 3) return null;
    var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(function (p) {
      var lx = Math.log10(p.x), ly = Math.log10(p.y);
      sx += lx; sy += ly; sxx += lx * lx; sxy += lx * ly;
    });
    var denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-12) return null;
    var b = (n * sxy - sx * sy) / denom;
    var logA = (sy - b * sx) / n;
    return { a: Math.pow(10, logA), b: b };
  };

  var buildTraces = function (filtered) {
    var groups = {};
    var order = [];
    filtered.forEach(function (r) {
      var key = groupKey(r);
      if (!groups[key]) {
        groups[key] = [];
        order.push(key);
      }
      groups[key].push(r);
    });

    var traces = order.map(function (key, idx) {
      var pts = groups[key];
      return {
        type: 'scatter',
        mode: 'markers',
        name: key,
        legendgroup: key,
        x: pts.map(function (p) { return p.x; }),
        y: pts.map(function (p) { return p.y; }),
        text: pts.map(hoverFor),
        hovertemplate: '%{text}',
        marker: {
          size: 10,
          color: PALETTE[idx % PALETTE.length],
          symbol: pts.map(function (p) {
            var base = SYMBOLS[idx % SYMBOLS.length];
            return p.smtOn ? base : base + '-open';
          }),
          line: { width: 1.4, color: PALETTE[idx % PALETTE.length] }
        }
      };
    });

    if (controls.fit.checked) {
      var fit = powerLawFit(filtered);
      if (fit) {
        var xs = filtered.map(function (p) { return p.x; });
        var xmin = Math.min.apply(null, xs);
        var xmax = Math.max.apply(null, xs);
        var line = [];
        var steps = 60;
        for (var i = 0; i <= steps; i++) {
          var xv = xmin * Math.pow(xmax / xmin, i / steps);
          line.push(xv);
        }
        traces.push({
          type: 'scatter',
          mode: 'lines',
          name: 'Power-law fit: y = ' + fit.a.toFixed(2) + ' x^' + fit.b.toFixed(2),
          x: line,
          y: line.map(function (xv) { return fit.a * Math.pow(xv, fit.b); }),
          line: { color: '#dc2626', dash: 'dash', width: 2 },
          hoverinfo: 'skip'
        });
      }
    }

    return traces;
  };

  var layout = function () {
    var scale = controls.scale.value;
    return {
      margin: { l: 70, r: 20, t: 20, b: 60 },
      hovermode: 'closest',
      hoverlabel: { align: 'left', bgcolor: '#ffffff', bordercolor: '#e2e8f0' },
      xaxis: {
        title: { text: 'Time to solution (relative)' },
        type: scale === 'log' ? 'log' : 'linear',
        gridcolor: '#e2e8f0',
        zeroline: false
      },
      yaxis: {
        title: { text: 'Energy to solution (relative)' },
        type: scale === 'log' ? 'log' : 'linear',
        gridcolor: '#e2e8f0',
        zeroline: false
      },
      legend: {
        title: { text: 'Legend' },
        orientation: 'v',
        x: 1.02,
        y: 1,
        font: { size: 11 }
      },
      font: { family: 'Inter, sans-serif', color: '#1e293b' },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff'
    };
  };

  var config = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['select2d', 'lasso2d'],
    toImageButtonOptions: {
      filename: 'time_energy_to_solution',
      format: 'png',
      scale: 2
    }
  };

  var rendered = false;
  var render = function () {
    var filtered = currentFilter();
    controls.count.textContent = filtered.length;
    var traces = buildTraces(filtered);
    if (!rendered) {
      Plotly.newPlot(canvas, traces, layout(), config);
      rendered = true;
    } else {
      Plotly.react(canvas, traces, layout(), config);
    }
  };

  ['colorby', 'site', 'smt', 'scale'].forEach(function (id) {
    controls[id].addEventListener('change', render);
  });
  controls.fit.addEventListener('change', render);
  controls.search.addEventListener('input', render);
  controls.reset.addEventListener('click', function () {
    controls.colorby.value = 'model';
    Array.prototype.forEach.call(controls.site.options, function (o) { o.selected = false; });
    controls.smt.value = 'all';
    controls.scale.value = 'log';
    controls.search.value = '';
    controls.fit.checked = true;
    render();
  });

  render();
})();
