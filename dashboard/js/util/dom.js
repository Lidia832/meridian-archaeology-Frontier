/* util/dom.js - small jQuery helpers shared by the views.
 * L. Nakamura 2016-09. The goal here is that a view can build a table
 * without hand-concatenating '<tr><td>' fifty times, because we did that
 * in dashboard.js and it is where the escaping bugs lived.
 *
 * 2017-11 R. Patel: added the table builder + escape helpers.
 * 2020-09 T. Osei: added banner()/spinner() so the loading states stop
 *   being three different shades of "table says nothing".
 * Everything takes and returns jQuery objects or plain strings. No ES6 -
 * these files load as bare <script> with no build step (MRD-181), so
 * template strings and arrow functions are out.
 */
window.Meridian = window.Meridian || {};

window.Meridian.Dom = (function ($) {

    /* esc(): the escaper. Same table dashboard.js has always used; kept
     * bit-for-bit so behaviour doesn't change when a caller moves here. */
    function esc(s) {
        if (s === null || s === undefined) { return ''; }
        return String(s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    /* escAttr(): like esc but also handles single quotes, for values that
     * go into single-quoted attributes (data-stn etc). */
    function escAttr(s) {
        if (s === null || s === undefined) { return ''; }
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;',
                     '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /* el(): terse element builder. el('td', 'right num', '12.3') ->
     * '<td class="right num">12.3</td>'. The text is escaped; pass
     * rawEl() when you have already-built HTML to nest. */
    function el(tag, cls, text) {
        var open = '<' + tag + (cls ? ' class="' + cls + '"' : '') + '>';
        return open + esc(text) + '</' + tag + '>';
    }

    function rawEl(tag, cls, html) {
        var open = '<' + tag + (cls ? ' class="' + cls + '"' : '') + '>';
        return open + (html === undefined || html === null ? '' : html) + '</' + tag + '>';
    }

    /* td/th shortcuts. */
    function td(cls, text) { return el('td', cls, text); }
    function th(cls, text) { return el('th', cls, text); }
    function rawTd(cls, html) { return rawEl('td', cls, html); }

    /* tr(): join an array of cell HTML strings into a row, with optional
     * attributes object. attrs values are attribute-escaped. */
    function tr(cellsHtml, attrs) {
        var a = '';
        if (attrs) {
            for (var k in attrs) {
                if (attrs.hasOwnProperty(k)) {
                    a += ' ' + k + '="' + escAttr(attrs[k]) + '"';
                }
            }
        }
        return '<tr' + a + '>' + cellsHtml.join('') + '</tr>';
    }

    /* buildTable(): the workhorse. spec = {
     *   cols: [{label, cls, get:function(row){return cellText}, raw:bool}],
     *   rows: [...],
     *   rowAttrs: function(row, i){ return {'data-stn': ...} },
     *   empty: 'message when no rows'
     * }
     * Returns an HTML string for the <table>. Views drop it into a
     * container with $c.html(buildTable(spec)).
     */
    function buildTable(spec) {
        var cols = spec.cols || [];
        var rows = spec.rows || [];
        var cls = 'grid' + (spec.tableClass ? ' ' + spec.tableClass : '');
        var out = '<table class="' + cls + '"><thead><tr>';
        var i, j, c, r, cells, attrs, val;

        for (j = 0; j < cols.length; j++) {
            c = cols[j];
            out += th(c.headCls || c.cls || '', c.label);
        }
        out += '</tr></thead><tbody>';

        if (!rows.length) {
            out += '<tr><td class="empty" colspan="' + cols.length + '">' +
                   esc(spec.empty || 'no data') + '</td></tr>';
        } else {
            for (i = 0; i < rows.length; i++) {
                r = rows[i];
                cells = [];
                for (j = 0; j < cols.length; j++) {
                    c = cols[j];
                    val = c.get ? c.get(r, i) : '';
                    cells.push(c.raw ? rawTd(c.cls || '', val) : td(c.cls || '', val));
                }
                attrs = spec.rowAttrs ? spec.rowAttrs(r, i) : null;
                out += tr(cells, attrs);
            }
        }
        out += '</tbody></table>';
        return out;
    }

    /* banner(): coloured status strip. kind is info|warn|error|ok. */
    function banner(kind, text) {
        return '<div class="banner ' + (kind || 'info') + '">' + esc(text) + '</div>';
    }

    /* spinner(): the loading placeholder. Not a real spinner - it's a
     * pulsing text row, because an animated GIF needed a binary in the
     * repo and the 2016 review said no binaries. */
    function spinner(text) {
        return '<div class="loading"><span class="pulse">⚙</span> ' +
               esc(text || 'loading…') + '</div>';
    }

    /* emptyState(): centred message for a whole panel. */
    function emptyState(text) {
        return '<div class="empty-state">' + esc(text) + '</div>';
    }

    /* kv(): a definition-list row for the diagnostics/detail panels. */
    function kv(key, value, raw) {
        return '<div class="kv"><span class="k">' + esc(key) + '</span>' +
               '<span class="v">' + (raw ? value : esc(value)) + '</span></div>';
    }

    /* pill(): small coloured label, for flags and statuses. */
    function pill(cls, text) {
        return '<span class="pill ' + (cls || '') + '">' + esc(text) + '</span>';
    }

    /* download(): trigger a client-side file save via a data: URI. Used by
     * the CSV export buttons. IE never supported this cleanly so there's a
     * navigator.msSaveBlob branch kept for the field laptops. */
    function download(filename, mime, text) {
        try {
            if (window.navigator && window.navigator.msSaveBlob) {
                var blob = new Blob([text], { type: mime });
                window.navigator.msSaveBlob(blob, filename);
                return true;
            }
        } catch (e) { /* fall through to data URI */ }
        var uri = 'data:' + mime + ';charset=utf-8,' + encodeURIComponent(text);
        var $a = $('<a>').attr({ href: uri, download: filename })
                         .css('display', 'none').appendTo('body');
        /* .get(0).click() rather than $a.click() so it works in IE9 */
        var node = $a.get(0);
        if (node.click) { node.click(); }
        $a.remove();
        return true;
    }

    /* debounce(): used by the compare-view station filter box. */
    function debounce(fn, ms) {
        var t = null;
        return function () {
            var self = this, args = arguments;
            if (t) { clearTimeout(t); }
            t = setTimeout(function () { fn.apply(self, args); }, ms || 150);
        };
    }

    /* onceWidth(): $el.width() is 0 until the element is visible, which
     * bites the charts when a tab is drawn while hidden. This retries on
     * the next frame (well, next tick - no rAF on IE9) until it reads a
     * non-zero width, then calls back. */
    function onceWidth($el, cb, tries) {
        var w = $el.width();
        if (w && w > 0) { cb(w); return; }
        if ((tries || 0) > 20) { cb(600); return; }  /* give up, assume 600 */
        setTimeout(function () { onceWidth($el, cb, (tries || 0) + 1); }, 25);
    }

    return {
        esc: esc,
        escAttr: escAttr,
        el: el,
        rawEl: rawEl,
        td: td,
        th: th,
        rawTd: rawTd,
        tr: tr,
        buildTable: buildTable,
        banner: banner,
        spinner: spinner,
        emptyState: emptyState,
        kv: kv,
        pill: pill,
        download: download,
        debounce: debounce,
        onceWidth: onceWidth
    };
})(jQuery);
