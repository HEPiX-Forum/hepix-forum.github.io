#!/usr/bin/env python3
"""
Regenerate the "Time and Energy to Solution" plot for the HEPiX benchmarking page.

It reads the published HS23scores.csv, keeps the configurations that report
electric power, computes the relative time-to-solution and energy-to-solution
(both normalised to the fastest server in the set), and produces a log-log
scatter with a power-law fit.

Usage:
    python make_plot.py                          # use repo _data/HS23scores.csv
    python make_plot.py path/to/HS23scores.csv   # use a specific CSV
    python make_plot.py URL                       # fetch from a URL

Output: images/time_energy_to_solution.png  (written into the site repo)

Dependencies: pandas, numpy, matplotlib (no scipy needed).
Derived from the HS23_Watt notebook (D. Giordano, CERN).
"""

import os
import sys
from datetime import date

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.lines as mlines
import matplotlib.ticker as ticker

# Repo paths (this file lives in scripts/time_energy_to_solution/)
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_CSV = os.path.join(REPO_ROOT, "_data", "HS23scores.csv")
OUTFILE = os.path.join(REPO_ROOT, "images", "time_energy_to_solution.png")

# IPMI -> PDU compensation factor applied to CERN (non-Neoverse) servers,
# consistent with the HS23 score table.
IPMI_TO_PDU = 0.70


def shorten_name(name):
    if "Neoverse" in name:
        name = name.split(" ")[0].strip()
    return (name.replace(" Processor", "").replace("(R)", "")
                .replace("CPU", "").split("@")[0].strip())


def load_data(path_or_url):
    df = pd.read_csv(path_or_url)
    # keep only rows that reported power (HS23/W is populated)
    df = df.dropna(subset=["HS23/W"]).sort_values(by="electric_power_mean")

    # CERN IPMI -> PDU correction (exclude Neoverse)
    mask = (df["Site"] == "CERN") & (~df["CPU"].str.contains("Neoverse"))
    df.loc[mask, "HS23/W"] = df.loc[mask, "HS23/W"] * IPMI_TO_PDU
    df.loc[mask, "electric_power_mean"] = df.loc[mask, "electric_power_mean"] / IPMI_TO_PDU
    df.loc[mask, "electric_power_std"] = df.loc[mask, "electric_power_std"] / IPMI_TO_PDU

    df["CPU"] = df["CPU"].apply(shorten_name)

    # W per unit score and inverse score (time proxy)
    df["W/HS23"] = 1.0 / df["HS23/W"]
    df["1/HS23"] = 1.0 / df["Score"]

    # normalise to the fastest server (smallest 1/HS23 == highest Score)
    min_1_hs23 = df["1/HS23"].min()
    min_w_hs23 = df.loc[df["1/HS23"] == min_1_hs23, "W/HS23"].min()
    df["relative_1/HS23"] = df["1/HS23"] / min_1_hs23
    df["relative_W/HS23"] = df["W/HS23"] / min_w_hs23

    # label = CPU model + number of sockets
    df["aggr"] = df["CPU"] + " , " + df["# Sockets"].astype(str)
    return df


def power_law_fit(x, y):
    """Least-squares power-law fit y = a * x^b in *linear* residual space.

    This matches the original notebook (scipy.optimize.curve_fit). When scipy is
    not installed, it falls back to a pure-numpy Levenberg-Marquardt solver that
    yields the same result. Note: fitting in linear space (rather than log space)
    lets the slow, high-x machines weigh more, which is what the notebook does.
    """
    def model(xx, a, b):
        return a * xx ** b

    try:
        from scipy.optimize import curve_fit
        popt, _ = curve_fit(model, x, y, p0=[1.0, -1.0], maxfev=10000)
        return float(popt[0]), float(popt[1])
    except ImportError:
        pass

    # Pure-numpy Levenberg-Marquardt, seeded from a log-log estimate for stability.
    b, log_a = np.polyfit(np.log10(x), np.log10(y), 1)
    a = 10.0 ** log_a
    cost = lambda a, b: np.sum((model(x, a, b) - y) ** 2)
    c, lam = cost(a, b), 1e-3
    for _ in range(500):
        f = model(x, a, b)
        r = f - y
        J = np.vstack([x ** b, a * (x ** b) * np.log(x)]).T
        JTJ, g = J.T @ J, J.T @ r
        while True:
            d = np.linalg.solve(JTJ + lam * np.diag(np.diag(JTJ)), g)
            na, nb = a - d[0], b - d[1]
            nc = cost(na, nb)
            if nc < c:
                a, b, c, lam = na, nb, nc, max(lam / 3, 1e-12)
                break
            lam *= 10
            if lam > 1e12:
                return a, b
        if np.linalg.norm(d) < 1e-10:
            break
    return a, b


def make_plot(df, outfile=OUTFILE):
    x_col, y_col = "relative_1/HS23", "relative_W/HS23"
    fig, ax = plt.subplots(figsize=(11, 8))

    marker_shapes = ["o", "s", "D", "^", "v", "h", "P", "X", "*", "H"]
    colors = ["black", "red", "blue", "green", "purple", "orange", "brown", "gray"]

    hue_values = list(df["aggr"].unique())
    style = {}
    for i, val in enumerate(hue_values):
        style[val] = {"marker": marker_shapes[i % len(marker_shapes)],
                      "color": colors[(i // len(marker_shapes)) % len(colors)]}

    for _, row in df.iterrows():
        st = style[row["aggr"]]
        face = st["color"] if row["SMT enabled"] == 1 else "none"
        ax.plot(row[x_col], row[y_col], marker=st["marker"], linestyle="none",
                markersize=8, color=st["color"], markerfacecolor=face)

    ax.set_xlabel("Time to solution (relative)")
    ax.set_ylabel("Energy to solution (relative)")
    ax.grid(True, which="both", linestyle="--", linewidth=0.5)

    for axis, setscale in ((ax.xaxis, ax.set_xscale), (ax.yaxis, ax.set_yscale)):
        setscale("log")
        axis.set_major_locator(ticker.LogLocator(base=10.0, numticks=100))
        axis.set_minor_locator(ticker.LogLocator(base=10.0, subs="all", numticks=100))
        axis.set_major_formatter(ticker.ScalarFormatter())

    # power-law fit: y = a * x^b
    fit = df[(df[x_col] > 0) & (df[y_col] > 0)]
    a_fit, b_fit = power_law_fit(fit[x_col].values, fit[y_col].values)
    xs = np.linspace(fit[x_col].min(), fit[x_col].max(), 100)
    ax.plot(xs, a_fit * xs ** b_fit, color="red", linestyle="--")
    fit_label = f"Power Law Fit: y = {a_fit:.2f}x^{b_fit:.2f}"

    handles = [
        mlines.Line2D([], [], color="black", marker="s", linestyle="None",
                      markerfacecolor="black", markersize=8, label="SMT Enabled"),
        mlines.Line2D([], [], color="black", marker="s", linestyle="None",
                      markerfacecolor="none", markersize=8, label="SMT Disabled"),
        mlines.Line2D([0], [0], color="gray", linestyle="-", linewidth=0.5, label=""),
    ]
    for val in hue_values:
        st = style[val]
        handles.append(mlines.Line2D([], [], color=st["color"], marker=st["marker"],
                                     linestyle="None", markerfacecolor=st["color"],
                                     markersize=8, label=str(val)))
    handles.append(mlines.Line2D([], [], color="red", linestyle="--", label=fit_label))
    handles.append(mlines.Line2D([], [], color="none", marker="None", linestyle="None",
                                 label=f"Date: {date.today():%Y-%m-%d}"))

    ax.legend(handles=handles, title="Legend", bbox_to_anchor=(1.05, 1), loc="upper left")
    fig.tight_layout()
    os.makedirs(os.path.dirname(outfile), exist_ok=True)
    fig.savefig(outfile, dpi=150, bbox_inches="tight")
    print(f"Wrote {outfile}  ({len(df)} configurations, fit {fit_label})")


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    make_plot(load_data(src))
