package ca.meridian.db;

import java.util.Collections;
import java.util.Map;

/**
 * One row of a query result, backed by the map TinyJson produced from
 * the sqlite3 -json output. Typed getters do the coercion the crop
 * model outputs need, since sqlite hands numbers back as JSON numbers
 * but counts and years sometimes arrive as strings depending on the
 * column affinity.
 *
 * S. Whitfield 2019
 */
public final class Row {

    private final Map<String, Object> cells;

    public Row(Map<String, Object> cells) {
        this.cells = cells == null ? Collections.<String, Object>emptyMap() : cells;
    }

    public boolean has(String col) {
        return cells.containsKey(col) && cells.get(col) != null;
    }

    public Object raw(String col) {
        return cells.get(col);
    }

    public String str(String col) {
        Object v = cells.get(col);
        return v == null ? null : v.toString();
    }

    public String str(String col, String dflt) {
        String v = str(col);
        return v == null ? dflt : v;
    }

    public int intVal(String col) {
        return intVal(col, 0);
    }

    public int intVal(String col, int dflt) {
        Object v = cells.get(col);
        if (v == null) {
            return dflt;
        }
        if (v instanceof Number) {
            return ((Number) v).intValue();
        }
        try {
            return (int) Double.parseDouble(v.toString());
        } catch (NumberFormatException nfe) {
            return dflt;
        }
    }

    public long longVal(String col, long dflt) {
        Object v = cells.get(col);
        if (v == null) {
            return dflt;
        }
        if (v instanceof Number) {
            return ((Number) v).longValue();
        }
        try {
            return (long) Double.parseDouble(v.toString());
        } catch (NumberFormatException nfe) {
            return dflt;
        }
    }

    public double dbl(String col) {
        return dbl(col, 0.0);
    }

    public double dbl(String col, double dflt) {
        Object v = cells.get(col);
        if (v == null) {
            return dflt;
        }
        if (v instanceof Number) {
            return ((Number) v).doubleValue();
        }
        try {
            return Double.parseDouble(v.toString());
        } catch (NumberFormatException nfe) {
            return dflt;
        }
    }

    public Map<String, Object> asMap() {
        return cells;
    }
}
