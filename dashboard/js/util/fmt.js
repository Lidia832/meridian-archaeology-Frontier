/* util/fmt.js - number, date and unit formatting.
 * L. Nakamura 2016-09. Pulled out of dashboard.js when the forecast and
 * series tables started disagreeing about how many decimals a yield had.
 * Everything here is pure (no DOM, no ajax) so it can be unit-checked by
 * hand in the console.
 *
 * 2019-01 R. Patel: added relative-time and the CSV escaper for the
 *   export buttons. Kept the old fixed() around because three callers
 *   still use it and I'm not chasing them all down before the demo.
 */
window.Meridian = window.Meridian || {};

window.Meridian.Fmt = (function () {

    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    /* fixed(n, d): tolerant Number.toFixed. Non-numbers come back as an
     * em-dash so a null in the data doesn't blow up a whole table row.
     * The API has sent nulls for drain during sensor outages since at
     * least 2014, so this matters. */
    function fixed(n, d) {
        if (n === null || n === undefined || n === '') { return '—'; }
        var v = Number(n);
        if (isNaN(v)) { return '—'; }
        return v.toFixed(d === undefined ? 2 : d);
    }

    /* int(): rounded whole number with the same null tolerance. */
    function int(n) {
        if (n === null || n === undefined || n === '') { return '—'; }
        var v = Number(n);
        if (isNaN(v)) { return '—'; }
        return String(Math.round(v));
    }

    /* thousands(): group with a thin space (the province style guide,
     * 2015 edition, says no commas in tabular numerics). IE8 has no
     * String.prototype.padStart so this is done the long way. */
    function thousands(n) {
        if (n === null || n === undefined || n === '') { return '—'; }
        var v = Number(n);
        if (isNaN(v)) { return '—'; }
        var neg = v < 0;
        var s = String(Math.abs(Math.round(v)));
        var out = '';
        var c = 0, i;
        for (i = s.length - 1; i >= 0; i--) {
            out = s.charAt(i) + out;
            c += 1;
            if (c % 3 === 0 && i > 0) { out = ' ' + out; }
        }
        return (neg ? '-' : '') + out;
    }

    /* pct(): fraction -> percent string. accepts either 0..1 or already
     * scaled 0..100 by sniffing the magnitude, which is a hack but has
     * survived four years of callers passing whichever they had. */
    function pct(x, d) {
        if (x === null || x === undefined || x === '') { return '—'; }
        var v = Number(x);
        if (isNaN(v)) { return '—'; }
        if (v <= 1 && v >= -1) { v = v * 100; }
        return v.toFixed(d === undefined ? 1 : d) + '%';
    }

    /* yield_t(): the one true yield format - t/ha to 3 decimals. Named
     * with the trailing underscore to match the API field. */
    function yield_t(n) { return fixed(n, 3); }

    /* --- dates ---------------------------------------------------------
     * The API sends run_at as an ISO-ish string; older stations send a
     * bare 'YYYY-MM-DD HH:MM:SS'. parseStamp() copes with both without
     * pulling in a date library (there is no build step; see MRD-181). */
    function parseStamp(s) {
        if (!s) { return null; }
        if (s instanceof Date) { return s; }
        var str = String(s).replace(' ', 'T');
        var d = new Date(str);
        if (isNaN(d.getTime())) {
            /* last-ditch: split it ourselves */
            var m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
            if (m) { return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); }
            return null;
        }
        return d;
    }

    function pad2(n) { return (n < 10 ? '0' : '') + n; }

    /* stamp(): compact 'YYYY-Mon-DD HH:MM' for the run columns. */
    function stamp(s) {
        var d = parseStamp(s);
        if (!d) { return String(s || '—'); }
        return d.getFullYear() + '-' + MONTHS[d.getMonth()] + '-' + pad2(d.getDate()) +
               ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }

    /* dateOnly(): 'YYYY-Mon-DD'. */
    function dateOnly(s) {
        var d = parseStamp(s);
        if (!d) { return String(s || '—'); }
        return d.getFullYear() + '-' + MONTHS[d.getMonth()] + '-' + pad2(d.getDate());
    }

    /* ago(): human relative time. Coarse on purpose - operators only care
     * whether a run is fresh, an hour old, or stale. */
    function ago(s) {
        var d = parseStamp(s);
        if (!d) { return ''; }
        var secs = Math.round((new Date().getTime() - d.getTime()) / 1000);
        if (secs < 0) { return 'in the future'; }
        if (secs < 60) { return secs + 's ago'; }
        var mins = Math.round(secs / 60);
        if (mins < 60) { return mins + 'm ago'; }
        var hrs = Math.round(mins / 60);
        if (hrs < 24) { return hrs + 'h ago'; }
        var days = Math.round(hrs / 24);
        if (days < 30) { return days + 'd ago'; }
        var months = Math.round(days / 30);
        if (months < 12) { return months + 'mo ago'; }
        return Math.round(months / 12) + 'y ago';
    }

    /* doyToDate(): day-of-year -> 'Mon DD' for a given year, so the series
     * chart tooltip can say 'Jul 12' instead of 'DOY 193'. Non-leap math
     * is fine for a label. */
    function doyToDate(doy, year) {
        var y = year || 2001;   /* 2001 is a common non-leap default */
        var d = new Date(y, 0, 1);
        d.setDate(d.getDate() + (Number(doy) - 1));
        return MONTHS[d.getMonth()] + ' ' + d.getDate();
    }

    /* yearsLabel(): 'first-last' or a single year, matching the old
     * inline logic in dashboard.js so the two never drift again. */
    function yearsLabel(first, last) {
        if (first === last || last === undefined) { return String(first); }
        return first + '–' + last;   /* en-dash */
    }

    /* --- CSV -----------------------------------------------------------
     * The export buttons build a data: URI; these keep a stray comma or
     * quote in a model name from wrecking the file. */
    function csvCell(v) {
        if (v === null || v === undefined) { return ''; }
        var s = String(v);
        if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

    function csvRow(cells) {
        var out = [], i;
        for (i = 0; i < cells.length; i++) { out.push(csvCell(cells[i])); }
        return out.join(',');
    }

    /* clamp/round helpers used by the charts. */
    function clamp(v, lo, hi) {
        if (v < lo) { return lo; }
        if (v > hi) { return hi; }
        return v;
    }

    function round1(v) { return Math.round(v * 10) / 10; }

    return {
        fixed: fixed,
        int: int,
        thousands: thousands,
        pct: pct,
        yield_t: yield_t,
        parseStamp: parseStamp,
        stamp: stamp,
        dateOnly: dateOnly,
        ago: ago,
        doyToDate: doyToDate,
        yearsLabel: yearsLabel,
        csvCell: csvCell,
        csvRow: csvRow,
        clamp: clamp,
        round1: round1,
        MONTHS: MONTHS
    };
})();
