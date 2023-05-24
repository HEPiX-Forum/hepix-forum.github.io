---
title: How to Run HEPScore23 Benchmark
layout: page
menu: How to run HS23
---

# How to Run HEPScore23 Benchmark
{:.no_toc}

{:.no_toc}
* auto-gen TOC:
{:toc}

This document provides instructions on how to execute the HEPScore23 benchmark.

## Requirements

It is crucial that the server is fully dedicated to the benchmarking activity during the run, to ensure accurate measurements and prevent potential errors.

The server must have a minimum hardware configuration and include the following packages:
   * Container engine Apptainer (version 1.1.6 or higher);
   * Python version 3.9 or higher;
   * python3-pip;
   * git

The user will need pip and git to install HEPScore23 as a Python package.

Hardware requirements:
   * A disk space proportional to the number of available cores on the server (1 GB per logical core) is necessary to temporarily store the results;
   * The server must have at least 2GB of RAM per logical core;
   * ulimit configuration (see details below)


## Run the HEP Benchmark Suite

While it is possible to install HEPScore23 manually, it is recommended to use the HEP Benchmark Suite alongside HEPScore23 to include in the benchmark report metadata about the server's running conditions. The metadata includes details about the server's CPU, RAM, disks, IP addresses, and other relevant information. The HEP Benchmark Suite can be installed using pip and git.

A [bash script](https://gitlab.cern.ch/hep-benchmarks/hep-benchmark-suite/-/raw/master/examples/hepscore/run_HEPscore.sh) has been developed  to streamline the installation and running process. This script provides a fully comprehensive running procedure and enables the system administrator to install the HEP Benchmark Suite and HEPScore23, run the HEP Benchmark Suite, which in turn extracts the necessary metadata from the server, executes HEPScore23 and produces a final output document. 

The HEP Benchmark Suite also offers the added benefit of being able to submit the benchmark results to the WLCG Benchmark DB (based on OpenSearch/ElasticSearch). To accomplish this, a valid X509 certificate (service, robot, user) must be available, and the certificate's DN must be authorized for the publication of the results.
To declare the DN users should open a [GGUS tickets](https://ggus.eu/?mode=ticket_submit). 

#### DN extraction
To extract the DN from the certificate  run:

```sh
openssl x509 -noout -in user.crt.pem -subject -nameopt RFC2253
```

which should output something similar to:
```
subject=CN=Name Surname,CN=123456,CN=username,OU=Users,OU=Organic Units,DC=cern,DC=ch
```

#### Script mandatory parameters
To use the bash script, users will need to provide a few mandatory custom parameters to declare the specific WLCG site on which the benchmark is running and to publish the results. 
The **SITE** parameter is essential for ensuring that the results are accurately attributed to the correct site when integrated into the WLCG Benchmark DB.

To run the script, users can use the following command line. 
```sh
./run_HEPscore.sh -s SITE -p -c ./cert.pem -k ./key.pem
```

By default, the script will use the current directory to create a working directory where all necessary files will be stored, including container images, benchmark outputs, and temporary workload results. The working directory can be modified using the parameter **-w target_folder**.

During the execution the script reports the stdout of the HEP Benchmark Suite. If the execution completes successfully, it will print at the end information such as

{% raw %}
[INFO] Successfully completed all requested benchmarks<br>
=========================================================<br>
BENCHMARK RESULTS FOR \<hostname\><br>
=========================================================<br>
Suite start: *start_date*<br>
Suite end:   *end_date*<br>
Machine CPU Model: *name*<br>
HEPscore Benchmark = *value*<br>
{% endraw %}

Using the bash script ensures that the entire process is performed correctly, and it is recommended that users utilize it when installing and running HEPScore23.

## Troubleshooting
### ulimit configuration on CENTOS7 (reason and procedure)
A workload of the HEPScore23 benchmark uses a multi-service approach for the reconstruction and starts multiple processes per core that stay idle waiting for their turn of processing. For machines with more than 100 CPU cores, this translates into more than 4096 processes, which is the default for normal (non-root) users on CentOS7. Therefore, HEPScore23 should run as root, or the user should be able to start more processes. This can be set with ulimit on CentOS7 by adding the line

```sh
echo "benchmark  soft nproc unlimited" >> /etc/security/limits.d/20-nproc.conf 
```

It is necessary to start a new shell session after that change before running HEPScore23.

### CVMFS (as image repository) configuration 
Although it’s not part of the standard configuration, it is possible to get the container images for the benchmark from CVMFS instead of from the gitlab registry. Some workloads of the HEPScore23 benchmark access several files in parallel on /cvmfs, about 200 files per CPU core. For bigger machines (more than 60 cores), it is necessary to adjust the CVMFS config and set the maximal number of open files (CVMFS_NFILES in /etc/cvmfs/default.local) value to about 200 times the number of cores. The new value is active after a remount of the CVMFS repository on the machine.
