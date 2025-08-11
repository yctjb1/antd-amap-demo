import React from 'react';
import './index.less';

interface TechFooterProps {
  // 可选的坐标信息
  zIndex: number;
}

/**
 * 科技风格的底部组件
 * 设计紧凑，不遮挡按钮，保持科技感
 */
const TechFooter: React.FC<TechFooterProps> = ({ 
  zIndex
}) => {
  return (
    <div className="tech-footer" style={{ zIndex }}>
      {/* 装饰性网格背景 */}
      <div className="footer-grid"></div>
      
      {/* 顶部发光线条 */}
      <div className="footer-glow"></div>
      
      {/* 左侧装饰条 */}
      <div className="footer-accent left"></div>
      
      {/* 内容区域 */}
      <div className="footer-content">
        <div className="system-info">© 2025 工程可视化系统-苏州幻枫网络</div>
      </div>
      
      {/* 右侧装饰条 */}
      {/* <div className="footer-accent right"></div> */}
    </div>
  );
};

export default TechFooter;
