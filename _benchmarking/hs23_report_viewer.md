---
title: HS23 Report Viewer
layout: page
menu: HS23 Report Viewer
description: |
  Drop a HEPscore23 result JSON onto this page and get an interactive report
  with the score, score per core, score per watt, plugin time series and
  per-workload breakdown. Everything is rendered in your browser; nothing is
  uploaded.
---

# {{ page.title }}

{{ page.description }}

<p class="sub" style="margin: 8px 0 16px; color: #586069;">
  Need the JSON? Follow the
  <a href="{{ site.baseurl }}/benchmarking/how_to_run_HS23.html">How to run HS23</a>
  page to produce a <code>bmkrun_report.json</code> / <code>hepscore_result.json</code>.
</p>

<p style="margin: 8px 0 20px;">
  <a href="{{ site.baseurl }}/assets/hepscore-report/viewer.html"
     target="_blank" rel="noopener"
     class="btn waves-effect waves-light grey lighten-1"
     style="text-transform: none;">
    Open viewer in a new tab
  </a>
  &nbsp;
  <a href="{{ site.baseurl }}/assets/hepscore-report/sample.json"
     download
     class="btn waves-effect waves-light grey lighten-2 grey-text text-darken-3"
     style="text-transform: none;">
    Download the example JSON
  </a>
</p>

<iframe
  src="{{ site.baseurl }}/assets/hepscore-report/viewer.html"
  title="HEPscore23 report viewer"
  style="width: 100%; min-height: 900px; height: calc(100vh - 180px);
         border: 1px solid #e1e4e8; border-radius: 8px; background: #f6f8fa;"
  loading="lazy">
</iframe>

<p class="sub" style="margin-top: 14px; color: #586069; font-size: 13px;">
  This viewer runs entirely client-side. Use the example JSON to preview the
  report layout, or load your own <code>hepscore_result.json</code> after the
  benchmark finishes.
</p>
