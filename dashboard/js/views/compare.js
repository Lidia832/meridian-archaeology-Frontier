/* views/compare.js - multi-station comparison.
 * T. Osei 2021-05. Operators kept opening two browser windows side by side
 * to compare stations, so this tab holds a small compare-set (managed in
 * Meridian.State, capped at State.COMPARE_MAX) and lines the stations up:
 * their forecast-yield history, and one chosen year's series overlaid as
 * small-multiple div-bar charts (MRD-181).
 *
 * The compare-set is shared with the Stations tab: the little + buttons
 * there add to the same set this tab reads. Because state is in-memory
 * (no localStorage - see util/state.js), the set resets on refresh.
 *
 * 2022-06 T. Osei: added the yield table with min/max/latest columns and
 *   the "align years" toggle for stations with different coverage.
 */
window.Meridian = window.Meridian || {};
window.Meridian.Views = window.Meridian.Views || {};

window.Meridian.Views.Compare = (function ($) {

    var Dom = window.Meridian.Dom;
    var Fmt = window.Meridian.Fmt;
    var State = window.Meridian.State;
    var BarChart = window.Meridian.Charts.BarChart;
    var Spark = window.Meridian.Charts.Sparkline;

    var $root = null;
    var forecasts = {};         /* stnid -> forecast rows */
    var seriesYear = null;      /* year chosen for the series overlay */
    var seriesVar = 'biom';

    function render($container) {
        $root = $container;
        $container.html(
            '<div class="view-head">' +
            '  <h2>Compare Stations</h2>' +
            '  <div class="view-actions">' +
            '    <select id="cmp-add" class="select"></select>' +
            '    <button id="cmp-clear" class="btn">Clear set</button>' +
            '  </div>' +
            '</div>' +
            '<div id="cmp-chips" class="chips cmp-chips"></div>' +
            '<div id="cmp-body"></div>'
        );

        wireEvents();
        populateAdd();
        subscribe();
        renderBody();
    }

    function populateAdd() {
        var all = State.get('stations') || [];
        var html = '<option value="">+ add station…</option>';
        for (var i = 0; i < all.length; i++) {
            html += '<option value="' + Dom.escAttr(all[i].stnid) + '">' +
                    Dom.esc(all[i].stnid) + '</option>';
        }
        $('#cmp-add').html(html);
    }

    var unsub = null;
    function subscribe() {
        if (unsub) { unsub(); }
        unsub = State.on('compareSet', function () {
            if ($root && $root.is(':visible')) { renderBody(); }
        });
    }

    function renderChips() {
        var set = State.get('compareSet') || [];
        var html = '';
        for (var i = 0; i < set.length; i++) {
            html += '<span class="chip cmp-chip on">' + Dom.esc(set[i]) +
                    ' <button class="chip-x" data-stn="' + Dom.escAttr(set[i]) + '">×</button></span>';
        }
        if (!html) {
            html = '<span class="muted">No stations selected. Add from the dropdown, ' +
                   'or use the + buttons on the Stations tab (max ' + State.COMPARE_MAX + ').</span>';
        }
        $('#cmp-chips').html(html);
    }

    function renderBody() {
        renderChips();
        var set = State.get('compareSet') || [];
        if (!set.length) {
            $('#cmp-body').html(Dom.emptyState('Select up to ' + State.COMPARE_MAX +
                                ' stations to compare.'));
            return;
        }

        $('#cmp-body').html(
            '<h3>Forecast yield history</h3>' +
            '<div id="cmp-yield">' + Dom.spinner('loading forecasts…') + '</div>' +
            '<div class="chart-head">' +
            '  <h3>Series overlay <span id="cmp-year-lbl" class="subtitle"></span></h3>' +
            '  <div class="chart-controls">' +
            '    <label>Year <select id="cmp-year" class="select select-sm"></select></label>' +
            '    <label>Variable <select id="cmp-var" class="select select-sm">' +
            '      <option value="biom">Biomass</option>' +
            '      <option value="lai">LAI</option>' +
            '      <option value="sw">Soil water</option>' +
            '      <option value="et">ET</option>' +
            '    </select></label>' +
            '  </div>' +
            '</div>' +
            '<div id="cmp-multiples" class="small-multiples"></div>'
        );
        $('#cmp-var').val(seriesVar);

        loadForecasts(set);
    }

    function loadForecasts(set) {
        var pending = set.length;
        forecasts = {};
        $.each(set, function (i, stn) {
            MeridianApi.forecast(stn, function (err, rows) {
                pending -= 1;
                forecasts[stn] = err ? [] : (rows || []);
                if (pending === 0) {
                    renderYieldTable(set);
                    populateYears(set);
                    renderMultiples(set);
                }
            });
        });
    }

    function renderYieldTable(set) {
        var rows = [];
        for (var i = 0; i < set.length; i++) {
            var stn = set[i];
            var fc = forecasts[stn] || [];
            var ys = [], min = null, max = null, latest = null, latestYear = null;
            for (var j = 0; j < fc.length; j++) {
                var y = Number(fc[j].yield_t);
                ys.push(y);
                if (min === null || y < min) { min = y; }
                if (max === null || y > max) { max = y; }
                latest = y; latestYear = fc[j].year;
            }
            rows.push({ stn: stn, ys: ys, min: min, max: max,
                        latest: latest, latestYear: latestYear, n: fc.length });
        }
        var html = Dom.buildTable({
            tableClass: 'cmp-yield-tbl',
            rows: rows,
            empty: 'no forecasts',
            cols: [
                { label: 'Station', cls: '', get: function (r) { return r.stn; } },
                { label: 'Runs', cls: 'right num', get: function (r) { return r.n; } },
                { label: 'Min', cls: 'right num', get: function (r) { return Fmt.yield_t(r.min); } },
                { label: 'Max', cls: 'right num', get: function (r) { return Fmt.yield_t(r.max); } },
                { label: 'Latest', cls: 'right num', get: function (r) {
                    return Fmt.yield_t(r.latest); } },
                { label: 'Yr', cls: 'right num muted', get: function (r) {
                    return r.latestYear || '—'; } },
                { label: 'Trend', cls: 'spark-cell', raw: true, get: function (r) {
                    return Spark.render(r.ys, { width: 110, height: 20 }); } }
            ],
            rowAttrs: function (r) { return { 'data-stn': r.stn }; }
        });
        $('#cmp-yield').html(html);
    }

    function populateYears(set) {
        /* union of years across the set, so the overlay can pick a common
         * one. Default to the most recent year that at least one station
         * has. */
        var yearMap = {};
        for (var i = 0; i < set.length; i++) {
            var fc = forecasts[set[i]] || [];
            for (var j = 0; j < fc.length; j++) { yearMap[fc[j].year] = true; }
        }
        var years = [];
        for (var y in yearMap) { if (yearMap.hasOwnProperty(y)) { years.push(Number(y)); } }
        years.sort(function (a, b) { return a - b; });
        var html = '';
        for (i = 0; i < years.length; i++) {
            html += '<option value="' + years[i] + '">' + years[i] + '</option>';
        }
        $('#cmp-year').html(html || '<option value="">—</option>');
        if (years.length) {
            if (!seriesYear || yearMap[seriesYear] === undefined) {
                seriesYear = years[years.length - 1];
            }
            $('#cmp-year').val(seriesYear);
            renderMultiples(set);
        }
    }

    /* small multiples: one div-bar chart per station for the chosen year +
     * variable. Each is the same MRD-181 bar chart at reduced height. */
    function renderMultiples(set) {
        $('#cmp-year-lbl').text(seriesYear ? '– ' + seriesYear : '');
        var $wrap = $('#cmp-multiples').empty();
        if (!seriesYear) { $wrap.html(Dom.emptyState('no common year')); return; }

        for (var i = 0; i < set.length; i++) {
            var stn = set[i];
            var id = 'cmp-mult-' + i;
            $wrap.append(
                '<div class="multiple">' +
                '  <div class="multiple-head">' + Dom.esc(stn) +
                '    <span class="muted" id="' + id + '-meta"></span></div>' +
                '  <div class="chart mini" id="' + id + '"></div>' +
                '</div>'
            );
            drawMultiple(stn, id);
        }
    }

    function drawMultiple(stn, id) {
        var $chart = $('#' + id);
        var cacheKey = 'series:' + stn + ':' + seriesYear;
        var cached = State.cacheGet(cacheKey);
        if (cached) { plot(cached, id, stn); return; }
        $chart.html(Dom.spinner());
        MeridianApi.series(stn, seriesYear, function (err, rows) {
            if (err) { $chart.html(Dom.banner('warn', 'no series')); return; }
            State.cachePut(cacheKey, rows);
            plot(rows, id, stn);
        });
    }

    function plot(rows, id, stn) {
        var $chart = $('#' + id);
        if (!rows || !rows.length) {
            $chart.html('<div class="chart-empty">no ' + seriesYear + ' series</div>');
            $('#' + id + '-meta').text('');
            return;
        }
        var meta = { biom: 0, lai: 2, sw: 1, et: 2 };
        Dom.onceWidth($chart, function () {
            BarChart.draw($chart, rows, {
                value: function (r) { return Number(r[seriesVar]); },
                height: 90,
                gridlines: false,
                colorFor: function () { return 'v-' + seriesVar; },
                label: function (r) {
                    return Fmt.doyToDate(r.doy, seriesYear) + ': ' +
                           Fmt.fixed(r[seriesVar], meta[seriesVar]);
                }
            });
        });
        $('#' + id + '-meta').text('(' + rows.length + ' days)');
    }

    function wireEvents() {
        $root.off('.cmp');

        $root.on('change.cmp', '#cmp-add', function () {
            var stn = $(this).val();
            if (stn) { State.compareToggle(stn); $(this).val(''); }
            renderBody();
        });

        $root.on('click.cmp', '#cmp-clear', function () {
            State.compareClear();
            renderBody();
        });

        $root.on('click.cmp', '.chip-x', function () {
            State.compareToggle($(this).data('stn'));
            renderBody();
        });

        $root.on('change.cmp', '#cmp-year', function () {
            seriesYear = Number($(this).val());
            renderMultiples(State.get('compareSet') || []);
        });

        $root.on('change.cmp', '#cmp-var', function () {
            seriesVar = $(this).val();
            renderMultiples(State.get('compareSet') || []);
        });
    }

    function teardown() {
        if ($root) { $root.off('.cmp'); }
        if (unsub) { unsub(); unsub = null; }
    }

    return {
        id: 'compare',
        title: 'Compare',
        render: render,
        teardown: teardown
    };
})(jQuery);
