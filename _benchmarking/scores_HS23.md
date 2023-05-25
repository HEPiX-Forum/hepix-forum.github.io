---
title: "HS23 scores"
layout: page
menu: HS23 score table
datatable: true
---

 {% assign table_rows = site.data.HS23scores %}

<br>
<br>
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

<link rel="stylesheet" href="https://cdn.datatables.net/1.13.4/css/jquery.dataTables.css" />
<script src="https://cdn.datatables.net/1.13.4/js/jquery.dataTables.js"></script>
