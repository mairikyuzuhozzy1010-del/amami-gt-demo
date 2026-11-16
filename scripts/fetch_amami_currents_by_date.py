"""Fetch a small daily surface-current subset for Amami and export map JSON."""
import json
import os
import argparse
from datetime import date, datetime, timezone
from pathlib import Path
import copernicusmarine
import numpy as np

DATASET = "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m"
parser = argparse.ArgumentParser()
parser.add_argument("day", type=date.fromisoformat)
args = parser.parse_args()
if args.day > datetime.now(timezone.utc).date():
    parser.error("future dates are not archived")
DATE = args.day.isoformat()
OUT = Path(f"data/amami-currents-{DATE}.json")
if OUT.exists():
    print(f"Preserving existing archive: {OUT}")
    raise SystemExit(0)
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
if ds.sizes.get("time", 0) != 1 or str(ds.time.values[0])[:10] != DATE:
    raise ValueError("Requested date was not returned")
u = ds["uo"].isel(time=0, depth=0)
v = ds["vo"].isel(time=0, depth=0)
u_values, v_values = u.values, v.values
points = []
for i, lat in enumerate(u.latitude.values):
    for j, lon in enumerate(u.longitude.values):
        east = float(u_values[i, j])
        north = float(v_values[i, j])
        if np.isfinite(east) and np.isfinite(north):
            points.append(dict(date=DATE, lat=round(float(lat), 5), lon=round(float(lon), 5), u=round(east, 5), v=round(north, 5)))
if not points:
    raise ValueError("No finite current data returned")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({"source": "Copernicus Marine", "dataset": DATASET, "date": DATE, "retrieved_at_utc": datetime.now(timezone.utc).isoformat(), "time_basis": "UTC daily model mean", "points": points}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Exported {len(points)} points to {OUT}")
