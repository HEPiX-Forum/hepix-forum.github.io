---
title: Benchmarking WG
menu: Benchmarking
layout: page
redirect_from: /benchmarks/index.html
---

# {{ page.title }}

HS06 is the HEP-wide benchmark for measuring CPU performance. It has been developed by the HEPiX Benchmarking Working Group in order to replace the outdated "kSI2k" metric.

The goal is to provide a consistent and reproducible CPU benchmark to describe experiment requirements, lab commitments, existing compute resources, as well as procurements of new hardware.

HS06 is based on the all_cpp benchmark subset (bset) of the widely used, industry standard SPEC® CPU2006 benchmark suite. This bset matches the percentage of floating point operations which we have observed in batch jobs (~10%), and it scales perfectly with the experiment codes.

HS06 is the official CPU performance metric to be used by WLCG sites since 1 April 2009.

Although the HS06 benchmark was initially designed to meet the requirements of High Energy Physics (HEP) labs, it is by now widely used also by other communities.


## Tables of HS06 results

### Default system configurations

  * [SL7 x86_64 (gcc-4.8.x)](/benchmarking/sl7-x86_64-gcc48.html)
  * [SL6 x86_64 (gcc-4.4.x)](/benchmarking/sl6-x86_64-gcc44.html)

### Other system configurations (for academic use)

  * [SL6 x86_64 (gcc-4.8.x)](/benchmarking/sl6-x86_64-gcc48.html)
  * [SL5 x86_64 (gcc-4.4.6)](/benchmarking/sl5-x86_64-gcc446.html)
  * [SL5 x86_64 (gcc-4.3.2)](/benchmarking/sl5-x86_64-gcc432.html)

### Retired configurations

  * [SL5 x86_64 (gcc-4.1.2)](/benchmarking/sl5-x86_64-gcc412.html)
  * [SL4 x86_64 (gcc-3.4.6)](/benchmarking/sl4-x86_64-gcc346.html)
  * [SL4 i386 (gcc-3.4.6)](/benchmarking/sl4-i386-gcc346.html)

## How to run the benchmark

  * See the [dedicated page](/benchmarking/how_to_run_hs06.html)

----

SPEC® is a registered trademark of the Standard Performance Evaluation Corporation (SPEC), [www.spec.org](http://www.spec.org).
