package ca.meridian.db;

import ca.meridian.util.Env;

import java.io.IOException;

/**
 * A thin wrapper over {@link Db} that the newer endpoints use.
 *
 * It adds two things the raw shell-out class never grew: a bounded
 * retry, because the sqlite3 process occasionally lost a race against
 * the ingest job's write lock and came back "database is locked", and
 * a typed {@link ResultSetLite} return so callers stop re-parsing the
 * JSON by hand. The retry count comes from meridian.db.retries.
 *
 * This does NOT replace Db - the original handlers still call Db
 * directly, and the shell-out (MRD-77) is unchanged underneath.
 *
 * D. Iqbal 2021
 */
public final class DbClient {

    private final Db db;
    private final int retries;
    private final long backoffMillis;

    public DbClient(Db db) {
        this(db, Env.retries(), 120L);
    }

    public DbClient(Db db, int retries, long backoffMillis) {
        this.db = db;
        this.retries = Math.max(0, retries);
        this.backoffMillis = backoffMillis;
    }

    public Db raw() {
        return db;
    }

    /** Runs a query, retrying on transient lock errors. */
    public ResultSetLite query(String sql) throws IOException {
        return ResultSetLite.of(queryJson(sql));
    }

    public ResultSetLite query(QueryBuilder qb) throws IOException {
        return query(qb.build());
    }

    public String queryJson(String sql) throws IOException {
        IOException last = null;
        for (int attempt = 0; attempt <= retries; attempt++) {
            try {
                return db.queryJson(sql);
            } catch (IOException e) {
                last = e;
                if (!isTransient(e) || attempt == retries) {
                    throw e;
                }
                sleep(backoffMillis * (attempt + 1));
            }
        }
        // unreachable, but keeps the compiler happy about last
        throw last;
    }

    private static boolean isTransient(IOException e) {
        String m = e.getMessage();
        if (m == null) {
            return false;
        }
        m = m.toLowerCase();
        return m.contains("locked") || m.contains("busy") || m.contains("exited 5");
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
}
