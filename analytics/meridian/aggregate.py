"""Season-level summaries of forecast output.

    -- Archive (output) side --

Turns the daily rows of a forecast into the handful of season numbers the
reporting subsystem and the front-ends actually show: yield, peak leaf
area and when it happened, total ET and drainage, the soil-water
envelope, and a count of water-stressed days.  Reporting used to compute
these itself by re-reading forecast_daily, which meant the definition of
"peak LAI" lived in two places; this module (2023, newer maintainer) is
now the single source.

It can summarise either a freshly parsed ForecastResult (during a run) or
rows read back out of the store (after the fact), so the arithmetic is
defined once over a plain sequence of DailyRow.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Sequence

from .errors import AggregateError
from .results import DailyRow, ForecastResult, SeasonSummary
from .store import Store

# A day counts as water-stressed when the growth routine would have
# throttled assimilation.  GROWTH applies full stress below half of
# profile capacity (MRD-204 notes WATBAL and GROWTH disagree on how that
# fraction is computed; we report on soil water directly and stay out of
# that fight -- this is a reporting flag, not a model input).
STRESS_SW_FRACTION = 0.5


def _doy_month(doy: int, year: int) -> int:
    """Approximate calendar month for a day-of-year (non-leap fallback).

    Reporting groups ET by month; exact leap handling is not worth a
    dependency here, and the model's DOYs are within a single season.
    """
    import datetime as _dt
    try:
        d = _dt.date(year, 1, 1) + _dt.timedelta(days=doy - 1)
        return d.month
    except (ValueError, OverflowError):
        return 0


def summarize_rows(stnid: str, year: int, yield_t: float,
                   ndays: int, rows: Sequence[DailyRow]) -> SeasonSummary:
    """Compute a SeasonSummary from daily rows.  Pure arithmetic."""
    if not rows:
        raise AggregateError("no daily rows to summarise",
                             stnid=stnid, year=year)

    peak_lai = -1.0
    peak_lai_doy = -1
    total_et = 0.0
    total_drain = 0.0
    min_sw = float("inf")
    max_sw = float("-inf")
    sw_sum = 0.0
    sw_max_seen = max(r.sw for r in rows)
    stress_threshold = sw_max_seen * STRESS_SW_FRACTION
    stress_days = 0
    emergence_doy: Optional[int] = None
    senescence_doy: Optional[int] = None
    final_biomass = rows[-1].biom
    monthly_et: Dict[int, float] = {}

    prev_lai = 0.0
    for r in rows:
        if r.lai > peak_lai:
            peak_lai = r.lai
            peak_lai_doy = r.doy
        total_et += r.et
        total_drain += r.drain
        min_sw = min(min_sw, r.sw)
        max_sw = max(max_sw, r.sw)
        sw_sum += r.sw
        if r.sw < stress_threshold:
            stress_days += 1
        # Emergence: first day LAI leaves zero.  Senescence: LAI returns
        # to (near) zero after having been positive.
        if emergence_doy is None and r.lai > 0.0:
            emergence_doy = r.doy
        if emergence_doy is not None and prev_lai > 0.0 and r.lai == 0.0 \
                and senescence_doy is None:
            senescence_doy = r.doy
        month = _doy_month(r.doy, year)
        monthly_et[month] = monthly_et.get(month, 0.0) + r.et
        prev_lai = r.lai

    mean_sw = sw_sum / len(rows)

    return SeasonSummary(
        stnid=stnid,
        year=year,
        yield_t=yield_t,
        ndays=ndays,
        peak_lai=round(peak_lai, 3),
        peak_lai_doy=peak_lai_doy,
        final_biomass=round(final_biomass, 1),
        total_et=round(total_et, 2),
        total_drainage=round(total_drain, 2),
        min_soil_water=round(min_sw, 2),
        max_soil_water=round(max_sw, 2),
        mean_soil_water=round(mean_sw, 2),
        water_stress_days=stress_days,
        emergence_doy=emergence_doy,
        senescence_doy=senescence_doy,
        monthly_et={k: round(v, 2) for k, v in sorted(monthly_et.items())},
    )


def summarize_result(result: ForecastResult) -> SeasonSummary:
    """Summarise a freshly parsed forecast (during a run)."""
    return summarize_rows(result.stnid, result.year, result.yield_t,
                          result.ndays, result.rows)


def summarize_stored(store: Store, stnid: str, year: int) -> SeasonSummary:
    """Summarise a forecast already persisted in the store (after the fact)."""
    fc = store.get_forecast(stnid, year)
    if fc is None:
        raise AggregateError("no stored forecast to summarise",
                             stnid=stnid, year=year)
    rows = store.daily_rows(stnid, year)
    return summarize_rows(stnid, year, fc.yield_t, fc.ndays, rows)


def summarize_all(store: Store) -> List[SeasonSummary]:
    """Summarise every stored forecast, ordered by station then year."""
    summaries: List[SeasonSummary] = []
    for fc in store.list_forecasts():
        rows = store.daily_rows(fc.stnid, fc.year)
        if not rows:
            continue
        summaries.append(
            summarize_rows(fc.stnid, fc.year, fc.yield_t, fc.ndays, rows))
    return summaries
