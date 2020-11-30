/* util/state.js - in-memory application state + a tiny pub/sub.
 * R. Patel 2018-02. Before this the selected station lived in a closure
 * variable in dashboard.js and the new tabs couldn't see it, so we kept
 * re-fetching. This is the shared bag now.
 *
 * DELIBERATELY in-memory only. There is no localStorage here: the console
 * runs on shared operator terminals in the regional offices and IT's 2017
 * ruling was that nothing operator-specific may persist on those machines.
 * A refresh starts clean, on purpose. Do not "helpfully" add localStorage.
 *
 * 2021-04 T. Osei: added the compare-set and the small cache so flipping
 *   between tabs doesn't re-hit the API for the same station twice a
 *   second. Cache is memory-only too and dies with the page.
 */
window.Meridian = window.Meridian || {};

window.Meridian.State = (function () {

    var state = {
        stations: [],          /* last-loaded station roster */
        selectedStation: null, /* stnid string */
        selectedYear: null,    /* number */
        compareSet: [],        /* array of stnid strings for the Compare tab */
        health: null,          /* {status, version} or null */
        activeTab: null        /* set by the router */
    };

    /* topic -> [handlers]. Handlers get (value, fullState). */
    var subs = {};

    function on(topic, fn) {
        if (!subs[topic]) { subs[topic] = []; }
        subs[topic].push(fn);
        return function off() {   /* return an unsubscribe, used nowhere yet
                                     but the compare view will want it */
            var arr = subs[topic], i;
            if (!arr) { return; }
            for (i = 0; i < arr.length; i++) {
                if (arr[i] === fn) { arr.splice(i, 1); return; }
            }
        };
    }

    function emit(topic, value) {
        var arr = subs[topic], i;
        if (!arr) { return; }
        /* copy first: a handler that unsubscribes mid-loop shouldn't skip
         * the next one. Learned that the hard way with the health badge. */
        arr = arr.slice();
        for (i = 0; i < arr.length; i++) {
            try { arr[i](value, state); }
            catch (e) {
                if (window.console && console.error) {
                    console.error('state handler for ' + topic + ' threw', e);
                }
            }
        }
    }

    function get(key) { return state[key]; }
    function all() { return state; }

    function set(key, value) {
        var old = state[key];
        if (old === value) { return; }
        state[key] = value;
        emit(key, value);
    }

    /* convenience setters that emit the well-known topics ---------------- */
    function setStations(rows) { set('stations', rows || []); }

    function selectStation(stn) {
        if (state.selectedStation === stn) { return; }
        state.selectedStation = stn;
        state.selectedYear = null;   /* year is station-scoped; reset it */
        emit('selectedStation', stn);
    }

    function selectYear(y) {
        y = (y === null || y === undefined) ? null : Number(y);
        if (state.selectedYear === y) { return; }
        state.selectedYear = y;
        emit('selectedYear', y);
    }

    function setHealth(h) { set('health', h); }

    /* compare-set management. Capped so the Compare view stays legible. */
    var COMPARE_MAX = 6;

    function compareHas(stn) {
        var i;
        for (i = 0; i < state.compareSet.length; i++) {
            if (state.compareSet[i] === stn) { return true; }
        }
        return false;
    }

    function compareToggle(stn) {
        var i;
        for (i = 0; i < state.compareSet.length; i++) {
            if (state.compareSet[i] === stn) {
                state.compareSet.splice(i, 1);
                emit('compareSet', state.compareSet);
                return false;
            }
        }
        if (state.compareSet.length >= COMPARE_MAX) {
            /* drop the oldest to make room - the view shows a note */
            state.compareSet.shift();
        }
        state.compareSet.push(stn);
        emit('compareSet', state.compareSet);
        return true;
    }

    function compareClear() {
        state.compareSet = [];
        emit('compareSet', state.compareSet);
    }

    function findStation(stn) {
        var i;
        for (i = 0; i < state.stations.length; i++) {
            if (state.stations[i].stnid === stn) { return state.stations[i]; }
        }
        return null;
    }

    /* --- tiny memory cache -------------------------------------------
     * key -> {at, data}. TTL is short; this only smooths tab flipping,
     * it is not a real cache. No eviction beyond the TTL check because the
     * key space is bounded by station*year and the page is short-lived. */
    var cache = {};
    var TTL_MS = 20000;

    function cacheGet(key) {
        var rec = cache[key];
        if (!rec) { return null; }
        if (new Date().getTime() - rec.at > TTL_MS) { delete cache[key]; return null; }
        return rec.data;
    }

    function cachePut(key, data) {
        cache[key] = { at: new Date().getTime(), data: data };
    }

    function cacheClear() { cache = {}; }

    return {
        COMPARE_MAX: COMPARE_MAX,
        on: on,
        emit: emit,
        get: get,
        set: set,
        all: all,
        setStations: setStations,
        selectStation: selectStation,
        selectYear: selectYear,
        setHealth: setHealth,
        compareHas: compareHas,
        compareToggle: compareToggle,
        compareClear: compareClear,
        findStation: findStation,
        cacheGet: cacheGet,
        cachePut: cachePut,
        cacheClear: cacheClear
    };
})();
