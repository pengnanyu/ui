/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { HashRouter, Routes, Route, Navigate } from 'react-router';
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
  return <HashRouter>{children}</HashRouter>;
}