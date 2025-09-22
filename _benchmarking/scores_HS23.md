---
title: "HS23 scores"
layout: page
menu: HS23 score table
datatable: true
---

 {% assign table_rows = site.data.HS23scores %}

<br>
<br>

Data displayed in the following table are available in csv format in the github repository of [HEPiX-Forum](https://github.com/HEPiX-Forum/hepix-forum.github.io/blob/master/_data/HS23scores.csv)


Starting with **HEP Benchmark Suite version 3**, sites can enrich benchmark results by including **electric power consumption** measurements collected during the benchmark execution.  
For details on how to enable this, see the [official script documentation](https://w3.hepix.org/benchmarking/how_to_run_HS23.html).

Power consumption is measured using the command: `ipmitool dcmi power reading`

**Important note:**  
The values reported by `ipmitool` may differ from those obtained via Power Distribution Units (PDUs).  
Accuracy depends on the server’s hardware and firmware implementation. Therefore, these results should be considered **experimental and approximate**.

### Metrics description

Benchmark result tables include several metrics.  
Only those that are **not immediately self-explanatory** are described below:

- **`# Meas`**  :  The number of independent benchmark measurements performed.

- **`Score/Ncores`** : The performance score normalized by the number of available cores (physical or logical).  
  
- **`sem`** (Standard Error of the Mean) :  A measure of the statistical uncertainty of the score, calculated from multiple runs.

- **`Spread`** : A measure of variability across the benchmark runs, calculated as the relative difference between the 95th and 5th percentiles, normalized by the median.  
  
- **`electric_power_mean`** , **`electric_power_std`**:  For each measurement time series collected during the benchmark run, the **85th percentile** is determined. Mean and std are then evaluated   across all measurement series.

- **`HS23/W`** =  Score / `electric_power_mean`


 
<br>
<br>
<div style="overflow-x: auto;">
  <table id="myTable" class="display">
      {% for row in table_rows %}
          {% if forloop.first %}
              <thead>
              <tr>
                  {% for pair in row %}
                      <th>
                          {{ pair[0] }}
                      </th>
                  {% endfor %}
              </tr>
              </thead>
          {% endif %}
          {% tablerow pair in row %}
              {{ pair[1] }}
          {% endtablerow %}
      {% endfor %}
  </table>
</div>

<link rel="stylesheet" href="https://cdn.datatables.net/1.13.4/css/jquery.dataTables.css" />
<script src="https://cdn.datatables.net/1.13.4/js/jquery.dataTables.js"></script>
