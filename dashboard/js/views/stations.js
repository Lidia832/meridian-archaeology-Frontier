/* views/stations.js - the Stations overview screen.
 * R. Patel 2018-04. This is the landing tab. It replaced the little
 * left-hand station list from the 2016 single-page layout with a proper
 * sortable roster plus roll-up tiles across the top. The old list still
 * lives in dashboard.js (the Forecast tab reuses it) - don't delete that.
 *
 * 2020-11 T. Osei: added the yield sparkline column and the CSV export.
 * TODO(ui-next): this screen is one of the 3-of-11 already reimplemented
 *   in ui-next/, but the ui-next build is gated behind the new auth proxy
 *   which regional offices can't reach yet, so this stays primary.
 */
window.Meridian = window.Meridian || {};
window.Meridian.Views = window.Meridian.Views || {};

window.Meridian.Views.Stations = (function ($) {

    var Dom = window.Meridian.Dom;
    var Fmt = window.Meridian.Fmt;
    var State = window.Meridian.State;
    var Spark = window.Meridian.Charts.Sparkline;

    var sortKey = 'stnid';
    var sortDir = 1;             /* 1 asc, -1 desc */
    var forecastCache = {};      /* stnid -> yields[] for the sparkline */
    var $root = null;

    function render($container) {
        $root = $container;
        $container.html(
            '<div class="view-head">' +
            '  <h2>Station Roster</h2>' +
            '  <div class="view-actions">' +
            '    <input type="text" id="stn-filter" class="filter-box" placeholder="filter stations…">' +
            '    <button id="stn-export" class="btn">Export CSV</button>' +
            '  </div>' +
            '</div>' +
            '<div id="stn-tiles" class="tiles"></div>' +
            '<div id="stn-table">' + Dom.spinner('loading stations…') + '</div>' +
            '<p class="note">Click a station to open its Forecast. Sparklines show recent forecast yields (low resolution by design – MRD-181).</p>'
        );

        wireEvents();
        load();
    }

    function load() {
        MeridianApi.summary(function (err, sum) {
            if (err) {
                $('#stn-table').html(Dom.banner('error', 'Station API unreachable (' + err + ')'));
                $('#stn-tiles').empty();
                return;
            }
            State.setStations(sum.stations);
            renderTiles(sum);
            renderTable(sum.stations);
            /* fetch a few forecasts lazily for the sparkline column - only
             * the first screenful, so we don't hammer the API on load */
            prefetchSparklines(sum.stations.slice(0, 12));
        });
    }

    function renderTiles(sum) {
        var html = '';
        html += tile('Stations', Fmt.thousands(sum.count), 'monitoring sites reporting');
        html += tile('Station-days', Fmt.thousands(sum.totalDays), 'total observation days on record');
        html += tile('Coverage', Fmt.yearsLabel(sum.minYear, sum.maxYear),
                     'earliest – latest forecast year');
        html += tile('Avg record', Fmt.thousands(sum.avgDays) + ' d', 'mean days per station');
        $('#stn-tiles').html(html);
    }

    function tile(label, value, sub) {
        return '<div class="tile">' +
               '<div class="tile-val">' + Dom.esc(value) + '</div>' +
               '<div class="tile-label">' + Dom.esc(label) + '</div>' +
               '<div class="tile-sub">' + Dom.esc(sub) + '</div>' +
               '</div>';
    }

    function renderTable(stations) {
        var rows = sortRows(stations.slice());
        var html = Dom.buildTable({
            tableClass: 'roster sortable',
            rows: rows,
            empty: 'no stations registered',
            cols: [
                colHead('Station', 'stnid', '', function (r) { return r.stnid; }),
                colHead('Days', 'days', 'right num', function (r) { return Fmt.thousands(r.days); }),
                colHead('First', 'first_year', 'right num', function (r) { return r.first_year; }),
                colHead('Last', 'last_year', 'right num', function (r) { return r.last_year; }),
                colHead('Span', 'span', 'right num', function (r) {
                    return (Number(r.last_year) - Number(r.first_year) + 1) + ' yr';
                }),
                { label: 'Yield trend', cls: 'spark-cell', raw: true, get: function (r) {
                    var ys = forecastCache[r.stnid];
                    if (!ys) { return '<span class="spark-pending">…</span>'; }
                    return Spark.render(ys, { width: 90, height: 18 });
                } },
                { label: 'Compare', cls: 'center', raw: true, get: function (r) {
                    var on = State.compareHas(r.stnid);
                    return '<button class="btn-mini cmp' + (on ? ' on' : '') +
                           '" data-cmp="' + Dom.escAttr(r.stnid) + '">' +
                           (on ? '✓' : '+') + '</button>';
                } }
            ],
            rowAttrs: function (r) { return { 'data-stn': r.stnid, 'class': 'stn-row' }; }
        });
        $('#stn-table').html(html);
        markSort();
    }

    function colHead(label, key, cls, get) {
        return {
            label: label + sortCaret(key),
            headCls: cls + ' col-' + key,
            cls: cls,
            raw: false,
            get: get,
            _key: key
        };
    }

    function sortCaret(key) {
        if (sortKey !== key) { return ''; }
        return sortDir > 0 ? ' ▲' : ' ▼';
    }

    function sortRows(rows) {
        rows.sort(function (a, b) {
            var av, bv;
            if (sortKey === 'span') {
                av = Number(a.last_year) - Number(a.first_year);
                bv = Number(b.last_year) - Number(b.first_year);
            } else {
                av = a[sortKey]; bv = b[sortKey];
            }
            if (typeof av === 'string') {
                return sortDir * av.localeCompare(bv);
            }
            return sortDir * ((Number(av) || 0) - (Number(bv) || 0));
        });
        return rows;
    }

    function markSort() {
        $('#stn-table th').each(function () {
            $(this).removeClass('sorted');
        });
    }

    function applyFilter(text) {
        text = (text || '').toLowerCase();
        var all = State.get('stations') || [];
        if (!text) { renderTable(all); return; }
        var filtered = [];
        for (var i = 0; i < all.length; i++) {
            if (String(all[i].stnid).toLowerCase().indexOf(text) >= 0) {
                filtered.push(all[i]);
            }
        }
        renderTable(filtered);
    }

    function prefetchSparklines(stations) {
        var pending = stations.length;
        if (!pending) { return; }
        $.each(stations, function (i, s) {
            MeridianApi.forecast(s.stnid, function (err, fc) {
                pending -= 1;
                if (!err && fc && fc.length) {
                    var ys = [];
                    for (var j = 0; j < fc.length; j++) { ys.push(Number(fc[j].yield_t)); }
                    forecastCache[s.stnid] = ys;
                }
                if (pending === 0) {
                    /* re-render the table once the batch is in, preserving
                     * the current filter box contents */
                    applyFilter($('#stn-filter').val());
                }
            });
        });
    }

    function exportCsv() {
        var rows = State.get('stations') || [];
        var lines = [Fmt.csvRow(['stnid', 'days', 'first_year', 'last_year'])];
        for (var i = 0; i < rows.length; i++) {
            lines.push(Fmt.csvRow([rows[i].stnid, rows[i].days,
                                   rows[i].first_year, rows[i].last_year]));
        }
        Dom.download('meridian-stations.csv', 'text/csv', lines.join('\r\n'));
    }

    function wireEvents() {
        $root.off('.stn');

        $root.on('click.stn', 'th', function () {
            /* find which column header this was by matching the label text
             * against known keys - crude but the headers are few */
            var txt = $(this).text().replace(/[▲▼\s]+$/, '').trim();
            var key = headerKey(txt);
            if (!key) { return; }
            if (sortKey === key) { sortDir = -sortDir; } else { sortKey = key; sortDir = 1; }
            renderTable(State.get('stations') || []);
        });

        $root.on('click.stn', '.stn-row', function (ev) {
            if ($(ev.target).closest('.btn-mini').length) { return; }  /* compare btn */
            var stn = $(this).data('stn');
            State.selectStation(stn);
            if (window.Meridian.Router) { window.Meridian.Router.go('forecast'); }
        });

        $root.on('click.stn', '.cmp', function (ev) {
            ev.stopPropagation();
            var stn = $(this).data('cmp');
            State.compareToggle(stn);
            var on = State.compareHas(stn);
            $(this).toggleClass('on', on).text(on ? '✓' : '+');
        });

        $root.on('input.stn keyup.stn', '#stn-filter', Dom.debounce(function () {
            applyFilter($(this).val());
        }, 120));

        $root.on('click.stn', '#stn-export', exportCsv);
    }

    function headerKey(label) {
        var map = { 'Station': 'stnid', 'Days': 'days', 'First': 'first_year',
                    'Last': 'last_year', 'Span': 'span' };
        return map[label] || null;
    }

    function teardown() {
        if ($root) { $root.off('.stn'); }
    }

    return {
        id: 'stations',
        title: 'Stations',
        render: render,
        teardown: teardown
    };
})(jQuery);
