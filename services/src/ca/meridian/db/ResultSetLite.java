package ca.meridian.db;

import ca.meridian.util.TinyJson;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * A read-once, in-memory result set.
 *
 * Nothing like JDBC's ResultSet under the hood - the whole result is
 * already a JSON string by the time we see it, so this just parses it
 * into {@link Row}s. Named to feel familiar to whoever inherits this.
 * Results are small (one station, one year) so holding them all in
 * memory has never been a problem.
 *
 * S. Whitfield 2019
 */
public final class ResultSetLite implements Iterable<Row> {

    private final List<Row> rows;

    private ResultSetLite(List<Row> rows) {
        this.rows = rows;
    }

    public static ResultSetLite of(String json) {
        List<Map<String, Object>> raw = TinyJson.parseRows(json);
        List<Row> rows = new ArrayList<>(raw.size());
        for (Map<String, Object> m : raw) {
            rows.add(new Row(m));
        }
        return new ResultSetLite(rows);
    }

    public int size() {
        return rows.size();
    }

    public boolean isEmpty() {
        return rows.isEmpty();
    }

    public Row get(int i) {
        return rows.get(i);
    }

    public Row first() {
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<Row> rows() {
        return rows;
    }

    @Override
    public Iterator<Row> iterator() {
        return rows.iterator();
    }
}
