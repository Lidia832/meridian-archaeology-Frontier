/* dashboard.js - operator console (legacy single-page layout).
 * L. Nakamura 2016-08. Partially superseded by ui-next/ (2023) which
 * covers three of the eleven screens. Both are shipped.
 *
 * 2018-06 R. Patel: the tabbed console (app.js + views/) took over the
 *   default layout. This file is kept for the legacy single-page URL
 *   (index.html?legacy=1, which renders the #legacy shell). It self-gates
 *   below so that if it is ever loaded alongside the tabbed app it stays
 *   dormant. The chart code here is the ORIGINAL MRD-181 stopgap; the tab
 *   version lives in charts/barchart.js. Do not delete either copy - the
 *   ticket is still open.
 */
$(function () {

    /* legacy gate: only run when the legacy shell is present. The tabbed
     * index has #content/#tabs and no #legacy, so this quietly no-ops. */
    if (!$('#legacy').length) { return; }

    var selected = null;

    function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    function loadStations() {
        MeridianApi.stations(function (err, rows) {
            if (err) { $('#stations tbody').html('<tr><td colspan="3">API unreachable</td></tr>'); return; }
            var html = '';
            $.each(rows, function (i, r) {
                var yrs = (r.first_year === r.last_year)
                    ? r.first_year
                    : r.first_year + '-' + r.last_year;
                html += '<tr data-stn="' + esc(r.stnid) + '"><td>' + esc(r.stnid) +
                        '</td><td>' + r.days + '</td><td>' + yrs + '</td></tr>';
            });
            $('#stations tbody').html(html);
            if (rows.length) { select(rows[0].stnid); }
        });
    }

    function select(stn) {
        selected = stn;
        $('#stations tbody tr').removeClass('sel')
            .filter('[data-stn="' + stn + '"]').addClass('sel');
        $('#sel').text('- ' + stn);

        MeridianApi.forecast(stn, function (err, rows) {
            if (err) { return; }
            var html = '';
            $.each(rows, function (i, r) {
                html += '<tr data-year="' + r.year + '"><td>' + r.year +
                        '</td><td>' + Number(r.yield_t).toFixed(3) +
                        '</td><td>' + r.ndays + '</td><td>' + esc(r.model) +
                        '</td><td>' + esc(r.run_at) + '</td></tr>';
            });
            $('#forecast tbody').html(html || '<tr><td colspan="5">no forecast run</td></tr>');
            if (rows.length) { loadSeries(stn, rows[rows.length - 1].year); }
        });
    }

    function loadSeries(stn, year) {
        MeridianApi.series(stn, year, function (err, rows) {
            if (err) { return; }
            var html = '', maxb = 0;
            $.each(rows, function (i, r) { if (r.biom > maxb) { maxb = r.biom; } });
            $.each(rows, function (i, r) {
                html += '<tr><td>' + r.doy + '</td><td>' + Number(r.sw).toFixed(1) +
                        '</td><td>' + Number(r.et).toFixed(2) +
                        '</td><td>' + Number(r.drain).toFixed(2) +
                        '</td><td>' + Number(r.biom).toFixed(0) +
                        '</td><td>' + Number(r.lai).toFixed(2) + '</td></tr>';
            });
            $('#series tbody').html(html);
            drawChart(rows, maxb);
        });
    }

    /* Deliberately not a charting library: adding one needed a build
       step and there is no build step. */
    function drawChart(rows, maxb) {
        var $c = $('#chart').empty();
        var w = $c.width() || 600;
        var step = Math.max(1, w / Math.max(rows.length, 1));
        $.each(rows, function (i, r) {
            var h = maxb > 0 ? (r.biom / maxb) * 150 : 0;
            $c.append('<div class="bar" style="left:' + (i * step).toFixed(1) +
                      'px;height:' + h.toFixed(1) + 'px"></div>');
        });
    }

    $('#stations').on('click', 'tr[data-stn]', function () { select($(this).data('stn')); });
    $('#forecast').on('click', 'tr[data-year]', function () {
        loadSeries(selected, $(this).data('year'));
    });

    MeridianApi.health(function (err, h) {
        $('#apiver').text(err ? 'API offline' : 'API ' + h.version);
    });

    loadStations();
});
