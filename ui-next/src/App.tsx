// src/App.tsx
// J. Ferreira, 2023-06 — route table for all eleven screens.
//
// Every screen the console was ever meant to have is routed here, so the app
// is navigable end to end. Three routes render real, API-backed screens; the
// other eight render stubs. Keeping the stub routes live (rather than 404ing
// them) is the point: an operator who clicks "Anomalies" lands on a page that
// tells them why it isn't here and where to go instead.

import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DEFAULT_ROUTE } from './config/nav';

// --- the three migrated screens (real, consume the API) ---
import { StationsScreen } from './screens/StationsScreen';
import { ForecastScreen } from './screens/ForecastScreen';
import { HealthScreen } from './screens/HealthScreen';

// --- the eight stubbed screens (not migrated) ---
import { AnomaliesScreen } from './screens/AnomaliesScreen';
import { CompareScreen } from './screens/CompareScreen';
import { DataQualityScreen } from './screens/DataQualityScreen';
import { IngestMonitorScreen } from './screens/IngestMonitorScreen';
import { ModelRunsScreen } from './screens/ModelRunsScreen';
import { AuditLogScreen } from './screens/AuditLogScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AboutScreen } from './screens/AboutScreen';

import { NotFoundScreen } from './screens/NotFoundScreen';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to={DEFAULT_ROUTE} replace />} />

        {/* migrated */}
        <Route path="/stations" element={<StationsScreen />} />
        <Route path="/forecast" element={<ForecastScreen />} />
        <Route path="/health" element={<HealthScreen />} />

        {/* stubs — see MIGRATION.md (MRD-219) */}
        <Route path="/anomalies" element={<AnomaliesScreen />} />
        <Route path="/compare" element={<CompareScreen />} />
        <Route path="/quality" element={<DataQualityScreen />} />
        <Route path="/ingest" element={<IngestMonitorScreen />} />
        <Route path="/runs" element={<ModelRunsScreen />} />
        <Route path="/audit" element={<AuditLogScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/about" element={<AboutScreen />} />

        <Route path="*" element={<NotFoundScreen />} />
      </Route>
    </Routes>
  );
}
