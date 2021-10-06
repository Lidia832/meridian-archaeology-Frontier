package ca.meridian.db;

import java.util.ArrayList;
import java.util.List;

/**
 * A tiny SQL builder used by the endpoints written from 2019 onward.
 *
 * The original data endpoints (forecast, series) glue SQL together by
 * hand from the query string - that is the long-standing MRD-166
 * problem and is deliberately left alone there. New code goes through
 * this instead. Since the store is reached by shelling out to sqlite3
 * (MRD-77) there are no bind parameters to use, so literals are quoted
 * and escaped here: single quotes are doubled the SQLite way and the
 * few control characters that could break the argv are rejected.
 *
 * It is not a general query builder. It covers SELECT with equality
 * and range predicates, which is all the aggregate endpoints need.
 *
 * S. Whitfield 2019, extended D. Iqbal 2021
 */
public final class QueryBuilder {

    private final List<String> columns = new ArrayList<>();
    private String table;
    private final List<String> where = new ArrayList<>();
    private final List<String> groupBy = new ArrayList<>();
    private final List<String> orderBy = new ArrayList<>();
    private Integer limit;

    public static QueryBuilder select(String... cols) {
        QueryBuilder qb = new QueryBuilder();
        for (String c : cols) {
            qb.columns.add(c);
        }
        return qb;
    }

    public QueryBuilder from(String t) {
        this.table = t;
        return this;
    }

    public QueryBuilder col(String expr) {
        columns.add(expr);
        return this;
    }

    public QueryBuilder whereEq(String col, String value) {
        where.add(col + " = " + quote(value));
        return this;
    }

    public QueryBuilder whereEq(String col, int value) {
        where.add(col + " = " + value);
        return this;
    }

    public QueryBuilder whereGe(String col, int value) {
        where.add(col + " >= " + value);
        return this;
    }

    public QueryBuilder whereLe(String col, int value) {
        where.add(col + " <= " + value);
        return this;
    }

    public QueryBuilder whereRaw(String predicate) {
        where.add(predicate);
        return this;
    }

    public QueryBuilder groupBy(String... cols) {
        for (String c : cols) {
            groupBy.add(c);
        }
        return this;
    }

    public QueryBuilder orderBy(String... cols) {
        for (String c : cols) {
            orderBy.add(c);
        }
        return this;
    }

    public QueryBuilder limit(int n) {
        this.limit = n;
        return this;
    }

    /**
     * Quotes and escapes a string literal for a SQLite statement.
     * Doubles single quotes; rejects NUL and newlines outright rather
     * than trying to encode them, because they cannot occur in a
     * station id and their presence means the input is not one.
     */
    public static String quote(String s) {
        if (s == null) {
            return "NULL";
        }
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\0' || c == '\n' || c == '\r') {
                throw new IllegalArgumentException("illegal character in literal");
            }
        }
        return "'" + s.replace("'", "''") + "'";
    }

    public String build() {
        if (table == null) {
            throw new IllegalStateException("no table set");
        }
        StringBuilder sb = new StringBuilder("SELECT ");
        if (columns.isEmpty()) {
            sb.append('*');
        } else {
            for (int i = 0; i < columns.size(); i++) {
                if (i > 0) {
                    sb.append(", ");
                }
                sb.append(columns.get(i));
            }
        }
        sb.append(" FROM ").append(table);
        if (!where.isEmpty()) {
            sb.append(" WHERE ");
            for (int i = 0; i < where.size(); i++) {
                if (i > 0) {
                    sb.append(" AND ");
                }
                sb.append(where.get(i));
            }
        }
        if (!groupBy.isEmpty()) {
            sb.append(" GROUP BY ");
            for (int i = 0; i < groupBy.size(); i++) {
                if (i > 0) {
                    sb.append(", ");
                }
                sb.append(groupBy.get(i));
            }
        }
        if (!orderBy.isEmpty()) {
            sb.append(" ORDER BY ");
            for (int i = 0; i < orderBy.size(); i++) {
                if (i > 0) {
                    sb.append(", ");
                }
                sb.append(orderBy.get(i));
            }
        }
        if (limit != null) {
            sb.append(" LIMIT ").append(limit);
        }
        return sb.toString();
    }

    @Override
    public String toString() {
        return build();
    }
}
