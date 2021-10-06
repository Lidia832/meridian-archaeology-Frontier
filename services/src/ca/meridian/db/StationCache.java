package ca.meridian.db;

import ca.meridian.model.Station;
import ca.meridian.util.Clock;
import ca.meridian.util.Env;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * In-memory cache of the station list with a time-to-live.
 *
 * The station list changes about once a decade (it has been the same
 * six sites since before this service existed) but /api/stations runs
 * a GROUP BY over the whole reading table, which on the collector host
 * was slow enough that the portal's landing page felt sticky. This
 * caches the parsed list for meridian.cache.ttl seconds. A miss or a
 * failed refresh falls through to the store.
 *
 * D. Iqbal 2021
 */
public final class StationCache {

    private final DbClient db;
    private final long ttlMillis;

    private List<Station> cached;
    private long loadedAt;

    public StationCache(DbClient db) {
        this(db, Env.cacheTtlSeconds() * 1000L);
    }

    public StationCache(DbClient db, long ttlMillis) {
        this.db = db;
        this.ttlMillis = ttlMillis;
    }

    public synchronized List<Station> stations() throws IOException {
        long now = Clock.nowMillis();
        if (cached != null && (now - loadedAt) < ttlMillis) {
            return cached;
        }
        List<Station> fresh = load();
        cached = Collections.unmodifiableList(fresh);
        loadedAt = now;
        return cached;
    }

    public synchronized void invalidate() {
        cached = null;
        loadedAt = 0L;
    }

    public synchronized boolean isFresh() {
        return cached != null && (Clock.nowMillis() - loadedAt) < ttlMillis;
    }

    private List<Station> load() throws IOException {
        String sql = QueryBuilder.select(
                        "stnid", "COUNT(*) AS days",
                        "MIN(year) AS first_year", "MAX(year) AS last_year")
                .from("reading")
                .groupBy("stnid")
                .orderBy("stnid")
                .build();
        ResultSetLite rs = db.query(sql);
        List<Station> out = new ArrayList<>(rs.size());
        for (Row r : rs) {
            out.add(new Station(
                    r.str("stnid"),
                    r.longVal("days", 0),
                    r.intVal("first_year"),
                    r.intVal("last_year")));
        }
        return out;
    }
}
