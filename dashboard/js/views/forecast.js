/* views/forecast.js - Forecast detail + daily series for one station.
 * This is the heart of the old console (the 2016 dashboard.js right-hand
 * pane) reworked into a standalone tab. R. Patel 2018-05.
 *
 * It shows: the forecast-run table for the selected station, and for the
 * chosen run year the daily series - as the biomass bar chart (MRD-181,
 * via Meridian.Charts.BarChart) plus the raw series table underneath.
 *
 * 2019-06 R. Patel: chart variable selector (biomass/LAI/soil water) added
 *   at operator request. Still the div-bar chart for every variable.
 * 2021-02 T. Osei: series CSV export; DOY->date tooltip.
 * NOTE: dashboard.js still exists and still runs the very first paint on
 *   the legacy single-page URL (/index.html?legacy=1). This tab and that
 *   file share MeridianApi and Meridian.Fmt but not their DOM. Keep both.
 */
window.Meridian = window.Meridian || {};
window.Meridian.Views = window.Meridian.Views || {};

window.Meridian.Views.Forecast = (function ($) {

    var Dom = window.Meridian.Dom;
    var Fmt = window.Meridian.Fmt;
    var State = window.Meridian.State;
    var BarChart = window.Meridian.Charts.BarChart;

    var $root = null;
    var chartCtl = null;
    var currentSeries = [];
    var chartVar = 'biom';      /* biom | lai | sw | et */

    var VAR_META = {
        biom: { label: 'Biomass', fixed: 0, cls: 'v-biom' },
        lai:  { label: 'LAI',     fixed: 2, cls: 'v-lai' },
        sw:   { label: 'Soil water', fixed: 1, cls: 'v-sw' },
        et:   { label: 'ET',      fixed: 2, cls: 'v-et' }
    };

    function render($container) {
        $root = $container;
        var stn = State.get('selectedStation');

        $container.html(
            '<div class="view-head">' +
            '  <h2>Forecast <span id="fc-stn" class="subtitle"></span></h2>' +
            '  <div class="view-actions">' +
            '    <select id="fc-station" class="select"></select>' +
            '    <button id="fc-export-fc" class="btn">Forecast CSV</button>' +
            '  </div>' +
            '</div>' +
            '<div class="split">' +
            '  <div class="split-l">' +
            '    <h3>Forecast runs</h3>' +
            '    <div id="fc-runs">' + Dom.spinner() + '</div>' +
            '  </div>' +
            '  <div class="split-r">' +
            '    <div class="chart-head">' +
            '      <h3>Daily series <span id="fc-year" class="subtitle"></span></h3>' +
            '      <div class="chart-controls">' +
            '        <label>Variable ' +
            '          <select id="fc-var" class="select select-sm">' +
            '            <option value="biom">Biomass</option>' +
            '            <option value="lai">LAI</option>' +
            '            <option value="sw">Soil water</option>' +
            '            <option value="et">ET</option>' +
            '          </select>' +
            '        </label>' +
            '        <button id="fc-export-series" class="btn btn-sm">Series CSV</button>' +
            '      </div>' +
            '    </div>' +
            '    <div id="fc-chart" class="chart tall"></div>' +
            '    <div id="fc-series-table" class="scroll-y"></div>' +
            '  </div>' +
            '</div>'
        );

        wireEvents();
        populateStationSelect();

        if (!stn) {
            var all = State.get('stations') || [];
            if (all.length) { stn = all[0].stnid; State.selectStation(stn); }
        }
        if (stn) { openStation(stn); }
        else { $('#fc-runs').html(Dom.emptyState('Select a station from the Stations tab.')); }
    }

    function populateStationSelect() {
        var all = State.get('stations') || [];
        var html = '';
        for (var i = 0; i < all.length; i++) {
            html += '<option value="' + Dom.escAttr(all[i].stnid) + '">' +
                    Dom.esc(all[i].stnid) + '</option>';
        }
        $('#fc-station').html(html).val(State.get('selectedStation') || '');
    }

    function openStation(stn) {
        $('#fc-stn').text('– ' + stn);
        $('#fc-station').val(stn);
        $('#fc-runs').html(Dom.spinner('loading forecast runs…'));

        MeridianApi.forecast(stn, function (err, rows) {
            if (err) {
                $('#fc-runs').html(Dom.banner('error', 'Forecast unreachable (' + err + ')'));
                return;
            }
            renderRuns(rows, stn);
            if (rows && rows.length) {
                var yr = State.get('selectedYear');
                var have = false;
                for (var i = 0; i < rows.length; i++) {
                    if (Number(rows[i].year) === Number(yr)) { have = true; break; }
                }
                if (!have) { yr = rows[rows.length - 1].year; }
                openYear(stn, yr);
            } else {
                $('#fc-series-table').empty();
                $('#fc-chart').empty().append('<div class="chart-empty">no forecast runs for ' +
                                              Dom.esc(stn) + '</div>');
            }
        });
    }

    function renderRuns(rows, stn) {
        var selYear = State.get('selectedYear');
        var html = Dom.buildTable({
            tableClass: 'runs',
            rows: rows || [],
            empty: 'no forecast run',
            cols: [
                { label: 'Year', cls: 'num', get: function (r) { return r.year; } },
                { label: 'Yield (t/ha)', cls: 'right num', get: function (r) {
                    return Fmt.yield_t(r.yield_t); } },
                { label: 'Days', cls: 'right num', get: function (r) { return r.ndays; } },
                { label: 'Model', cls: '', get: function (r) { return r.model; } },
                { label: 'Run', cls: 'nowrap', get: function (r) { return Fmt.stamp(r.run_at); } },
                { label: '', cls: 'muted small nowrap', get: function (r) {
                    return Fmt.ago(r.run_at); } }
            ],
            rowAttrs: function (r) {
                var a = { 'data-year': r.year, 'class': 'run-row' };
                if (Number(r.year) === Number(selYear)) { a['class'] += ' sel'; }
                return a;
            }
        });
        $('#fc-runs').html(html);
    }

    function openYear(stn, year) {
        State.selectYear(year);
        $('#fc-year').text('– ' + year);
        $('#fc-runs .run-row').removeClass('sel')
            .filter('[data-year="' + year + '"]').addClass('sel');
        $('#fc-chart').html(Dom.spinner('loading series…'));

        var cacheKey = 'series:' + stn + ':' + year;
        var cached = State.cacheGet(cacheKey);
        if (cached) { showSeries(cached, year); return; }

        MeridianApi.series(stn, year, function (err, rows) {
            if (err) {
                $('#fc-chart').html(Dom.banner('error', 'Series unreachable (' + err + ')'));
                $('#fc-series-table').empty();
                return;
            }
            State.cachePut(cacheKey, rows);
            showSeries(rows, year);
        });
    }

    function showSeries(rows, year) {
        currentSeries = rows || [];
        drawChart(year);
        renderSeriesTable(currentSeries, year);
    }

    function drawChart(year) {
        var meta = VAR_META[chartVar];
        var $chart = $('#fc-chart').empty();
        /* onceWidth because the chart may have been laid out while the tab
         * was hidden; see util/dom.js. Then hand off to the div-bar chart
         * (MRD-181). */
        Dom.onceWidth($chart, function () {
            chartCtl = BarChart.draw($chart, currentSeries, {
                value: function (r) { return Number(r[chartVar]); },
                height: 180,
                gridlines: true,
                colorFor: function () { return meta.cls; },
                label: function (r) {
                    return Fmt.doyToDate(r.doy, year) + ' (DOY ' + r.doy + '): ' +
                           meta.label + ' ' + Fmt.fixed(r[chartVar], meta.fixed);
                }
            });
        });
    }

    function renderSeriesTable(rows, year) {
        var html = Dom.buildTable({
            tableClass: 'small series-tbl',
            rows: rows,
            empty: 'no daily series',
            cols: [
                { label: 'DOY', cls: 'num', get: function (r) { return r.doy; } },
                { label: 'Date', cls: 'muted', get: function (r) {
                    return Fmt.doyToDate(r.doy, year); } },
                { label: 'SW', cls: 'right num', get: function (r) { return Fmt.fixed(r.sw, 1); } },
                { label: 'ET', cls: 'right num', get: function (r) { return Fmt.fixed(r.et, 2); } },
                { label: 'Drain', cls: 'right num', get: function (r) { return Fmt.fixed(r.drain, 2); } },
                { label: 'Biomass', cls: 'right num', get: function (r) { return Fmt.int(r.biom); } },
                { label: 'LAI', cls: 'right num', get: function (r) { return Fmt.fixed(r.lai, 2); } }
            ],
            rowAttrs: function (r, i) { return { 'data-i': i }; }
        });
        $('#fc-series-table').html(html);
    }

    function exportForecastCsv() {
        var stn = State.get('selectedStation');
        MeridianApi.forecast(stn, function (err, rows) {
            if (err) { return; }
            var lines = [Fmt.csvRow(['stnid', 'year', 'yield_t', 'ndays', 'model', 'run_at'])];
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                lines.push(Fmt.csvRow([r.stnid, r.year, r.yield_t, r.ndays, r.model, r.run_at]));
            }
            Dom.download('meridian-forecast-' + stn + '.csv', 'text/csv', lines.join('\r\n'));
        });
    }

    function exportSeriesCsv() {
        var stn = State.get('selectedStation');
        var yr = State.get('selectedYear');
        var lines = [Fmt.csvRow(['doy', 'sw', 'et', 'drain', 'biom', 'lai'])];
        for (var i = 0; i < currentSeries.length; i++) {
            var r = currentSeries[i];
            lines.push(Fmt.csvRow([r.doy, r.sw, r.et, r.drain, r.biom, r.lai]));
        }
        Dom.download('meridian-series-' + stn + '-' + yr + '.csv', 'text/csv', lines.join('\r\n'));
    }

    function wireEvents() {
        $root.off('.fc');

        $root.on('change.fc', '#fc-station', function () {
            var stn = $(this).val();
            State.selectStation(stn);
            openStation(stn);
        });

        $root.on('click.fc', '.run-row', function () {
            var stn = State.get('selectedStation');
            openYear(stn, $(this).data('year'));
        });

        $root.on('change.fc', '#fc-var', function () {
            chartVar = $(this).val();
            drawChart(State.get('selectedYear'));
        });

        $root.on('mouseenter.fc', '.series-tbl tr[data-i]', function () {
            if (chartCtl) { chartCtl.highlight(Number($(this).data('i'))); }
        });
        $root.on('mouseleave.fc', '.series-tbl', function () {
            if (chartCtl) { chartCtl.clear(); }
        });

        $root.on('click.fc', '#fc-export-fc', exportForecastCsv);
        $root.on('click.fc', '#fc-export-series', exportSeriesCsv);
    }

    function teardown() {
        if ($root) { $root.off('.fc'); }
        chartCtl = null;
        currentSeries = [];
    }

    return {
        id: 'forecast',
        title: 'Forecast',
        render: render,
        teardown: teardown
    };
})(jQuery);
