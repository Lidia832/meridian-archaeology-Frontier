# Open Issues Touching ui-next

Three open tickets touch `ui-next` directly or through its Java API path: MRD-219 is the direct UI ticket; MRD-166 and MRD-77 affect backend components that `ui-next` depends on.

## MRD-219: Stalled Migration

Ticket: [ISSUES.md](../ISSUES.md#L15). The route table distinguishes three migrated screens from eight stubs in [App.tsx](../ui-next/src/App.tsx#L14) and routes the unfinished pages to placeholder components beginning at [App.tsx](../ui-next/src/App.tsx#L43). The roadmap independently marks only three of eleven screens done and records the stall in [roadmap.ts](../ui-next/src/config/roadmap.ts#L33) and [roadmap.ts](../ui-next/src/config/roadmap.ts#L128).

**Root cause:** The rewrite stopped before those eight routes became working screens. The code and migration notes attribute that stall to the team losing its owner; this is primarily an ownership and incomplete-delivery issue, not a routing defect. The stubs are real placeholders, as shown by [StubScreen.tsx](../ui-next/src/components/StubScreen.tsx#L21).

**A fix would touch:** Ownership and delivery planning, the eight stub screen implementations, and the roadmap/status entries as screens are completed. It would also need service work for genuinely missing data, plus working UI tests: the current test script is a no-op in [package.json](../ui-next/package.json#L15). One migration note is already stale: it says Anomalies needs a service endpoint in [MIGRATION.md](../ui-next/MIGRATION.md#L44), but `/api/anomalies` is registered in [ApiServer.java](../services/src/ca/meridian/api/ApiServer.java#L61). Confirm endpoint requirements before building that endpoint again.

## MRD-166: Query Parameters Concatenated into SQL

Ticket: [ISSUES.md](../ISSUES.md#L11). `ui-next` calls the affected endpoints from [endpoints.ts](../ui-next/src/api/endpoints.ts#L27) and [endpoints.ts](../ui-next/src/api/endpoints.ts#L37). The Java handlers take `station` from the query and concatenate it into SQL in [ForecastHandler.java](../services/src/ca/meridian/api/ForecastHandler.java#L42) and [SeriesHandler.java](../services/src/ca/meridian/api/SeriesHandler.java#L41).

**Root cause:** The API treats a query parameter as SQL text rather than as a value to validate and safely bind or quote. This is a server-side boundary issue; the frontend's URL construction does not fix it. The service already has a quoting helper in [QueryBuilder.java](../services/src/ca/meridian/db/QueryBuilder.java#L49), but these older handlers bypass it.

**A fix would touch:** Both Java handlers, input validation or safe query construction, and service-level tests for hostile and malformed station values. The `ui-next` client need not change unless the API contract changes.

## MRD-77: SQLite CLI Subprocess in the Java Data Path

Ticket: [ISSUES.md](../ISSUES.md#L7). The Java API constructs its `Db` store adapter in [ApiServer.java](../services/src/ca/meridian/api/ApiServer.java#L30); that adapter launches `sqlite3` as a subprocess in [Db.java](../services/src/ca/meridian/db/Db.java#L30). Thus `ui-next` requests rely on this process-based store access through the service.

**Root cause:** The Java layer shells out to a system executable for database queries instead of using an in-process database interface. That adds a runtime dependency and process overhead to API requests, and leaves the service coupled to command-line output handling.

**A fix would touch:** The Java `Db` abstraction and its consumers, service dependency/build configuration, and tests for query behavior and error handling. The collector has a parallel C implementation, so addressing the whole ticket would also touch [tsstore.c](../ingest/src/tsstore.c). The `ui-next` API contract can remain unchanged if the service preserves its current responses.