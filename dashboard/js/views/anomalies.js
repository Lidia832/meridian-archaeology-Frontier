/* views/anomalies.js - Anomalies / flagged readings.
 * T. Osei 2020-08. Lists the daily-series rows that trip one or more of
 * the QC rules (Meridian.Quality.RULES), so an operator can eyeball the
 * suspect days before signing off a forecast run. Reads MeridianApi's
 * anomalies() helper, which annotates each row with a .flags array.
 *
 * There is no server-side anomaly endpoint; the flags are derived on the
 * client from the shared thresholds (see api.js / quality.js). If agronomy
 * adds a rule, it appears here automatically because we render whatever
 * flags come back.
 *
 * 2021-09 T. Osei: added the flag-type filter chips and the little
 *   "where in the year" strip (div ticks - MRD-181).
 */
window.Meridian = window.Meridian || {};
window.Meridian.Views = window.Meridian.Views || {};

window.Meridian.Views.Anomalies = (function ($) {

    var Dom = window.Meridian.Dom;
    var Fmt = window.Meridian.Fmt;
    var State = window.Meridian.State;
    var Q = window.Meridian.Quality;

    var $root = null;
    var rowsAll = [];           /* all series rows (annotated) */
    var activeFilters = {};     /* flag code -> bool; empty = show all suspect */

    function render($container) {
        $root = $container;
        $container.html(
            '<div class="view-head">' +
            '  <h2>Anomalies</h2>' +
            '  <div class="view-actions">' +
            '    <select id="an-station" class="select"></select>' +
            '    <select id="an-year" class="select"></select>' +
            '  </div>' +
            '</div>' +
            '<div id="an-summary" class="an-summary"></div>' +
            '<div id="an-chips" class="chips"></div>' +
            '<div id="an-strip-wrap"><div class="strip-label">Suspect days across the year</div>' +
            '  <div id="an-strip" class="year-strip"></div></div>' +
            '<div id="an-table">' + Dom.emptyState('pick a station and year') + '</div>'
        );

        wireEvents();
        populateStations();

        var stn = State.get('selectedStation');
        var all = State.get('stations') || [];
        if (!stn && all.length) { stn = all[0].stnid; }
        if (stn) { $('#an-station').val(stn); loadYears(stn, true); }
    }

    function populateStations() {
        var all = State.get('stations') || [];
        var html = '';
        for (var i = 0; i < all.length; i++) {
            html += '<option value="' + Dom.escAttr(all[i].stnid) + '">' +
                    Dom.esc(all[i].stnid) + '</option>';
        }
        $('#an-station').html(html);
    }

    function loadYears(stn, autoRun) {
        MeridianApi.forecast(stn, function (err, rows) {
            var html = '';
            if (!err && rows) {
                for (var i = 0; i < rows.length; i++) {
                    html += '<option value="' + rows[i].year + '">' + rows[i].year + '</option>';
                }
            }
            $('#an-year').html(html || '<option value="">—</option>');
            if (rows && rows.length) {
                var yr = State.get('selectedYear');
                var have = false, i;
                for (i = 0; i < rows.length; i++) {
                    if (Number(rows[i].year) === Number(yr)) { have = true; break; }
                }
                if (!have) { yr = rows[rows.length - 1].year; }
                $('#an-year').val(yr);
                if (autoRun) { run(stn, yr); }
            }
        });
    }

    function run(stn, year) {
        activeFilters = {};
        $('#an-table').html(Dom.spinner('scanning for anomalies…'));
        MeridianApi.anomalies(stn, year, function (err, rows) {
            if (err) {
                $('#an-table').html(Dom.banner('error', 'Series unreachable (' + err + ')'));
                return;
            }
            rowsAll = rows || [];
            renderSummary();
            renderChips();
            renderStrip();
            renderTable();
        });
    }

    function suspectRows() {
        var out = [], i;
        for (i = 0; i < rowsAll.length; i++) {
            if (rowsAll[i].suspect) { out.push(rowsAll[i]); }
        }
        return out;
    }

    function filteredRows() {
        var active = [], k;
        for (k in activeFilters) { if (activeFilters[k]) { active.push(k); } }
        var susp = suspectRows();
        if (!active.length) { return susp; }
        var out = [], i, j;
        for (i = 0; i < susp.length; i++) {
            var has = false;
            for (j = 0; j < susp[i].flags.length; j++) {
                if (activeFilters[susp[i].flags[j]]) { has = true; break; }
            }
            if (has) { out.push(susp[i]); }
        }
        return out;
    }

    function flagCounts() {
        var counts = {}, i, j;
        for (i = 0; i < rowsAll.length; i++) {
            for (j = 0; j < rowsAll[i].flags.length; j++) {
                counts[rowsAll[i].flags[j]] = (counts[rowsAll[i].flags[j]] || 0) + 1;
            }
        }
        return counts;
    }

    function renderSummary() {
        var susp = suspectRows().length;
        var total = rowsAll.length;
        var cls = susp === 0 ? 'ok' : (susp / Math.max(total, 1) > 0.1 ? 'warn' : 'info');
        var msg = susp === 0
            ? 'No suspect readings in ' + total + ' days. Clean run.'
            : susp + ' of ' + total + ' days flagged (' +
              Fmt.pct(susp / Math.max(total, 1), 1) + ').';
        $('#an-summary').html(Dom.banner(cls, msg));
    }

    function renderChips() {
        var counts = flagCounts();
        var html = '';
        var order = ['sw-range', 'et-range', 'drain-neg', 'lai-range', 'biom-drop'];
        for (var i = 0; i < order.length; i++) {
            var code = order[i];
            var n = counts[code] || 0;
            if (!n) { continue; }
            var on = !!activeFilters[code];
            html += '<button class="chip flag-' + code + (on ? ' on' : '') +
                    '" data-flag="' + code + '">' +
                    Dom.esc(Q.FLAG_LABELS[code] || code) +
                    ' <span class="chip-n">' + n + '</span></button>';
        }
        if (!html) { html = '<span class="muted">no flags to filter</span>'; }
        $('#an-chips').html(html);
    }

    /* year strip: a div tick per suspect day positioned by DOY/365.
     * MRD-181 spirit again - absolutely positioned divs, not a plot. */
    function renderStrip() {
        var susp = suspectRows();
        var $strip = $('#an-strip').empty();
        if (!susp.length) {
            $strip.append('<div class="strip-empty">no suspect days</div>');
            return;
        }
        Dom.onceWidth($strip, function (w) {
            var html = '';
            for (var i = 0; i < susp.length; i++) {
                var doy = Number(susp[i].doy);
                var left = (doy / 366) * w;
                var cls = 'tick';
                if (susp[i].flags.length > 1) { cls += ' multi'; }
                html += '<div class="' + cls + '" style="left:' + left.toFixed(1) +
                        'px" title="DOY ' + doy + '"></div>';
            }
            $strip.html(html);
        });
    }

    function renderTable() {
        var rows = filteredRows();
        var html = Dom.buildTable({
            tableClass: 'small anomaly-tbl',
            rows: rows,
            empty: 'no readings match the active filters',
            cols: [
                { label: 'DOY', cls: 'num', get: function (r) { return r.doy; } },
                { label: 'Date', cls: 'muted', get: function (r) {
                    return Fmt.doyToDate(r.doy, $('#an-year').val()); } },
                { label: 'SW', cls: 'right num', get: function (r) { return Fmt.fixed(r.sw, 1); } },
                { label: 'ET', cls: 'right num', get: function (r) { return Fmt.fixed(r.et, 2); } },
                { label: 'Drain', cls: 'right num', get: function (r) { return Fmt.fixed(r.drain, 2); } },
                { label: 'Biomass', cls: 'right num', get: function (r) { return Fmt.int(r.biom); } },
                { label: 'LAI', cls: 'right num', get: function (r) { return Fmt.fixed(r.lai, 2); } },
                { label: 'Flags', cls: 'flags-cell', raw: true, get: function (r) {
                    var out = '';
                    for (var i = 0; i < r.flags.length; i++) {
                        out += Dom.pill('flag-' + r.flags[i],
                                        Q.FLAG_LABELS[r.flags[i]] || r.flags[i]);
                    }
                    return out;
                } }
            ]
        });
        $('#an-table').html(html);
    }

    function wireEvents() {
        $root.off('.an');
        $root.on('change.an', '#an-station', function () {
            var stn = $(this).val();
            State.selectStation(stn);
            loadYears(stn, true);
        });
        $root.on('change.an', '#an-year', function () {
            var stn = $('#an-station').val();
            var yr = $(this).val();
            State.selectYear(yr);
            run(stn, yr);
        });
        $root.on('click.an', '.chip', function () {
            var code = $(this).data('flag');
            activeFilters[code] = !activeFilters[code];
            $(this).toggleClass('on', !!activeFilters[code]);
            renderTable();
        });
    }

    function teardown() { if ($root) { $root.off('.an'); } }

    return {
        id: 'anomalies',
        title: 'Anomalies',
        render: render,
        teardown: teardown
    };
})(jQuery);
