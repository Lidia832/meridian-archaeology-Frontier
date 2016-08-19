/* api.js - thin wrapper over the service layer.
 * 2016. The base URL is set at deploy time by a sed in the release
 * script, which is why it looks like this.
 *
 * 2018-03 R. Patel: added request timing + summary/anomalies helpers so
 *   the newer panels don't each have to re-derive the same numbers. The
 *   four original endpoints below are load-bearing - ui-next/ and the
 *   nightly export job both parse them - so DO NOT rename them or change
 *   their argument order. Add methods, never edit the four.
 * 2020-06 T. Osei: the API grew /api/health.version but nothing else, so
 *   summary()/anomalies() stay client-side derivations over the four.
 */
var MeridianApi = (function ($) {
    var BASE = window.MERIDIAN_API_BASE || 'http://localhost:8081';

    /* last-call diagnostics, read by the About/diagnostics panel. Kept as
     * a plain object rather than events because IE8 (still on two of the
     * field laptops as of 2016) has no CustomEvent. */
    var diag = {
        base: BASE,
        lastPath: null,
        lastMs: null,
        lastStatus: null,
        calls: 0,
        errors: 0,
        history: []   /* ring buffer of {path, ms, ok, at} */
    };

    function pushHistory(rec) {
        diag.history.push(rec);
        if (diag.history.length > 25) { diag.history.shift(); }
    }

    function get(path, params, cb) {
        var t0 = new Date().getTime();
        diag.calls += 1;
        $.ajax({
            url: BASE + path,
            data: params || {},
            dataType: 'json',
            success: function (data) {
                var ms = new Date().getTime() - t0;
                diag.lastPath = path; diag.lastMs = ms; diag.lastStatus = 'ok';
                pushHistory({ path: path, ms: ms, ok: true, at: new Date() });
                cb(null, data);
            },
            error: function (xhr, status) {
                var ms = new Date().getTime() - t0;
                diag.errors += 1;
                diag.lastPath = path; diag.lastMs = ms;
                diag.lastStatus = status || 'error';
                pushHistory({ path: path, ms: ms, ok: false, at: new Date() });
                cb(status || 'error', null);
            }
        });
    }

    /* --- the four original endpoints. Frozen interface. --------------- */
    function health(cb)    { get('/api/health', null, cb); }
    function stations(cb)  { get('/api/stations', null, cb); }
    function forecast(stn, cb) { get('/api/forecast', stn ? { station: stn } : null, cb); }
    function series(stn, year, cb) { get('/api/series', { station: stn, year: year }, cb); }

    /* --- derived helpers (2018+). These call the four above and shape the
     * result; they never hit a new URL. -------------------------------- */

    /* summary(): station roster plus a couple of roll-ups the overview and
     * the data-quality panels both want. Purely additive. */
    function summary(cb) {
        stations(function (err, rows) {
            if (err) { cb(err, null); return; }
            var totalDays = 0, minYear = null, maxYear = null, i, r;
            for (i = 0; i < rows.length; i++) {
                r = rows[i];
                totalDays += (r.days || 0);
                if (minYear === null || r.first_year < minYear) { minYear = r.first_year; }
                if (maxYear === null || r.last_year > maxYear) { maxYear = r.last_year; }
            }
            cb(null, {
                stations: rows,
                count: rows.length,
                totalDays: totalDays,
                minYear: minYear,
                maxYear: maxYear,
                avgDays: rows.length ? Math.round(totalDays / rows.length) : 0
            });
        });
    }

    /* anomalies(): the API has never carried a quality flag, so the suspect
     * flag is derived here from the physical bounds the agronomy group gave
     * us in 2017 (see Meridian.Quality.RULES for the shared thresholds).
     * Returns the series rows annotated with a .flags array. */
    function anomalies(stn, year, cb) {
        series(stn, year, function (err, rows) {
            if (err) { cb(err, null); return; }
            var rules = (window.Meridian && window.Meridian.Quality)
                ? window.Meridian.Quality.RULES : null;
            var out = [], i, flags;
            var prevBiom = null;
            for (i = 0; i < rows.length; i++) {
                flags = deriveFlags(rows[i], prevBiom, rules);
                out.push($.extend({}, rows[i], { flags: flags, suspect: flags.length > 0 }));
                prevBiom = rows[i].biom;
            }
            cb(null, out);
        });
    }

    function deriveFlags(r, prevBiom, rules) {
        var flags = [];
        /* fall back to hard-coded bounds if the Quality module has not
         * loaded yet (script order should prevent this, but the field
         * build once shipped views/ before util/ and nobody noticed for a
         * week - R.P.). */
        var b = rules || {
            swMin: 0, swMax: 400, etMin: 0, etMax: 12,
            drainMin: 0, laiMin: 0, laiMax: 9, biomDropFrac: 0.15
        };
        if (r.sw < b.swMin || r.sw > b.swMax) { flags.push('sw-range'); }
        if (r.et < b.etMin || r.et > b.etMax) { flags.push('et-range'); }
        if (r.drain < b.drainMin) { flags.push('drain-neg'); }
        if (r.lai < b.laiMin || r.lai > b.laiMax) { flags.push('lai-range'); }
        if (prevBiom !== null && prevBiom > 0 &&
            (prevBiom - r.biom) / prevBiom > b.biomDropFrac) {
            flags.push('biom-drop');
        }
        return flags;
    }

    return {
        base:      BASE,
        diag:      diag,
        health:    health,
        stations:  stations,
        forecast:  forecast,
        series:    series,
        summary:   summary,
        anomalies: anomalies
    };
})(jQuery);
