---
title: "HS23 scores from WLCG"
layout: page
menu: HS23 scores from WLCG
datatable: true
---

 {% assign table_rows = site.data.HS23tableWLCG %}

<br>
<br>

Data displayed in the following table are available in csv format in the github repository of [HEPiX-Forum](https://github.com/HEPiX-Forum/hepix-forum.github.io/blob/master/_data/HS23tableWLCG.csv)

### About This Data

The table below presents HS23 benchmark scores collected from benchmarking jobs running across the Worldwide LHC Computing Grid (WLCG) infrastructure since August 2023. These measurements represent **real-world production performance** as observed in operational computing environments.

**Key characteristics:**
- Data are aggregated by CPU model to provide statistical representation of performance across multiple sites
- Site identities are not disclosed to maintain operational privacy while sharing valuable performance metrics
- Each entry includes statistical measures (mean score, standard error, spread) across multiple measurements
- Power consumption data (where available) enables efficiency comparisons via the HS23/W metric

**Use cases:**
This data is particularly valuable for comparing production performance observed on WLCG with reference benchmarks reported by sites during dedicated testing. Sites can use this information to validate their own performance metrics and identify potential optimization opportunities.

<br>
<br>
<div class="datatable-container">
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

