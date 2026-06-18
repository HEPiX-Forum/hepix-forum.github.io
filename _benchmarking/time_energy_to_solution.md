---
title: "Time and Energy to Solution"
layout: page
menu: Time & Energy to Solution
---

<br>

Starting with **HEP Benchmark Suite v3**, sites can record the **electric power**
measurements while running HEPScore23 via Suite. Combining the performance score 
with the measured power lets us reason about two quantities that
matter for procurement and operations: how long a workload takes (**time to
solution**) and how much energy it consumes (**energy to solution**).

The data behind this page come from the same dataset as the
[HS23 score table](/benchmarking/scores_HS23.html).

### Why it matters

- **Quantify the trade-off** between processing speed and energy efficiency across server configurations.
- **Establish a baseline** for cost-benefit analysis that is independent of any single site.
- **Enable full TCO estimates**: individual sites can combine these models with their own (confidential) procurement and electricity costs to compute total cost of ownership internally.

### The plot

Each marker is one server configuration, positioned by its **relative time to
solution** (x) and **relative energy to solution** (y), both normalised to the
fastest server in the dataset. Filled markers have **SMT enabled**, open markers
have **SMT disabled**. Axes are logarithmic.

<img class="materialboxed responsive-img" style="max-width:900px;width:100%;" src="/images/time_energy_to_solution.png" alt="Relative energy to solution versus relative time to solution for benchmarked server configurations, log-log scale with a power-law fit.">

### How the metrics are defined

The two metrics are built from a few measured quantities:

| Symbol | Meaning |
|--------|---------|
| T<sub>Nevt</sub> | Total number of events to process |
| Th | Throughput (events / second) |
| W | Electric power (Watts) |
| HS23 | HEPScore23 (throughput proxy) |

**1. Absolute metrics (for a base server 0)**

> Time to solution: &nbsp; TtS<sub>0</sub> = T<sub>Nevt</sub> / Th<sub>0</sub>
>
> Energy to solution: &nbsp; EtS<sub>0</sub> = T<sub>Nevt</sub> &middot; W<sub>0</sub> / Th<sub>0</sub>

**2. Relative to a reference (server _j_ vs. server 0)**

Because throughput is proportional to the HEPScore23, the ratios simplify to:

> Relative time to solution: &nbsp; rTtS<sub>j</sub> = TtS<sub>j</sub> / TtS<sub>0</sub> &asymp; 1 / HS23<sub>j</sub>
>
> Relative energy to solution: &nbsp; rEtS<sub>j</sub> = EtS<sub>j</sub> / EtS<sub>0</sub> &asymp; (W<sub>j</sub> / W<sub>0</sub>) &middot; (1 / HS23<sub>j</sub>)

**3. Server-to-server (server _j_ vs. server _i_)**

> Relative time to solution: &nbsp; rTtS<sub>ji</sub> = HS23<sub>i</sub> / HS23<sub>j</sub>
>
> Relative energy to solution: &nbsp; rEtS<sub>ji</sub> = (W<sub>j</sub> / W<sub>i</sub>) &middot; (HS23<sub>i</sub> / HS23<sub>j</sub>)

