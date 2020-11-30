/* views/quality.js - Data-quality panel, and the shared QC ruleset.
 * T. Osei 2020-07. The agronomy group has been asking "how clean is the
 * series data" for years; this tab answers it per station/year by running
 * the same suspect-flag rules the Anomalies tab uses (they both read
 * Meridian.Quality.RULES defined here) and summarising the counts.
 *
 * The RULES object is the single source of truth for the physical bounds.
 * api.js.deriveFlags() reads it too (with a hard-coded fallback in case
 * this file loads late). If agronomy revises a bound, change it HERE only.
 *
 * 2022-01 T. Osei: added the per-variable completeness bars (div bars,
 *   MRD-181) and the stacked good/flagged mini-chart.
 */
window.Meridian = window.Meridian || {};
window.Meridian.Views = window.Meridian.Views || {};

/* ---- shared QC ruleset (read by api.js and the Anomalies view) -------- */
window.Meridian.Quality = window.Meridian.Quality || {};
window.Meridian.Quality.RULES = {
    /* physical bounds from the agronomy group, 2017-03 memo, revised
     * 2019-08 (ET ceiling raised from 10 to 12 after the drought-year
     * calibration). Units: sw mm, et mm/day, drain mm/day, lai m2/m2. */
    swMin: 0,     swMax: 400,
    etMin: 0,     etMax: 12,
    drainMin: 0,
    laiMin: 0,    laiMax: 9,
    biomDropFrac: 0.15   /* a >15% day-over-day biomass drop is suspect */
};

/* human-readable descriptions for each flag code, shared with anomalies */
window.Meridian.Quality.FLAG_LABELS = {
    'sw-range':  'Soil water out of range',
    'et-range':  'ET out of range',
    'drain-neg': 'Negative drainage',
    'lai-range': 'LAI out of range',
    'biom-drop': 'Biomass drop > 15%'
};

window.Meridian.Views.Quality = (function ($) {

    var Dom = window.Meridian.Dom;
    var Fmt = window.Meridian.Fmt;
    var State = window.Meridian.State;
    var BarChart = window.Meridian.Charts.BarChart;
    var Q = window.Meridian.Quality;

    var $root = null;

    function render($container) {
        $root = $container;
        $container.html(
            '<div class="view-head">' +
            '  <h2>Data Quality</h2>' +
            '  <div class="view-actions">' +
            '    <select id="dq-station" class="select"></select>' +
            '    <select id="dq-year" class="select"></select>' +
            '  </div>' +
            '</div>' +
            '<div id="dq-tiles" class="tiles"></div>' +
            '<div class="split">' +
            '  <div class="split-l">' +
            '    <h3>Field completeness</h3>' +
            '    <div id="dq-complete">' + Dom.emptyState('pick a station/year') + '</div>' +
            '  </div>' +
            '  <div class="split-r">' +
            '    <h3>Flagged vs clean by variable</h3>' +
            '    <div id="dq-chart" class="chart"></div>' +
            '    <div id="dq-legend" class="legend"></div>' +
            '  </div>' +
            '</div>' +
            '<h3>Applied thresholds</h3>' +
            '<div id="dq-rules" class="rules"></div>'
        );

        wireEvents();
        populateStations();
        renderRules();

        var stn = State.get('selectedStation');
        var all = State.get('stations') || [];
        if (!stn && all.length) { stn = all[0].stnid; }
        if (stn) { $('#dq-station').val(stn); loadYears(stn, true); }
    }

    function populateStations() {
        var all = State.get('stations') || [];
        var html = '';
        for (var i = 0; i < all.length; i++) {
            html += '<option value="' + Dom.escAttr(all[i].stnid) + '">' +
                    Dom.esc(all[i].stnid) + '</option>';
        }
        $('#dq-station').html(html);
    }

    function loadYears(stn, autoRun) {
        MeridianApi.forecast(stn, function (err, rows) {
            var html = '';
            if (!err && rows) {
                for (var i = 0; i < rows.length; i++) {
                    html += '<option value="' + rows[i].year + '">' + rows[i].year + '</option>';
                }
            }
            $('#dq-year').html(html || '<option value="">—</option>');
            if (rows && rows.length) {
                var yr = State.get('selectedYear');
                var have = false, i;
                for (i = 0; i < rows.length; i++) {
                    if (Number(rows[i].year) === Number(yr)) { have = true; break; }
                }
                if (!have) { yr = rows[rows.length - 1].year; }
                $('#dq-year').val(yr);
                if (autoRun) { run(stn, yr); }
            }
        });
    }

    function run(stn, year) {
        $('#dq-complete').html(Dom.spinner('scanning…'));
        $('#dq-chart').empty();
        MeridianApi.anomalies(stn, year, function (err, rows) {
            if (err) {
                $('#dq-complete').html(Dom.banner('error', 'Series unreachable (' + err + ')'));
                return;
            }
            var report = analyse(rows);
            renderTiles(report, rows.length);
            renderCompleteness(report);
            renderChart(report);
        });
    }

    /* analyse(): per-variable completeness and flag tallies. */
    function analyse(rows) {
        var fields = ['sw', 'et', 'drain', 'biom', 'lai'];
        var rep = { total: rows.length, fields: {}, flags: {}, suspectRows: 0 };
        var i, f, v, r;
        for (f = 0; f < fields.length; f++) {
            rep.fields[fields[f]] = { present: 0, missing: 0, flagged: 0 };
        }
        for (i = 0; i < rows.length; i++) {
            r = rows[i];
            if (r.suspect) { rep.suspectRows += 1; }
            for (f = 0; f < fields.length; f++) {
                v = r[fields[f]];
                if (v === null || v === undefined || v === '' || isNaN(Number(v))) {
                    rep.fields[fields[f]].missing += 1;
                } else {
                    rep.fields[fields[f]].present += 1;
                }
            }
            for (var k = 0; k < r.flags.length; k++) {
                rep.flags[r.flags[k]] = (rep.flags[r.flags[k]] || 0) + 1;
                /* attribute the flag to a field's flagged count where we can */
                var fld = flagField(r.flags[k]);
                if (fld && rep.fields[fld]) { rep.fields[fld].flagged += 1; }
            }
        }
        return rep;
    }

    function flagField(code) {
        return { 'sw-range': 'sw', 'et-range': 'et', 'drain-neg': 'drain',
                 'lai-range': 'lai', 'biom-drop': 'biom' }[code] || null;
    }

    function renderTiles(rep, n) {
        var cleanPct = n ? ((n - rep.suspectRows) / n) : 1;
        var html = '';
        html += tile('Days', Fmt.thousands(n), 'rows in series');
        html += tile('Clean', Fmt.pct(cleanPct, 1),
                     (n - rep.suspectRows) + ' of ' + n + ' rows');
        html += tile('Suspect rows', Fmt.thousands(rep.suspectRows), 'at least one flag');
        var totFlags = 0; for (var k in rep.flags) { if (rep.flags.hasOwnProperty(k)) { totFlags += rep.flags[k]; } }
        html += tile('Total flags', Fmt.thousands(totFlags), 'across all rules');
        $('#dq-tiles').html(html);
    }

    function tile(label, value, sub) {
        return '<div class="tile"><div class="tile-val">' + Dom.esc(value) +
               '</div><div class="tile-label">' + Dom.esc(label) +
               '</div><div class="tile-sub">' + Dom.esc(sub) + '</div></div>';
    }

    /* completeness bars: one div-bar per field showing present fraction.
     * MRD-181 spirit - these are plain divs, not a progress widget. */
    function renderCompleteness(rep) {
        var fields = ['sw', 'et', 'drain', 'biom', 'lai'];
        var labels = { sw: 'Soil water', et: 'ET', drain: 'Drainage',
                       biom: 'Biomass', lai: 'LAI' };
        var html = '<div class="bars-v">';
        for (var i = 0; i < fields.length; i++) {
            var f = rep.fields[fields[i]];
            var frac = rep.total ? f.present / rep.total : 0;
            var flagFrac = rep.total ? f.flagged / rep.total : 0;
            html += '<div class="bar-v-row">' +
                    '<span class="bar-v-label">' + labels[fields[i]] + '</span>' +
                    '<span class="bar-v-track">' +
                    '<span class="bar-v-fill" style="width:' + (frac * 100).toFixed(1) + '%"></span>' +
                    '<span class="bar-v-flag" style="width:' + (flagFrac * 100).toFixed(1) + '%"></span>' +
                    '</span>' +
                    '<span class="bar-v-val">' + Fmt.pct(frac, 0) +
                    (f.flagged ? ' · ' + f.flagged + ' flagged' : '') + '</span>' +
                    '</div>';
        }
        html += '</div>';
        $('#dq-complete').html(html);
    }

    function renderChart(rep) {
        var fields = ['sw', 'et', 'drain', 'biom', 'lai'];
        var buckets = [];
        for (var i = 0; i < fields.length; i++) {
            var f = rep.fields[fields[i]];
            buckets.push({ a: f.present - f.flagged, b: f.flagged, key: fields[i] });
        }
        var $chart = $('#dq-chart');
        Dom.onceWidth($chart, function () {
            BarChart.stacked($chart, buckets, { height: 120 });
        });
        $('#dq-legend').html(
            '<span class="legend-item"><i class="sw seg-a"></i> clean</span>' +
            '<span class="legend-item"><i class="sw seg-b"></i> flagged</span>' +
            '<span class="legend-note">columns: SW, ET, Drain, Biomass, LAI</span>'
        );
    }

    function renderRules() {
        var r = Q.RULES;
        var html = '';
        html += Dom.kv('Soil water (sw)', r.swMin + ' – ' + r.swMax + ' mm');
        html += Dom.kv('Evapotranspiration (et)', r.etMin + ' – ' + r.etMax + ' mm/day');
        html += Dom.kv('Drainage (drain)', '≥ ' + r.drainMin + ' mm/day');
        html += Dom.kv('Leaf area index (lai)', r.laiMin + ' – ' + r.laiMax + ' m²/m²');
        html += Dom.kv('Biomass day-over-day drop', '> ' + Fmt.pct(r.biomDropFrac, 0) + ' is suspect');
        $('#dq-rules').html(html);
    }

    function wireEvents() {
        $root.off('.dq');
        $root.on('change.dq', '#dq-station', function () {
            var stn = $(this).val();
            State.selectStation(stn);
            loadYears(stn, true);
        });
        $root.on('change.dq', '#dq-year', function () {
            var stn = $('#dq-station').val();
            var yr = $(this).val();
            State.selectYear(yr);
            run(stn, yr);
        });
    }

    function teardown() { if ($root) { $root.off('.dq'); } }

    return {
        id: 'quality',
        title: 'Data Quality',
        render: render,
        teardown: teardown
    };
})(jQuery);
