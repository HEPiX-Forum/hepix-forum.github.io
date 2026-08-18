---
title: "Time and Energy to Solution"
layout: page
menu: Time & Energy to Solution
plotly: true
---

# Time and Energy to Solution
{:.no_toc}

{:.no_toc}
* auto-gen TOC:
{:toc}

Starting with **HEP Benchmark Suite v3**, sites can record the **electric power**
consumed while running HEPScore23. Combining the performance score with the
measured power lets us reason about two quantities that matter for procurement
and operations: how long a workload takes (**time to solution**) and how much
energy it consumes (**energy to solution**).

The data behind this page come from the same dataset as the
[HS23 score table]({{ "/benchmarking/scores_HS23.html" | relative_url }}) &mdash;
only the configurations that report electric power are shown.

## Why it matters

- **Quantify the trade-off** between processing speed and energy efficiency across server configurations.
- **Establish a baseline** for cost-benefit analysis that is independent of any single site.
- **Enable full TCO estimates**: individual sites can combine these models with their own (confidential) procurement and electricity costs to compute total cost of ownership internally.

## Interactive plot

Each marker is one server configuration, positioned by its **relative time to
solution** (x) and **relative energy to solution** (y). Both metrics are
normalised to the fastest power-reporting configuration in the dataset, so that
reference sits at (1, 1). **Filled markers have SMT enabled**, open markers have
SMT disabled.

Hover over any point to read its full metadata (CPU, site, RAM, power, HS23
score and the derived metrics). Use the controls to recolour, filter by site or
SMT, search for a CPU, switch between log-log and linear axes, or toggle the
power-law fit. Click legend entries to show or hide groups, and use the toolbar
to zoom, pan, autoscale or download a PNG.

{% include time-energy-plot.html %}

<details class="tes-reference">
<summary>Show static reference plot (HEPiX Spring 2026, Lisbon)</summary>

<p>Static version of this analysis, as presented at the HEPiX Spring 2026
workshop in Lisbon.</p>

<img class="materialboxed responsive-img" style="max-width:900px;width:100%;" src="{{ "/images/time_energy_to_solution.png" | relative_url }}" alt="Relative energy to solution versus relative time to solution for benchmarked server configurations, log-log scale with a power-law fit.">

<p>Source:
<a href="https://indico.cern.ch/event/1598655/contributions/6987963/attachments/3261009/5822434/HEPiX_Lisbon_Benchmarking_giordano_22_04_2026.pdf">HEPiX Spring 2026 Benchmarking Working Group report (D. Giordano, CERN)</a>.</p>

</details>

<!-- **Important note:**
Power consumption is measured with `ipmitool dcmi power reading`. The values
reported by `ipmitool` may differ from those obtained via Power Distribution
Units (PDUs); accuracy depends on the server's hardware and firmware.  -->

## How the metrics are defined

The two metrics are built from a few measured quantities: the number of events
to process (T<sub>Nevt</sub>), throughput (Th, events/second), electric power
(W, Watts) and the HEPScore23 (a throughput proxy). Because throughput is
proportional to HEPScore23, the relative expressions simplify to the HS23 ratios
shown below.

| Comparison | Time to solution | Energy to solution |
|---|---|---|
| **Absolute** (server 0) | T<sub>Nevt</sub> / Th<sub>0</sub> | T<sub>Nevt</sub> &middot; W<sub>0</sub> / Th<sub>0</sub> |
| **Relative to reference** (_j_ vs. 0) | &asymp; 1 / HS23<sub>j</sub> | &asymp; (W<sub>j</sub> / W<sub>0</sub>) &middot; (1 / HS23<sub>j</sub>) |
| **Server-to-server** (_j_ vs. _i_) | HS23<sub>i</sub> / HS23<sub>j</sub> | (W<sub>j</sub> / W<sub>i</sub>) &middot; (HS23<sub>i</sub> / HS23<sub>j</sub>) |

On the plot above, each point uses the *relative to reference* row, with the
reference being the fastest power-reporting configuration in the dataset.
