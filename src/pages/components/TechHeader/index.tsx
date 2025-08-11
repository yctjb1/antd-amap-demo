import React from 'react'
import './index.less'

interface TechHeaderProps {
  // 标题内容，可选
  title?: string
  // 标题图片，可选，与title二选一
  titleImage?: string
  zIndex: number
}

/**
 * 科技风格的头部组件
 * 留有标题或标题图片的位置，采用科技感设计
 */
const TechHeader: React.FC<TechHeaderProps> = ({ title, titleImage, zIndex }) => {
  return (
    <div className='tech-header' style={{ zIndex }}>
      {/* 装饰性网格背景 */}
      <div className='header-grid'></div>

      {/* 标题区域 */}
      <div className='header-content'>
        <div className='title-wrapper'>
          {/* 左侧装饰条 */}
          {/* <div className='header-accent left'></div> */}
          {titleImage ? (
            <img src={titleImage} alt='项目标题' className='title-image' />
          ) : (
            <h1 className='header-title'>{title || '项目标题'}</h1>
          )}
          <div className='title-bg-top'></div>
          <div className='title-bg-bottom'></div>
          {/* 右侧装饰条 */}
          {/* <div className='header-accent right'></div> */}
        </div>
      </div>

      {/* 底部发光线条 */}
      <div className='header-glow'></div>
    </div>
  )
}

export default TechHeader
