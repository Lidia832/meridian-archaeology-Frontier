package ca.meridian.util;

import java.util.List;
import java.util.Map;

/**
 * CSV writer for the export endpoint.
 *
 * The agronomists on the trial sites live in spreadsheets, so the
 * 2019 portal work added a "download CSV" button. RFC 4180 quoting,
 * nothing fancier: fields with commas, quotes or newlines get quoted
 * and embedded quotes are doubled.
 *
 * S. Whitfield 2019
 */
public final class Csv {

    private Csv() {
    }

    public static String field(Object v) {
        if (v == null) {
            return "";
        }
        String s = v.toString();
        boolean needsQuote = s.indexOf(',') >= 0 || s.indexOf('"') >= 0
                || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0;
        if (!needsQuote) {
            return s;
        }
        return '"' + s.replace("\"", "\"\"") + '"';
    }

    public static String row(List<?> values) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(field(values.get(i)));
        }
        sb.append("\r\n");
        return sb.toString();
    }

    /**
     * Serialises a list of row maps as CSV. The header is taken from
     * the supplied column order; missing keys render as empty fields.
     */
    public static String fromRows(List<String> columns, List<Map<String, Object>> rows) {
        StringBuilder sb = new StringBuilder();
        // header
        for (int i = 0; i < columns.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(field(columns.get(i)));
        }
        sb.append("\r\n");
        // body
        for (Map<String, Object> r : rows) {
            for (int i = 0; i < columns.size(); i++) {
                if (i > 0) {
                    sb.append(',');
                }
                sb.append(field(r.get(columns.get(i))));
            }
            sb.append("\r\n");
        }
        return sb.toString();
    }
}
