import { useContext } from 'react';
import CesiumViewerContext from './CesiumViewerContext';

// 创建自定义Hook方便使用上下文
const useCesiumViewer = () => {
  const context = useContext(CesiumViewerContext);
  if (context === undefined) {
    throw new Error('useCesiumViewer must be used within a CesiumViewerProvider');
  }
  return context;
};

export default useCesiumViewer;