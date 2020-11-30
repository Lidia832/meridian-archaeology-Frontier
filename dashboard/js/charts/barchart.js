/* charts/barchart.js - the biomass bar chart, factored out of
 * dashboard.js. See MRD-181.
 *
 * Deliberately not a charting library: adding one needed a build
 * step and there is no build step.
 *
 * So this draws bars as absolutely-positioned <div class="bar"> elements
 * inside a relatively-positioned container. It is the same technique the
 * original dashboard.js drawChart() used in 2016; R. Patel just lifted it
 * here in 2018 so the Compare and Forecast views could both call it, and
 * added axis gridlines and an optional tooltip. The rendering strategy has
 * NOT changed and must not: no Canvas, no SVG, no Chart.js on this chart.
 * A student reading this: yes, this is the point. The stopgap shipped and
 * then it just... kept shipping.
 *
 * 2020-10 T. Osei: added highlight() and the hover readout. Still divs.
 */
window.Meridian = window.Meridian || {};
window.Meridian.Charts = window.Meridian.Charts || {};

window.Meridian.Charts.BarChart = (function ($) {

    var Fmt = window.Meridian.Fmt;

    /* draw(container, rows, opts)
     *   container : jQuery object or selector for the chart box
     *   rows      : array of data rows
     *   opts = {
     *     value   : function(row){ return Number },   // bar height source
     *     max     : Number (optional; computed if absent),
     *     height  : px of the plot area (default 150),
     *     label   : function(row,i){ return String } for the tooltip,
     *     colorFor: function(row,i){ return cssClass } optional per-bar class,
     *     gridlines: bool (default true)
     *   }
     * Returns a small controller with highlight(i) / clear().
     */
    function draw(container, rows, opts) {
        opts = opts || {};
        var $c = $(container).empty().addClass('barchart');
        var valueOf = opts.value || function (r) { return Number(r.biom); };
        var height = opts.height || 150;
        var rowCount = rows ? rows.length : 0;

        if (!rowCount) {
            $c.append('<div class="chart-empty">no series to plot</div>');
            return noopController();
        }

        /* compute max if not supplied */
        var maxv = opts.max;
        if (maxv === undefined || maxv === null) {
            maxv = 0;
            for (var m = 0; m < rowCount; m++) {
                var vv = Number(valueOf(rows[m]));
                if (!isNaN(vv) && vv > maxv) { maxv = vv; }
            }
        }

        /* MRD-181 charting: width comes from the live element. When the
         * container is still hidden (drawn on an inactive tab) width() is
         * 0, so callers should route through Meridian.Dom.onceWidth, but we
         * also guard here. */
        var w = $c.width() || 600;
        var gap = rowCount > 120 ? 0 : 1;                  /* dense series: no gap */
        var step = Math.max(1, w / rowCount);
        var barW = Math.max(1, step - gap);

        /* gridlines: horizontal divs at 25/50/75/100% of the plot area.
         * Also divs, naturally. */
        if (opts.gridlines !== false) {
            var levels = [0.25, 0.5, 0.75, 1.0];
            for (var g = 0; g < levels.length; g++) {
                var gy = height - (levels[g] * height);
                $c.append('<div class="gridline" style="bottom:' +
                          (levels[g] * height).toFixed(0) + 'px"></div>');
                $c.append('<div class="gridlabel" style="bottom:' +
                          (levels[g] * height - 6).toFixed(0) + 'px">' +
                          Fmt.int(maxv * levels[g]) + '</div>');
            }
        }

        /* build all the bars as one HTML string then set once - appending
         * in a loop reflowed the page badly on the 2016 terminals with a
         * full 365-day series. */
        var html = '';
        var i, r, v, h, cls, left;
        for (i = 0; i < rowCount; i++) {
            r = rows[i];
            v = Number(valueOf(r));
            if (isNaN(v)) { v = 0; }
            h = maxv > 0 ? (v / maxv) * height : 0;
            cls = 'bar';
            if (opts.colorFor) {
                var extra = opts.colorFor(r, i);
                if (extra) { cls += ' ' + extra; }
            }
            left = (i * step).toFixed(1);
            html += '<div class="' + cls + '" data-i="' + i +
                    '" style="left:' + left + 'px;width:' + barW.toFixed(1) +
                    'px;height:' + h.toFixed(1) + 'px"></div>';
        }
        $c.append(html);

        /* readout element for hover, if a label fn was given */
        var $readout = null;
        if (opts.label) {
            $readout = $('<div class="chart-readout"></div>').appendTo($c);
            $c.off('.bc').on('mousemove.bc', '.bar', function (ev) {
                var idx = Number($(this).attr('data-i'));
                $readout.text(opts.label(rows[idx], idx)).show();
                var off = $c.offset();
                var x = ev.pageX - off.left + 8;
                if (x > w - 90) { x = w - 90; }
                $readout.css({ left: x + 'px', top: '4px' });
            }).on('mouseleave.bc', function () {
                if ($readout) { $readout.hide(); }
            });
        }

        return {
            highlight: function (idx) {
                $c.find('.bar').removeClass('hi');
                $c.find('.bar[data-i="' + idx + '"]').addClass('hi');
            },
            clear: function () { $c.find('.bar').removeClass('hi'); },
            max: maxv,
            count: rowCount
        };
    }

    function noopController() {
        return { highlight: function () {}, clear: function () {}, max: 0, count: 0 };
    }

    /* stacked(): a variant for the data-quality panel that stacks two
     * series (good vs flagged counts) per bucket. Still divs. Each bar is
     * a column with two child divs whose heights sum to the total. */
    function stacked(container, buckets, opts) {
        opts = opts || {};
        var $c = $(container).empty().addClass('barchart stacked');
        var height = opts.height || 120;
        var n = buckets ? buckets.length : 0;
        if (!n) {
            $c.append('<div class="chart-empty">nothing to plot</div>');
            return noopController();
        }
        var maxv = 0, i, tot;
        for (i = 0; i < n; i++) {
            tot = (buckets[i].a || 0) + (buckets[i].b || 0);
            if (tot > maxv) { maxv = tot; }
        }
        var w = $c.width() || 600;
        var step = Math.max(2, w / n);
        var barW = Math.max(2, step - 2);
        var html = '';
        for (i = 0; i < n; i++) {
            var a = buckets[i].a || 0, b = buckets[i].b || 0;
            var ha = maxv > 0 ? (a / maxv) * height : 0;
            var hb = maxv > 0 ? (b / maxv) * height : 0;
            var left = (i * step).toFixed(1);
            html += '<div class="stack" data-i="' + i + '" style="left:' + left +
                    'px;width:' + barW.toFixed(1) + 'px">' +
                    '<div class="seg seg-b" style="height:' + hb.toFixed(1) + 'px"></div>' +
                    '<div class="seg seg-a" style="height:' + ha.toFixed(1) + 'px"></div>' +
                    '</div>';
        }
        $c.append(html);
        return { highlight: function () {}, clear: function () {}, max: maxv, count: n };
    }

    return { draw: draw, stacked: stacked };
})(jQuery);
