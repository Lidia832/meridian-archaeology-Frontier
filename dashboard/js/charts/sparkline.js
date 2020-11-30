/* charts/sparkline.js - tiny inline trend markers, DOM-div style.
 * T. Osei 2020-11. The Stations overview and Compare tables wanted a
 * little yield trend next to each row. Same house rule as the big chart
 * (MRD-181): no SVG, no Canvas, no library - a sparkline here is a row of
 * thin absolutely-positioned <div> columns inside a small inline box.
 *
 * These are decorative and low-resolution on purpose; if you want the real
 * numbers, that's what the table next to them is for.
 */
window.Meridian = window.Meridian || {};
window.Meridian.Charts = window.Meridian.Charts || {};

window.Meridian.Charts.Sparkline = (function ($) {

    /* render(values, opts) -> HTML string for an inline sparkline.
     * values : array of numbers
     * opts = { width: px (default 80), height: px (default 18),
     *          kind: 'bars' | 'dots' (default 'bars') }
     * Returns a string so it can be dropped straight into a table cell via
     * the Dom.buildTable raw-cell path.
     */
    function render(values, opts) {
        opts = opts || {};
        var width = opts.width || 80;
        var height = opts.height || 18;
        var kind = opts.kind || 'bars';
        if (!values || !values.length) {
            return '<span class="spark empty" style="width:' + width +
                   'px;height:' + height + 'px"></span>';
        }

        var min = values[0], max = values[0], i, v;
        for (i = 1; i < values.length; i++) {
            v = Number(values[i]);
            if (isNaN(v)) { continue; }
            if (v < min) { min = v; }
            if (v > max) { max = v; }
        }
        var range = (max - min) || 1;
        var n = values.length;
        var step = width / n;
        var barW = Math.max(1, step - 1);

        var inner = '';
        for (i = 0; i < n; i++) {
            v = Number(values[i]);
            if (isNaN(v)) { continue; }
            var frac = (v - min) / range;
            var left = (i * step).toFixed(1);
            if (kind === 'dots') {
                var top = ((1 - frac) * (height - 3)).toFixed(1);
                inner += '<i class="dot" style="left:' + left + 'px;top:' + top + 'px"></i>';
            } else {
                var h = Math.max(1, frac * (height - 1)).toFixed(1);
                inner += '<i class="col" style="left:' + left + 'px;width:' + barW.toFixed(1) +
                         'px;height:' + h + 'px"></i>';
            }
        }

        /* trend arrow: compare first vs last non-NaN value. */
        var dirCls = 'flat', arrow = '→';
        if (n >= 2) {
            var first = Number(values[0]), last = Number(values[n - 1]);
            if (!isNaN(first) && !isNaN(last)) {
                if (last > first * 1.02) { dirCls = 'up'; arrow = '↗'; }
                else if (last < first * 0.98) { dirCls = 'down'; arrow = '↘'; }
            }
        }

        return '<span class="spark ' + kind + '" style="width:' + width +
               'px;height:' + height + 'px">' + inner + '</span>' +
               '<span class="spark-trend ' + dirCls + '">' + arrow + '</span>';
    }

    /* fromRows(rows, key): convenience - pull a numeric column out of a set
     * of rows and render it. */
    function fromRows(rows, key, opts) {
        var vals = [], i;
        for (i = 0; i < (rows ? rows.length : 0); i++) {
            vals.push(Number(rows[i][key]));
        }
        return render(vals, opts);
    }

    return { render: render, fromRows: fromRows };
})(jQuery);
