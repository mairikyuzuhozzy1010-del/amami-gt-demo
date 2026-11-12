"""Fetch a small daily surface-current subset for Amami and export map JSON."""
import json
import os
from pathlib import Path
import copernicusmarine
import numpy as np

DATASET = "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m"
DATE = "2026-09-15"
OUT = Path("data/amami-currents-2026-09-15.json")
kwargs = dict(
    dataset_id=DATASET,
    variables=["uo", "vo"],
    minimum_longitude=127,
    maximum_longitude=131,
    minimum_latitude=27,
    maximum_latitude=30,
    minimum_depth=0,
    maximum_depth=1,
    start_datetime=DATE + "T00:00:00",
    end_datetime=DATE + "T23:59:59",
)
if os.getenv("COPERNICUSMARINE_SERVICE_USERNAME") and os.getenv("COPERNICUSMARINE_SERVICE_PASSWORD"):
    kwargs["username"] = os.environ["COPERNICUSMARINE_SERVICE_USERNAME"]
    kwargs["password"] = os.environ["COPERNICUSMARINE_SERVICE_PASSWORD"]
ds = copernicusmarine.open_dataset(**kwargs)
u = ds["uo"].isel(time=0, depth=0)
v = ds["vo"].isel(time=0, depth=0)
points = []
for i, lat in enumerate(u.latitude.values):
    for j, lon in enumerate(u.longitude.values):
        east = float(u.values[i, j])
        north = float(v.values[i, j])
        if np.isfinite(east) and np.isfinite(north):
            points.append(dict(date=DATE, lat=round(float(lat), 5), lon=round(float(lon), 5), u=round(east, 5), v=round(north, 5)))
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({"source": "Copernicus Marine", "dataset": DATASET, "date": DATE, "points": points}, ensure_ascii=False), encoding="utf-8")
print(f"Exported {len(points)} points to {OUT}")
