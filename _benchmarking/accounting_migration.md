---
title: Accounting procedures
layout: page
menu: Accounting
---

# Accounting procedures
{:.no_toc}

{:.no_toc}
* auto-gen TOC:
{:toc}


The migration strategy for the accounting side is detailed by the Accounting TF in this [document](https://twiki.cern.ch/twiki/bin/view/LCG/ChangesForHEPscore). This strategy involves implementing software changes on the site side as well as  APEL, EGI portal, WAU sides. To streamline the process and minimize the number of changes, several strategic approaches have been discussed within the WLCG collaboration, in particular at the Lancaster Workshop. These approaches have been endorsed by the WLCG Management Board during the [December 20th, 2022 meeting](https://wlcg-docs.web.cern.ch/boards/MB/Minutes/2022/MB-Minutes-20221220-2.pdf).

To summarize, the transition from HS06 to HEPScore23 should be gradual and seamless. This will be achieved through the following measures:
The HEPScore23 benchmark will use the same scale factor as HS06, which is fixed on a reference server.

Sites are only expected to benchmark new resources with HEPScore23. Old servers do not need to be re-benchmarked for accounting purposes. 
This ensures that the installed capacity pledged by the sites will remain unchanged.
Sites are free to re-benchmark their servers if they wish, but they are not required to submit this information to the accounting portal. 
However, they can still use the HEP Benchmark Suite to publish their results in the benchmark database, which is separate from the accounting infrastructure.

How do these procedures reflect what is done in a given WLCG site?
Below we describe how to calculate the benchmarking factor depending on site configuration and how the report would look like in accordance with the new specification.

### Example1: Site with a different cluster per CPU model

{:class="striped"}
<table><tbody>
<tr>
<th colspan="1" ><p><span>Cluster</span></p></th><th colspan="1" ><p><span>Model</span></p></th><th colspan="1" ><p><span>Num</span></p></th><th colspan="1" ><p><span>Num of logical threads</span></p></th><th colspan="2"><p><span>Score per node</span></p></th><th colspan="2" ><p><span>Total score</span></p></th><th colspan="1" ><p><span>Score for accounting</span></p></th>
</tr>
<tr>
<th colspan="1" ><p><span></span></p></th><th colspan="1" ><p><span></span></p></th><th colspan="1" ><p><span></span></p></th><th colspan="1" ><p><span></span></p></th><th colspan="1" rowspan="1"><p><span>HS06 </span></p></th><th colspan="1" rowspan="1"><p><span>HS23</span></p></th><th colspan="1" rowspan="1"><p><span>HS06 </span></p></th><th colspan="1" rowspan="1"><p><span>HS23</span></p><th colspan="1" ><p><span></span></p></th></th>
</tr>
<tr>
<td colspan="1" rowspan="1"><p><span>Old</span></p></td><td colspan="1" rowspan="1"><p><span>2x AMD EPYC 7702 64-core</span></p></td><td colspan="1" rowspan="1"><p><span>29</span></p></td><td colspan="1" rowspan="1"><p><span>256</span></p></td><td colspan="1" rowspan="1"><p><span>2643</span></p></td><td colspan="1" rowspan="1"><p><span>2546</span></p></td><td colspan="1" rowspan="1"><p><span>76647</span></p></td><td colspan="1" rowspan="1"><p><span>73834</span></p></td><td colspan="1" rowspan="1"><p><span>76647</span></p></td>
</tr>
<tr>
<td colspan="1" rowspan="1"><p><span>New</span></p></td><td colspan="1" rowspan="1"><p><span>2x AMD EPYC 7742 64-Core</span></p></td><td colspan="1" rowspan="1"><p><span>188</span></p></td><td colspan="1" rowspan="1"><p><span>256</span></p></td><td colspan="1" rowspan="1"><p><span>2917</span></p></td><td colspan="1" rowspan="1"><p><span>2972</span></p></td><td colspan="1" rowspan="1"><p><span>548396</span></p></td><td colspan="1" rowspan="1"><p><span>558736</span></p></td><td colspan="1" rowspan="1"><p><span>558736</span></p></td>
</tr>
<tr>
<td colspan="1" rowspan="1"><p><span>Total</span></p></td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1"><p><span>632570</span></p></td><td colspan="1" rowspan="1"><p><span>635383</span></p></td>
</tr>
</tbody></table>


In this scenario new resources won’t be mixed with old resources. 

Suppose the site has 2 separate clusters, each cluster consisting of servers with the same CPU model. Labels “Old” and “New” identify the clusters included in production before 1st of April 2023 (Old) or after 1st of April 2023 (New). The table below summarizes the HS06 and HS23 scores per node and for the total installation.

Therefore, if the same benchmark would be used for both clusters, the site would provide 625043 HS06 or 632570 HEPScore23, but following the  agreement to translate the HS06 score of the old machines with 1:1 ratio, the final total score accounted for that site is **635383**.

For the accounting reporting the same input numbers and configuration translate into the following reported benchmarking factor

{:class="striped"}
<table><tbody><tr>
<th colspan="1" ><p><span>Cluster</span></p></th><th colspan="1" ><p><span>Model</span></p></th><th colspan="1" ><p><span>Num</span></p></th><th colspan="1" ><p><span>Num of logical threads</span></p></th><th colspan="2" rowspan="1"><p><span>Score per node</span></p></th><th colspan="1" ><p><span>Benchmarking factor <br>(score per 1 processor core)</span></p></th>
</tr><tr>
<th colspan="1" ><p><span></span></p></th><th colspan="1" ><p><span></span></p></th><th colspan="1" ><p><span></span></p></th><th colspan="1" ><p><span></span></p></th><th colspan="1" rowspan="1"><p><span>HS06 </span></p></th><th colspan="1" rowspan="1"><p><span>HS23</span></p></th><th colspan="1" ><p><span></span></p></th>
</tr><tr>
<td colspan="1" rowspan="1"><p><span>Old</span></p></td><td colspan="1" rowspan="1"><p><span>2x AMD EPYC 7702 64-core</span></p></td><td colspan="1" rowspan="1"><p><span>29</span></p></td><td colspan="1" rowspan="1"><p><span>256</span></p></td><td colspan="1" rowspan="1"><p><span>2643</span></p></td><td colspan="1" rowspan="1"><p><span>2546</span></p></td><td colspan="1" rowspan="1"><p><span>2643/256=10.32</span></p></td>
</tr><tr>
<td colspan="1" rowspan="1"><p><span>New</span></p></td><td colspan="1" rowspan="1"><p><span>2x AMD EPYC 7742 64-Core</span></p></td><td colspan="1" rowspan="1"><p><span>188</span></p></td><td colspan="1" rowspan="1"><p><span>256</span></p></td><td colspan="1" rowspan="1"><p><span>2917</span></p></td><td colspan="1" rowspan="1"><p><span>2972</span></p></td><td colspan="1" rowspan="1"><p><span>2972/256=11.6</span></p></td>
</tr></tbody></table>



Since resources are not mixed  they are accessible through different CEs. In this case in accordance with the new accounting record specification the job accounting records will look like:

For old resources


```sh
APEL-summary-job-message: v0.4
Site: SOME-SITE
SubmitHost: <old_cluster_ce>
Month: 4
Year: 2023
GlobalUserName: <...>
WallDuration: 47248
CpuDuration: 46871
Processors: 1
NumberofJobs: 3
InfrastructureType: grid
EarliestStartTime: ...
LatestEndTime: ...
ServiceLevel: {hepspec: 10.32}
```

For new resources


```sh
APEL-summary-job-message: v0.4
Site: SOME-SITE
SubmitHost: <new_cluster_ce>
Month: 4
Year: 2023
GlobalUserName: <...>
WallDuration: 47248
CpuDuration: 46871
Processors: 1
NumberofJobs: 3
InfrastructureType: grid
EarliestStartTime: ...
LatestEndTime: ...
ServiceLevel: {HEPscore23: 11.6}
```

If using the APEL client, HEPscore will be configurable locally in the new version of the client in its client.cfg file. Example of the spec_updater section shown below:

```sh
site_name = MY-SITENAME
manual_spec1 = <old_cluster_ce>, hepspec, 10.32
manual_spec2 = <new_cluster_ce>, HEPscore23, 11.6
```


### Example2: A site with a single cluster mixing all CPU models

We take exactly the same set of HW as in the previous example, just resources are all mixed.
Then first we need to calculate the contribution of both sets of resources in the overall capacity.
Fraction of old resources:
76647/635383=0.12

Correspondingly , fraction of new resources is 0.88

Benchmarking factor for the mixed cluster will be  10.32\*0.12 + 11.6\*0.88=11.45

The accounting job record will look like:


```sh
APEL-summary-job-message: v0.4
Site: SOME-SITE
SubmitHost: <old_cluster_ce>
Month: 4
Year: 2023
GlobalUserName: <...>
WallDuration: 47248
CpuDuration: 46871
Processors: 1
NumberofJobs: 3
InfrastructureType: grid
EarliestStartTime: ...
LatestEndTime: ...
ServiceLevel: {HEPscore23: 11.45}
```

Please, pay attention, that in case we have a cluster with mixed resources having part of them benchmarked with HEPscore23, we do report as if the whole cluster has been benchmarked with HEPscore23.

If using the APEL client, HEPscore will be configurable locally in the new version of the client in its client.cfg file. Example of the spec_updater section shown below:
```sh
site_name = MY-SITENAME
manual_spec1 = <new_cluster_ce>, HEPscore23, 11.45
```