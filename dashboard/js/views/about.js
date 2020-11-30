/* views/about.js - About / diagnostics.
 * T. Osei 2020-09. A read-only panel the help desk asks operators to open
 * when something's off: it shows the API base URL, the reported version,
 * live health, a rolling latency read from MeridianApi.diag, and the build
 * provenance. No controls that change anything - it's a status page.
 *
 * The latency mini-chart is (say it with me) div bars, MRD-181.
 *
 * 2023-02 T. Osei: added the ui-next migration note because operators kept
 *   asking why some screens look different. Three of eleven are in ui-next/
 *   now; the rest, including everything on this console, are still here.
 */
window.Meridian = window.Meridian || {};
window.Meridian.Views = window.Meridian.Views || {};

window.Meridian.Views.About = (function ($) {

    var Dom = window.Meridian.Dom;
    var Fmt = window.Meridian.Fmt;
    var State = window.Meridian.State;
    var BarChart = window.Meridian.Charts.BarChart;

    var $root = null;
    var pollTimer = null;

    /* migration status, hand-maintained. Eleven screens total; the three
     * ui-next has taken are marked done. This list is the honest answer to
     * "is this thing being replaced" - slowly, is the answer. */
    var SCREENS = [
        { name: 'Station roster', where: 'ui-next', done: true },
        { name: 'Forecast detail', where: 'this console', done: false },
        { name: 'Daily series', where: 'this console', done: false },
        { name: 'Anomalies', where: 'this console', done: false },
        { name: 'Compare', where: 'this console', done: false },
        { name: 'Data quality', where: 'this console', done: false },
        { name: 'Station admin', where: 'ui-next', done: true },
        { name: 'Model registry', where: 'ui-next', done: true },
        { name: 'Ingest monitor', where: 'this console (unbuilt)', done: false },
        { name: 'Export scheduler', where: 'legacy scripts', done: false },
        { name: 'Audit log', where: 'this console (unbuilt)', done: false }
    ];

    function render($container) {
        $root = $container;
        $container.html(
            '<div class="view-head"><h2>About &amp; Diagnostics</h2>' +
            '  <div class="view-actions"><button id="ab-ping" class="btn">Ping API</button></div>' +
            '</div>' +
            '<div class="split">' +
            '  <div class="split-l">' +
            '    <h3>Service</h3>' +
            '    <div id="ab-service" class="kvs"></div>' +
            '    <h3>Request latency <span class="muted small">(last calls)</span></h3>' +
            '    <div id="ab-latency" class="chart short"></div>' +
            '    <div id="ab-latency-legend" class="muted small"></div>' +
            '  </div>' +
            '  <div class="split-r">' +
            '    <h3>Build</h3>' +
            '    <div id="ab-build" class="kvs"></div>' +
            '    <h3>ui-next migration <span class="muted small">(3 of 11)</span></h3>' +
            '    <div id="ab-screens"></div>' +
            '  </div>' +
            '</div>'
        );

        wireEvents();
        renderBuild();
        renderScreens();
        refresh();

        /* light polling while the tab is open, cleared on teardown */
        pollTimer = setInterval(function () {
            if ($root && $root.is(':visible')) { refresh(); }
        }, 5000);
    }

    function refresh() {
        var diag = MeridianApi.diag;
        MeridianApi.health(function (err, h) {
            var status = err ? 'offline' : (h.status || 'ok');
            var ver = err ? '—' : (h.version || '?');
            if (!err) { State.setHealth(h); }

            var html = '';
            html += Dom.kv('API base', diag.base);
            html += Dom.kv('Status', Dom.pill(err ? 'flag-et-range' : 'ok', status), true);
            html += Dom.kv('Version', ver);
            html += Dom.kv('Last call', diag.lastPath || '—');
            html += Dom.kv('Last latency', diag.lastMs === null ? '—' : diag.lastMs + ' ms');
            html += Dom.kv('Calls this session', String(diag.calls));
            html += Dom.kv('Errors this session', String(diag.errors) +
                    (diag.errors ? '  (' + Fmt.pct(diag.errors / Math.max(diag.calls, 1), 1) + ')' : ''));
            $('#ab-service').html(html);

            renderLatency();
        });
    }

    function renderLatency() {
        var hist = MeridianApi.diag.history || [];
        var $chart = $('#ab-latency');
        if (!hist.length) { $chart.html('<div class="chart-empty">no calls yet</div>'); return; }
        Dom.onceWidth($chart, function () {
            BarChart.draw($chart, hist, {
                value: function (r) { return r.ms; },
                height: 80,
                gridlines: true,
                colorFor: function (r) { return r.ok ? 'v-ok' : 'v-err'; },
                label: function (r) {
                    return r.path + ' – ' + r.ms + 'ms' + (r.ok ? '' : ' (error)');
                }
            });
        });
        var sum = 0, max = 0, i;
        for (i = 0; i < hist.length; i++) { sum += hist[i].ms; if (hist[i].ms > max) { max = hist[i].ms; } }
        $('#ab-latency-legend').text(hist.length + ' calls · avg ' +
            Math.round(sum / hist.length) + 'ms · max ' + max + 'ms');
    }

    function renderBuild() {
        var html = '';
        html += Dom.kv('Console build', '2016.4.2 (+ patches through 2023)');
        html += Dom.kv('jQuery', '1.11.3 (vendored)');
        html += Dom.kv('Charts', 'hand-rolled DOM divs – MRD-181, no build step');
        html += Dom.kv('Served by', 'dashboard/server.js (Node static, 2019; ex-Apache vhost)');
        html += Dom.kv('Persistence', 'none (in-memory state only, per 2017 IT ruling)');
        html += Dom.kv('Browser floor', 'IE9 field laptops still in rotation');
        $('#ab-build').html(html);
    }

    function renderScreens() {
        var done = 0, i;
        for (i = 0; i < SCREENS.length; i++) { if (SCREENS[i].done) { done += 1; } }
        var html = '<ul class="screens">';
        for (i = 0; i < SCREENS.length; i++) {
            var s = SCREENS[i];
            html += '<li class="' + (s.done ? 'migrated' : 'legacy') + '">' +
                    '<span class="screen-mark">' + (s.done ? '✓' : '○') + '</span>' +
                    Dom.esc(s.name) + ' <span class="muted small">– ' +
                    Dom.esc(s.where) + '</span></li>';
        }
        html += '</ul>';
        html += '<p class="note">' + done + ' of ' + SCREENS.length +
                ' screens live in ui-next/. The rest are served from this console ' +
                'until the new auth proxy reaches the regional offices.</p>';
        $('#ab-screens').html(html);
    }

    function wireEvents() {
        $root.off('.ab');
        $root.on('click.ab', '#ab-ping', function () { refresh(); });
    }

    function teardown() {
        if ($root) { $root.off('.ab'); }
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    return {
        id: 'about',
        title: 'About',
        render: render,
        teardown: teardown
    };
})(jQuery);
