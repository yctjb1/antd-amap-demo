import '@ant-design/v5-patch-for-react-19'
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  Viewer as CesiumViewer,
  Cesium3DTileset,
  Model as ResiumModel,
} from 'resium'
import {
  Cartesian3 as CesiumCartesian3,
  HeadingPitchRoll,
  Transforms,
  Color as CesiumColor,
  Material,
  ScreenSpaceEventType,
  ScreenSpaceEventHandler,
} from 'cesium'
import * as Cesium from 'cesium'
import {
  Button,
  Modal,
  ConfigProvider,
  Form,
  Input,
  theme,
  Tabs,
  DatePicker,
  Tree,
} from 'antd'
import useCesiumViewer from '../components/useCesiumViewer'
import CustomButton from '../components/CustomButton'
import type { ThemeConfig } from 'antd/es/config-provider/context'
import { ModelStatus, MapItemZIndex } from '../enum/index'
import { getModelStatusText } from '../tool/index'
import TechHeader from '../components/TechHeader'
import TechFooter from '../components/TechFooter'
import {
  DownOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import zhCN from 'antd/locale/zh_CN'
import './index.less'

// 桥梁实体数据结构
interface BridgeEntity {
  id: string
  modelName: string
  description: string
  modelId: string
  epsg_3857: string
  uri: string
  nodes?: Record<string, any>
}

// 实体数据mock
const entityMock: BridgeEntity[] = [
  {
    id: 'test-bridge-model1',
    modelName: 'test模型',
    description: '这是一个使用GLB格式的3D模型',
    modelId: 'test-bridge-model1',
    epsg_3857: '13433492.4, 3692043.9, 45',
    uri: '/models/0808_3dtiles/tileset.json',
    nodes: {
      pillar1: {
        material: 'default',
        plan_time_begin: '2025-08-05 18:40:15',
        plan_time_end: null,
        status: ModelStatus.DEFAULT,
        real_time_begin: null,
        real_time_end: null,
        uuid: 'test-uuid-1',
        horizontal_distance: 13425,
        height: 2000,
        along_length: 5500,
        pier_no: 67,
        substructure: '盖梁柱',
        modelType: '墩柱',
        modelName: '墩柱1',
        buried_depth: -3106,
        guidepost_no: 'K44+395.734',
        mark: '', // 备注
      },
      pillar2: {
        material: 'default',
        plan_time_begin: '2025-08-05 18:40:15',
        plan_time_end: null,
        status: ModelStatus.PROCESS,
        real_time_begin: null,
        real_time_end: null,
        uuid: 'test-uuid-2',
        horizontal_distance: 13425,
        height: 2000,
        along_length: 5500,
        pier_no: 67,
        substructure: '盖梁柱',
        modelType: '墩柱',
        modelName: '墩柱2',
        buried_depth: -3106,
        guidepost_no: 'K44+395.734',
        mark: '', // 备注
      },
      pillar3: {
        material: 'default',
        plan_time_begin: '2025-08-05 18:40:15',
        plan_time_end: null,
        status: ModelStatus.SUCCESS,
        real_time_begin: null,
        real_time_end: null,
        uuid: 'test-uuid-2',
        horizontal_distance: 13425,
        height: 2000,
        along_length: 5500,
        pier_no: 67,
        substructure: '盖梁柱',
        modelType: '墩柱',
        modelName: '墩柱3',
        buried_depth: -3106,
        guidepost_no: 'K44+395.734',
        mark: '', // 备注
      },
      pillar4: {
        material: 'default',
        plan_time_begin: '2025-08-05 18:40:15',
        plan_time_end: null,
        status: ModelStatus.ERROR,
        real_time_begin: null,
        real_time_end: null,
        uuid: 'test-uuid-2',
        horizontal_distance: 13425,
        height: 2000,
        along_length: 5500,
        pier_no: 67,
        substructure: '盖梁柱',
        modelType: '墩柱',
        modelName: '墩柱4',
        buried_depth: -3106,
        guidepost_no: 'K44+395.734',
        mark: '', // 备注
      },
    },
  },
]

// 暗黑模式配置
const { darkAlgorithm } = theme
const darkTheme: ThemeConfig = {
  algorithm: darkAlgorithm,
  token: {
    colorPrimary: '#4096ff',
    colorBgContainer: '#1f1f1f',
    colorText: '#ffffff',
    controlHeight: 30,
    controlPaddingHorizontal: 8,
  },
}

const dateFormat = 'YYYY-MM-DD HH:mm:ss'

// 日期处理工具
const parseDate = (dateString: string | null): Dayjs | null => {
  if (!dateString) return null
  return dayjs(dateString, dateFormat)
}

const formatDate = (date: Dayjs | null): string | null => {
  if (!date) return null
  return date.format(dateFormat)
}

const CesiumMap = React.memo(
  React.forwardRef(
    (
      {
        onNodeClick,
        onCameraChange,
        onTilesetLoad,
        entities,
        setModelsReady,
        // onModelReady,
        onTilesetReady,
      },
      ref
    ) => {
      const viewerRef = ref || useRef<any>(null)
      const creditContainerRef = useRef<HTMLDivElement>()
      const { setViewer } = useCesiumViewer()

      if (!creditContainerRef.current) {
        creditContainerRef.current = document.createElement('div')
      }

      // 处理实体坐标
      const processEntityCoordinates = useCallback((epsg_3857: string) => {
        const coords = epsg_3857
          .split(',')
          .map((coord) => parseFloat(coord.trim()))
        const webMercatorProjection = new Cesium.WebMercatorProjection()
        const cartographic = webMercatorProjection.unproject(
          new Cesium.Cartesian3(coords[0], coords[1], coords[2] || 0)
        )

        const longitude = Cesium.Math.toDegrees(cartographic.longitude)
        const latitude = Cesium.Math.toDegrees(cartographic.latitude)

        return {
          longitude,
          latitude,
          height: cartographic.height,
        }
      }, [])

      // 初始位置和视角
      const initialPosition = useMemo(() => {
        const entityCoords = processEntityCoordinates(
          '13433492.4, 3692043.9, 45'
        )
        return CesiumCartesian3.fromDegrees(
          entityCoords.longitude,
          entityCoords.latitude - 0.00206,
          entityCoords.height + 100
        )
      }, [processEntityCoordinates])

      const initialViewerInfo = useMemo(
        () => ({
          destination: initialPosition,
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-30),
            roll: 0.0,
          },
        }),
        [initialPosition]
      )

      // 初始化地图和事件监听
      useEffect(() => {
        let handler: ScreenSpaceEventHandler | null = null
        let viewer: Cesium.Viewer | null = null
        const timer = setTimeout(() => {
          if (viewerRef.current && viewerRef.current.cesiumElement) {
            viewer = viewerRef.current.cesiumElement
            setViewer(viewer)

            if (!viewer.camera[Symbol.for('cameraInitialized')]) {
              viewer.camera.setView(initialViewerInfo)
              viewer.camera[Symbol.for('cameraInitialized')] = true
            }

            if (viewer[Symbol.for('eventListenersInitialized')]) {
              return
            }

            // 相机控制配置
            viewer.scene.screenSpaceCameraController.rotateEventTypes = [
              Cesium.CameraEventType.LEFT_DRAG,
            ]
            viewer.scene.screenSpaceCameraController.tiltEventTypes = [
              Cesium.CameraEventType.RIGHT_DRAG,
            ]
            viewer.scene.screenSpaceCameraController.zoomEventTypes = [
              Cesium.CameraEventType.WHEEL,
              Cesium.CameraEventType.PINCH,
            ]
            viewer.scene.screenSpaceCameraController.lookEventTypes = [
              Cesium.CameraEventType.MIDDLE_DRAG,
            ]

            // 移除默认事件
            viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
              Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
            )
            viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
              Cesium.ScreenSpaceEventType.LEFT_CLICK
            )

            // 绑定点击事件 - 修正节点获取逻辑
            handler = new ScreenSpaceEventHandler(viewer.canvas)

            handler.setInputAction((movement: any) => {
              const pickedObject = viewer.scene.pick(movement.position)
              console.log('拾取到的对象:', pickedObject)

              if (pickedObject instanceof Cesium.Cesium3DTileFeature) {
                const feature = pickedObject
                // 获取包含此要素的tileset
                const tileset = feature.tileset
                // 尝试获取要素的name属性
                const featureName =
                  feature.getProperty('name') || `feature-${feature.featureId}`
                console.log(`点击3D Tiles要素: ${featureName}`)

                // 获取tileset的ID（如果已设置）
                const tilesetId = tileset.tilesetId

                // 传递要素信息给父组件处理
                onNodeClick?.(tilesetId, feature, featureName, null, null)
              }
            }, ScreenSpaceEventType.LEFT_CLICK)

            // 相机变化监听
            const cameraHandler = () => {
              onCameraChange?.({
                position: CesiumCartesian3.clone(viewer.camera.position),
                direction: CesiumCartesian3.clone(viewer.camera.direction),
                up: CesiumCartesian3.clone(viewer.camera.up),
              })
            }
            viewer.camera.changed.addEventListener(cameraHandler)
            viewer[Symbol.for('eventListenersInitialized')] = true
          }
        }, 1000)

        return () => {
          clearTimeout(timer)
          handler?.destroy()
          if (viewer && typeof handler === 'function') {
            viewer.camera.changed.removeEventListener(handler)
          }
        }
      }, [onNodeClick, onCameraChange, initialViewerInfo, setViewer])

      // 生成模型矩阵
      const getModelMatrix = useCallback(
        (entity: BridgeEntity) => {
          const coords = processEntityCoordinates(entity.epsg_3857)
          const position = CesiumCartesian3.fromDegrees(
            coords.longitude,
            coords.latitude,
            coords.height
          )
          const heading = Cesium.Math.toRadians(15)
          const hpr = new HeadingPitchRoll(heading, 0, 0)

          return Transforms.headingPitchRollToFixedFrame(
            position,
            hpr,
            Cesium.Ellipsoid.WGS84
          )
        },
        [processEntityCoordinates]
      )

      return (
        <CesiumViewer
          ref={viewerRef}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
          timeline={false}
          animation={false}
          fullscreenButton={true}
          vrButton={false}
          geocoder={false}
          homeButton={false}
          infoBox={false}
          selectionIndicator={false}
          sceneModePicker={false}
          navigationHelpButton={false}
          navigationInstructionsInitiallyVisible={false}
          scene3DOnly={true}
          baseLayerPicker={false}
          skyBox={false}
          skyAtmosphere={false}
          useBrowserRecommendedResolution={true}
          resolutionScale={1.0}
          creditContainer={creditContainerRef.current}
        >
          {/* 3D Tiles 模型 */}
          <Cesium3DTileset
            url='/models/g524/tileset.json'
            onError={(error) => console.error('Tileset加载失败:', error)}
          />

          {/* 渲染所有GLB模型 */}
          {entities.map((entity: BridgeEntity) => {
            return (
              <Cesium3DTileset
                key={entity.id}
                url={entity.uri}
                modelMatrix={getModelMatrix(entity)}
                onReady={(tileset: Cesium.Cesium3DTileset) => {
                  // 为tileset添加自定义id
                  tileset.tilesetId = entity.id
                  onTilesetReady?.(entity.id, tileset)
                }}
              />
            )
          })}
          <CustomButton initialViewerInfo={initialViewerInfo} />
        </CesiumViewer>
      )
    }
  )
)
CesiumMap.displayName = 'CesiumMap'

// 自定义信息面板组件
const EntityInfoPanel = ({
  entityId,
  node,
  nodeName,
  nodeData,
  visible,
  onClose,
  allEntityData,
}) => {
  const [form] = Form.useForm()
  const [selectedEntityData, setSelectedEntityData] =
    useState<BridgeEntity | null>(null)

  useEffect(() => {
    if (nodeData) {
      form.setFieldsValue({
        ...nodeData,
        statusText: getModelStatusText(nodeData?.status as ModelStatus),
        plan_time_begin: parseDate(nodeData.plan_time_begin),
        plan_time_end: parseDate(nodeData.plan_time_end),
        real_time_begin: parseDate(nodeData.real_time_begin),
        real_time_end: parseDate(nodeData.real_time_end),
      })
    } else if (entityId && allEntityData) {
      const fullEntityData =
        allEntityData.find((item: BridgeEntity) => item.id === entityId) || null
      setSelectedEntityData(fullEntityData)
      if (fullEntityData) {
        form.setFieldsValue({
          modelName: fullEntityData.modelName,
          description: fullEntityData.description,
          statusText: getModelStatusText(
            (fullEntityData?.status as ModelStatus) || ModelStatus.DEFAULT
          ),
        })
      }
    }
  }, [entityId, nodeData, allEntityData, form])

  const panelTitle = nodeData
    ? `${nodeData.modelName || '节点'}${nodeName}`
    : selectedEntityData
    ? `${selectedEntityData.modelName} 信息`
    : '信息'

  if (!visible) return null

  const handleSubmit = () => {
    const values = form.getFieldsValue()
    const formattedValues = {
      ...values,
      plan_time_begin: formatDate(values.plan_time_begin),
      plan_time_end: formatDate(values.plan_time_end),
      real_time_begin: formatDate(values.real_time_begin),
      real_time_end: formatDate(values.real_time_end),
    }
    console.log('提交实体信息:', formattedValues)
  }
  const BaseInfoTabPane = () => (
    <>
      <Form.Item name='modelName' label='模型名称'>
        <Input readOnly />
      </Form.Item>

      <Form.Item name='modelType' label='类型'>
        <Input readOnly />
      </Form.Item>

      <Form.Item name='description' label='描述'>
        <Input.TextArea readOnly rows={3} />
      </Form.Item>

      <Form.Item name='modelId' label='模型ID'>
        <Input readOnly />
      </Form.Item>

      <Form.Item name='horizontal_distance' label='平距 (mm)'>
        <Input readOnly type='number' />
      </Form.Item>

      <Form.Item name='height' label='高度 (mm)'>
        <Input readOnly type='number' />
      </Form.Item>

      <Form.Item name='along_length' label='顺桥向长度 (mm)'>
        <Input readOnly type='number' />
      </Form.Item>

      <Form.Item name='pier_no' label='桥墩号'>
        <Input readOnly type='number' />
      </Form.Item>

      <Form.Item name='substructure' label='下部结构'>
        <Input readOnly />
      </Form.Item>

      <Form.Item name='buried_depth' label='埋深 (mm)'>
        <Input readOnly type='number' />
      </Form.Item>

      <Form.Item name='guidepost_no' label='里程桩号'>
        <Input readOnly />
      </Form.Item>

      <Form.Item name='uuid' label='UUID'>
        <Input readOnly />
      </Form.Item>
      <Form.Item name='epsg_3857' label='EPSG:3857 坐标'>
        <Input readOnly title='EPSG:3857坐标系' />
      </Form.Item>
    </>
  )
  const EditInfoTabPane = () => (
    <>
      <Form.Item name='plan_time_begin' label='计划开始时间'>
        <DatePicker
          format={dateFormat}
          showTime={{ defaultValue: dayjs('00:00:00', 'HH:mm:ss') }}
        />
      </Form.Item>

      <Form.Item name='plan_time_end' label='计划结束时间'>
        <DatePicker
          format={dateFormat}
          showTime={{ defaultValue: dayjs('00:00:00', 'HH:mm:ss') }}
        />
      </Form.Item>

      <Form.Item name='statusText' label='状态'>
        <Input readOnly />
      </Form.Item>

      <Form.Item name='real_time_begin' label='实际开始时间'>
        <DatePicker
          format={dateFormat}
          showTime={{ defaultValue: dayjs('00:00:00', 'HH:mm:ss') }}
        />
      </Form.Item>

      <Form.Item name='real_time_end' label='实际结束时间'>
        <DatePicker
          format={dateFormat}
          showTime={{ defaultValue: dayjs('00:00:00', 'HH:mm:ss') }}
        />
      </Form.Item>
      <Form.Item name='mark' label='备注'>
        <Input.TextArea showCount maxLength={100} />
      </Form.Item>
    </>
  )
  return (
    <ConfigProvider theme={darkTheme} locale={zhCN}>
      <div
        className='entity-info-panel'
        style={{
          zIndex: MapItemZIndex.ENTITYPANEL,
          position: 'absolute',
          top: 20,
          right: 20,
          width: 300,
          background: 'rgba(0,0,0,0.7)',
          padding: 15,
          borderRadius: 4,
          color: 'white',
        }}
      >
        <div className='common-title-wrapper'>
          <h3>{panelTitle}</h3>
          <div style={{ float: 'right' }}>
            <Button
              type='primary'
              htmlType='submit'
              size='small'
              style={{ marginRight: 8 }}
              onClick={handleSubmit}
            >
              提交
            </Button>
            <Button onClick={onClose} danger size='small'>
              关闭
            </Button>
          </div>
          <div style={{ clear: 'both' }}></div>
        </div>
        <Form
          form={form}
          layout='horizontal'
          onFinish={handleSubmit}
          size='small'
          labelCol={{
            span: 12,
          }}
          wrapperCol={{
            span: 12,
            style: { paddingRight: 8 },
          }}
          labelAlign='left'
        >
          <Tabs
            defaultActiveKey='1'
            style={{ marginBottom: 20 }}
            items={[
              {
                label: '基本信息',
                key: '1',
                children: <BaseInfoTabPane />,
              },
              {
                label: '提交信息',
                key: '2',
                children: <EditInfoTabPane />,
              },
            ]}
          ></Tabs>
        </Form>
      </div>
    </ConfigProvider>
  )
}

// 总的整合组件
// 总的整合组件
const Home = () => {
  const [modal, contextHolder] = Modal.useModal()
  const [selectedNode, setSelectedNode] = useState<{
    entityId: string
    node: any
    nodeName: string
    nodeData: any
    nodeIndex: number
  } | null>(null)
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [cameraState, setCameraState] = useState<any>(null)
  const [componentTree, setComponentTree] = useState<any[]>([])
  const [treeVisible, setTreeVisible] = useState(false)
  const viewerRef = useRef<any>(null)
  const { viewer } = useCesiumViewer()
  const discoveredFeaturesRef = useRef<Map<string, any>>(new Map())
  const componentVisibilityRef = useRef<Map<string, boolean>>(new Map())
  // 添加一个ref来跟踪所有被隐藏的构件
  const hiddenComponentsRef = useRef<Set<string>>(new Set())
  // 在 Home 组件中添加 tileset 引用存储
  const tilesetsRef = useRef<Map<string, Cesium.Cesium3DTileset>>(new Map())
  // 存储当前高亮的要素
  const highlightedFeaturesRef = useRef<{
    entityId: string
    feature: Cesium.Cesium3DTileFeature
    originalStyle: any
  } | null>(null)

  // 轮询获取viewer实例
  useEffect(() => {
    const timer = setInterval(() => {
      if (viewerRef.current?.cesiumElement) {
        console.log('获取到 viewer 实例')
        clearInterval(timer)
      }
    }, 500)
    return () => clearInterval(timer)
  }, [])

  // 基础处理函数（无依赖）
  const handleCameraChange = useCallback((state: any) => {
    setCameraState(state)
  }, [])

  const handleTilesetLoad = useCallback(() => {
    console.log('Tileset loaded')
  }, [])

  // 自定义树节点标题组件
  const TreeNodeTitle = ({
    title,
    show,
    onToggle,
    componentName,
  }: {
    title: string
    show: boolean
    onToggle: () => void
    componentName: string
  }) => {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ flex: 1 }}>{title}</span>
        <Button
          type='text'
          icon={show ? <EyeOutlined /> : <EyeInvisibleOutlined />}
          onClick={(e) => {
            e.stopPropagation() // 阻止事件冒泡，避免触发节点选择
            onToggle()
          }}
          style={{
            color: show ? 'white' : 'gray',
            fontSize: '12px',
            width: '24px',
            height: '24px',
            minWidth: '24px',
          }}
        />
      </div>
    )
  }

  // 获取构件详细信息（依赖较少）
  const getFeatureDetails = useCallback(
    (tileset: Cesium.Cesium3DTileset, featureName: string) => {
      let foundFeature: Cesium.Cesium3DTileFeature | null = null

      // 递归遍历查找指定名称的构件
      const traverse = (tile: Cesium.Cesium3DTile) => {
        if (!tile || foundFeature) return

        // 检查tile内容是否包含构件信息
        if (tile.content && tile.content.features) {
          // 遍历所有features
          for (let i = 0; i < tile.content.features.length; i++) {
            const feature = tile.content.features[i]
            const name =
              feature.getProperty('name') || `feature-${feature.featureId}`
            if (name === featureName) {
              foundFeature = feature
              return
            }
          }
        }

        // 递归处理子tiles
        if (tile.children && !foundFeature) {
          for (let i = 0; i < tile.children.length; i++) {
            traverse(tile.children[i])
          }
        }
      }

      // 从根tile开始遍历
      if (tileset.root) {
        traverse(tileset.root)
      }

      return foundFeature
    },
    []
  )

  // 处理名称显示/隐藏（基础函数）
  const handleNameShow = useCallback(
    (
      componentName: string,
      visible: boolean,
      tilesetId: string = 'test-bridge-model1'
    ) => {
      if (!tilesetsRef) {
        console.warn('TilesetsRef not found')
        return
      }

      // 获取test-bridge-model1对应的tileset
      const tileset = tilesetsRef.current.get(tilesetId)
      if (!tilesetId || !tileset) {
        console.warn('tilesetId not found')
        return
      }

      // 更新隐藏列表
      if (visible) {
        // 如果要显示，从隐藏列表中移除
        hiddenComponentsRef.current.delete(componentName)
      } else {
        // 如果要隐藏，添加到隐藏列表
        hiddenComponentsRef.current.add(componentName)
      }

      // 构建条件数组，隐藏列表中的构件设为false，其他设为true
      const conditions: [string | boolean, boolean][] = []

      // 为每个隐藏的构件添加条件
      hiddenComponentsRef.current.forEach((hiddenName) => {
        conditions.push([`\${name} === '${hiddenName}'`, false])
      })

      // 默认显示所有其他构件
      conditions.push([true, true])

      // 使用Cesium3DTileStyle应用新的显示/隐藏状态
      tileset.style = new Cesium.Cesium3DTileStyle({
        show: {
          conditions: conditions,
        },
      })

      console.log(
        `${
          visible ? '显示' : '隐藏'
        } test-bridge-model1 中的 ${componentName} 子构件`
      )
    },
    [tilesetsRef]
  )

  const buildComponentTree = useCallback(() => {
    const treeData: any[] = []

    // 获取test-bridge-model1实体数据
    const entityData = entityMock.find(
      (item) => item.id === 'test-bridge-model1'
    )

    if (entityData) {
      // 构建二级节点（构件节点）
      const children: any[] = []

      // 使用已发现的构件构建二级树
      discoveredFeaturesRef.current.forEach((featureInfo, featureName) => {
        const show = componentVisibilityRef.current.get(featureName) ?? true
        children.push({
          key: featureName,
          title: (
            <TreeNodeTitle
              title={featureInfo.nodeName || featureName}
              show={show}
              onToggle={() => toggleComponentVisibility(featureName)}
              componentName={featureName}
            />
          ),
          isLeaf: true,
          feature: featureInfo.feature,
          show: show,
        })
      })

      // 如果没有任何已发现的构件，使用预定义数据
      if (children.length === 0 && entityData.nodes) {
        Object.keys(entityData.nodes).forEach((nodeName) => {
          const show = componentVisibilityRef.current.get(nodeName) ?? true
          children.push({
            key: nodeName,
            title: (
              <TreeNodeTitle
                title={entityData.nodes![nodeName].modelName || nodeName}
                show={show}
                onToggle={() => toggleComponentVisibility(nodeName)}
                componentName={nodeName}
              />
            ),
            isLeaf: true,
            show: show,
          })
        })
      }

      // 获取第一级节点的显示状态
      const modelShow =
        componentVisibilityRef.current.get('test-bridge-model1') ?? true

      // 构建第一级节点
      treeData.push({
        key: 'test-bridge-model1',
        title: (
          <TreeNodeTitle
            title={entityData.modelName || 'test模型'}
            show={modelShow}
            onToggle={() => toggleModelVisibility('test-bridge-model1')}
            componentName='test-bridge-model1'
          />
        ),
        children: children,
        show: modelShow,
      })
    }

    return treeData
  }, [])
  // 切换构件显示状态（依赖 handleNameShow）
  const toggleComponentVisibility = useCallback(
    (componentName: string) => {
      // 更新显示状态
      const currentVisibility =
        componentVisibilityRef.current.get(componentName) ?? true
      const newVisibility = !currentVisibility
      componentVisibilityRef.current.set(componentName, newVisibility)

      // 应用到3D模型
      handleNameShow(componentName, newVisibility)

      // 检查是否所有子构件都隐藏了，如果是，则也隐藏父级模型
      const entityData = entityMock.find(
        (item) => item.id === 'test-bridge-model1'
      )
      if (entityData && entityData.nodes) {
        const allHidden = Object.keys(entityData.nodes).every(
          (nodeName) => !componentVisibilityRef.current.get(nodeName)
        )

        // 更新模型的显示状态
        if (allHidden) {
          componentVisibilityRef.current.set('test-bridge-model1', false)
        } else {
          componentVisibilityRef.current.set('test-bridge-model1', true)
        }
      }

      // 重新构建整个树以确保状态一致性
      const treeData = buildComponentTree()
      setComponentTree(treeData)
    },
    [handleNameShow, buildComponentTree]
  )
  // 处理3D Tiles要素点击
  const handleTileFeatureClick = useCallback(
    (
      entityId: string,
      feature: Cesium.Cesium3DTileFeature,
      featureName: string
    ) => {
      console.log(`点击3D Tiles要素: ${featureName}，实体ID: ${entityId}`)

      // 获取对应的tileset
      const tileset = tilesetsRef.current.get(entityId)
      if (!tileset) {
        console.warn(`未找到ID为${entityId}的tileset`)
        return
      }

      // 获取节点数据
      const currentEntityData = entityMock.find((item) => item.id === entityId)
      const nodeData = currentEntityData?.nodes?.[featureName]
      const nodeStatus =
        (nodeData?.status as ModelStatus) || ModelStatus.DEFAULT

      setSelectedNode((prev) => {
        // 如果之前高亮的是3D Tiles要素，取消高亮
        if (prev && highlightedFeaturesRef.current) {
          const { entityId: prevEntityId, feature: prevFeature } =
            highlightedFeaturesRef.current
          const prevTileset = tilesetsRef.current.get(prevEntityId)

          if (prevTileset) {
            // 恢复之前的tileset样式
            prevTileset.style = new Cesium.Cesium3DTileStyle({})
            console.log(`恢复3D Tiles ${prevEntityId}的样式`)
          }

          // 清除高亮引用
          highlightedFeaturesRef.current = null
        }

        // 如果点击的是同一个要素，则取消选择
        if (prev?.entityId === entityId && prev?.nodeName === featureName) {
          console.log('关闭信息面板')
          setShowInfoPanel(false)
          return null
        }

        // 高亮当前要素
        const colorMap = {
          [ModelStatus.DEFAULT]: "color('rgba(34, 139, 230, 0.7)')",
          [ModelStatus.PROCESS]: "color('rgba(255, 165, 0, 0.7)')",
          [ModelStatus.SUCCESS]: "color('rgba(50, 205, 50, 0.7)')",
          [ModelStatus.ERROR]: "color('rgba(255, 99, 71, 0.7)')",
        }

        const highlightColor =
          colorMap[nodeStatus] || colorMap[ModelStatus.DEFAULT]

        tileset.style = new Cesium.Cesium3DTileStyle({
          color: {
            conditions: [
              [`\${name} === '${featureName}'`, highlightColor],
              [true, "color('#ffffff')"],
            ],
          },
        })

        console.log(`高亮3D Tiles要素: ${featureName}`)

        // 记录当前高亮的要素
        highlightedFeaturesRef.current = {
          entityId,
          feature,
          originalStyle: tileset.style, // 保存原始样式
        }

        // 显示信息面板
        setShowInfoPanel(true)

        return {
          entityId,
          node: feature,
          nodeName: featureName,
          nodeData,
          nodeIndex: -1, // 对于3D Tiles要素，使用-1表示
        }
      })
    },
    []
  )

  // 节点点击处理 - 修正面板显示逻辑
  const handleNodeClick = useCallback(
    (
      entityId: string,
      node: any,
      nodeName: string,
      model: Cesium.Model,
      nodeIndex: number
    ) => {
      // 处理3D Tiles要素点击
      if (node instanceof Cesium.Cesium3DTileFeature) {
        handleTileFeatureClick(entityId, node, nodeName)
        return
      }
    },
    [handleTileFeatureClick]
  )

  // 关闭信息面板时恢复材质
  const handleClosePanel = useCallback(() => {
    if (selectedNode) {
      // 如果是3D Tiles要素，恢复样式
      if (selectedNode.node instanceof Cesium.Cesium3DTileFeature) {
        const tileset = tilesetsRef.current.get(selectedNode.entityId)
        if (tileset) {
          // 恢复默认样式
          tileset.style = new Cesium.Cesium3DTileStyle({})
          console.log(`恢复3D Tiles ${selectedNode.entityId}的样式`)
        }
        highlightedFeaturesRef.current = null
      }
    }
    setSelectedNode(null)
    setShowInfoPanel(false)
  }, [selectedNode])

  const handleTilesetReady = useCallback(
    (entityId: string, tileset: Cesium.Cesium3DTileset) => {
      tilesetsRef.current.set(entityId, tileset)

      // 当test-bridge-model1加载完成时，构建初始构件树
      if (entityId === 'test-bridge-model1') {
        // 初始化模型为可见
        componentVisibilityRef.current.set('test-bridge-model1', true)

        // 初始化所有构件为可见
        const entityData = entityMock.find(
          (item) => item.id === 'test-bridge-model1'
        )
        if (entityData && entityData.nodes) {
          Object.keys(entityData.nodes).forEach((nodeName) => {
            componentVisibilityRef.current.set(nodeName, true)
          })
        }

        const treeData = buildComponentTree()
        setComponentTree(treeData)
      }
    },
    [buildComponentTree]
  )

  // 加载构件树
  const loadComponentTree = useCallback(
    (tilesetId: string = 'test-bridge-model1', show: boolean = true) => {
      const tileset = tilesetsRef.current.get(tilesetId)
      if (!tileset) {
        console.warn(`未找到ID为${tilesetId}的tileset`)
        return
      }

      // 构建构件树
      const treeData = buildComponentTree()
      console.log('tileset', tileset)
      console.log('构件树数据：', treeData)
      if (show) {
        setComponentTree(treeData)
        setTreeVisible(true)
      } else {
        setTreeVisible(false)
      }
    },
    [buildComponentTree]
  )

  // 点击构件树节点
  const onTreeNodeSelect = useCallback(
    (selectedKeys: any[], info: any) => {
      console.log('选中节点:', selectedKeys, info)

      // 只处理叶子节点（实际构件）
      if (selectedKeys.length > 0 && info.node.isFeature) {
        const featureName = info.node.key
        const tilesetId = 'test-bridge-model1' // 假设我们只处理这个模型

        // 获取tileset
        const tileset = tilesetsRef.current.get(tilesetId)
        if (!tileset) {
          console.warn(`未找到ID为${tilesetId}的tileset`)
          return
        }

        // 查找构件
        const feature = getFeatureDetails(tileset, featureName)
        if (feature) {
          // 触发点击处理
          handleTileFeatureClick(tilesetId, feature, featureName)
        } else {
          console.warn(`未找到构件: ${featureName}`)
        }
      }
    },
    [handleTileFeatureClick, getFeatureDetails]
  )
  // 添加控制整个模型显示/隐藏的函数
  const toggleModelVisibility = useCallback(
    (modelId: string) => {
      // 更新模型的显示状态
      const currentVisibility =
        componentVisibilityRef.current.get(modelId) ?? true
      const newVisibility = !currentVisibility
      componentVisibilityRef.current.set(modelId, newVisibility)

      // 获取模型实体数据
      const entityData = entityMock.find((item) => item.id === modelId)
      if (entityData && entityData.nodes) {
        // 设置所有子构件的显示状态与模型一致
        Object.keys(entityData.nodes).forEach((nodeName) => {
          componentVisibilityRef.current.set(nodeName, newVisibility)
          // 更新3D模型中对应构件的显示状态
          handleNameShow(nodeName, newVisibility, modelId)
        })
      }

      // 重新构建树
      const treeData = buildComponentTree()
      setComponentTree(treeData)
    },
    [handleNameShow, buildComponentTree]
  )
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {contextHolder}
      <TechHeader
        title='相城高铁新城G524改造施工段示意'
        zIndex={MapItemZIndex.HEADER}
      />

      <CesiumMap
        ref={viewerRef}
        entities={entityMock}
        onNodeClick={handleNodeClick}
        onCameraChange={handleCameraChange}
        onTilesetLoad={handleTilesetLoad}
        onTilesetReady={handleTilesetReady}
      />

      <EntityInfoPanel
        entityId={selectedNode?.entityId}
        node={selectedNode?.node}
        nodeName={selectedNode?.nodeName}
        nodeData={selectedNode?.nodeData}
        visible={showInfoPanel}
        onClose={handleClosePanel}
        allEntityData={entityMock}
      />

      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: MapItemZIndex.TOOLBAR,
        }}
      >
        {/* 自定义按钮 */}
        <ConfigProvider theme={darkTheme} locale={zhCN}>
          {!treeVisible ? (
            <Button
              onClick={() => loadComponentTree('test-bridge-model1', true)}
              className='cesium-button custom-tool-btn'
            >
              显示构件树
            </Button>
          ) : (
            <Button
              onClick={() => loadComponentTree('test-bridge-model1', false)}
              className='cesium-button custom-tool-btn'
            >
              隐藏构件树
            </Button>
          )}
          {treeVisible && (
            <Tree
              treeData={componentTree}
              onSelect={onTreeNodeSelect}
              defaultExpandAll
              showLine
              switcherIcon={<DownOutlined />}
            />
          )}
        </ConfigProvider>
      </div>
      <TechFooter zIndex={MapItemZIndex.FOOTER} />
    </div>
  )
}

export default Home
