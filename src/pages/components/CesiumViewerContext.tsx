import { createContext } from 'react';
import type { Viewer } from 'cesium';

// 定义Cesium Viewer上下文类型
export interface CesiumViewerContextType {
  viewer: Viewer | null;
  setViewer: (viewer: Viewer | null) => void;
}

// 创建上下文
const CesiumViewerContext = createContext<CesiumViewerContextType | undefined>(undefined);

export default CesiumViewerContext;
