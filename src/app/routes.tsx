import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { BatteryInfoPage } from '@/pages/BatteryInfoPage';
import { ParamConfigPage } from '@/pages/ParamConfigPage';
import { FaultRecordPage } from '@/pages/FaultRecordPage';
import { ExtendedCommandPage } from '@/pages/ExtendedCommandPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/battery" replace />} />
      <Route path="/battery" element={<BatteryInfoPage />} />
      <Route path="/params" element={<ParamConfigPage />} />
      <Route path="/faults" element={<FaultRecordPage />} />
      <Route path="/commands" element={<ExtendedCommandPage />} />
    </Routes>
  );
}

export function AppRouter({ children }: { children: React.ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}