import React, { useState } from 'react';
import type { Viewer } from 'cesium';
import CesiumViewerContext, { type CesiumViewerContextType } from './CesiumViewerContext';

// 创建Provider组件
const CesiumViewerProvider = ({ children }: { children: React.ReactNode }) => {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  
  const contextValue: CesiumViewerContextType = {
    viewer,
    setViewer
  };
  
  return (
    <CesiumViewerContext.Provider value={contextValue}>
      {children}
    </CesiumViewerContext.Provider>
  );
};

export default CesiumViewerProvider;
