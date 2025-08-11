import { useCallback } from 'react'
import { Cartesian3 as CesiumCartesian3, Math } from 'cesium'
import useCesiumViewer from './useCesiumViewer'
import { Button } from 'antd'
import { HomeOutlined } from '@ant-design/icons'
import { MapItemZIndex } from '../enum'
import './CustomButton.less'
const CustomButton = ({
  initialViewerInfo = {
    destination: CesiumCartesian3.fromDegrees(120.404, 30.915, 1000),
    orientation: {
      heading: Math.toRadians(0),
      pitch: Math.toRadians(-30),
      roll: 0.0,
    },
  },
}) => {
  const { viewer } = useCesiumViewer()
  const handleHome = useCallback(() => {
    if (!viewer) {
      console.warn('Viewer not found')
      return
    }

    viewer.camera.flyTo({
      ...initialViewerInfo,
      duration: 1.5,
    })
    // viewer.camera.setView(initialViewerInfo)
  }, [viewer])

  return (
    <div className='custom-toolbar' style={{ zIndex: MapItemZIndex.TOOLBAR }}>
      <Button
        icon={<HomeOutlined />}
        onClick={handleHome}
        className='cesium-button custom-tool-btn'
      />
    </div>
  )
}

export default CustomButton
