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
} from 'antd'
import useCesiumViewer from '../components/useCesiumViewer'
import CustomButton from '../components/CustomButton'
import type { ThemeConfig } from 'antd/es/config-provider/context'
import { ModelStatus, MapItemZIndex } from '../enum/index'
import { getModelStatusText } from '../tool/index'
import TechHeader from '../components/TechHeader'
import TechFooter from '../components/TechFooter'
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
    uri: '/models/0806-7.glb',
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
        onModelReady,
      },
      ref
    ) => {
      const viewerRef = ref || useRef<any>(null)
      const isTilesetLoaded = useRef(false)
      const processedEntities = useRef<Set<string>>(new Set())
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

      const handleTilesetReady = useCallback(
        (tileset) => {
          if (!isTilesetLoaded.current) {
            console.log('3D Tiles model loaded successfully')
            isTilesetLoaded.current = true
            onTilesetLoad?.()
          }
        },
        [onTilesetLoad]
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

              // 检查是否拾取到模型图元
              if (Cesium.defined(pickedObject) && pickedObject.primitive) {
                // 处理Model组件（ModelPrimitive）
                if (pickedObject.primitive instanceof Cesium.Model) {
                  const model = pickedObject.primitive // 直接使用Model实例
                  const entityId = model.id // 对应实体ID

                  console.log(`点击模型: ${entityId}`)

                  // 从pickedObject.detail获取节点名称
                  let clickedNodeName = null
                  if (pickedObject.detail?.node?.node?.name) {
                    clickedNodeName = pickedObject.detail?.node?.node?.name
                    console.log(`点击的节点名称: ${clickedNodeName}`)
                  } else if (pickedObject.detail?.node?._name) {
                    clickedNodeName = pickedObject.detail?.node?._name
                    console.log(`点击的节点名称: ${clickedNodeName}`)
                  }

                  // 传递节点名称给父组件处理
                  if (clickedNodeName) {
                    onNodeClick?.(entityId, null, clickedNodeName, model, null)
                  }
                }
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

      // 模型加载完成处理 - 修正节点获取方式
      const handleModelReady = useCallback(
        (model: Cesium.Model, entity: BridgeEntity) => {
          if (!processedEntities.current.has(entity.id)) {
            console.log(`模型${entity.id}加载完成，开始获取节点...`)
            console.log(model)

            // 确保模型完全加载
            const checkNodes = () => {
              // 正确的方式获取模型节点
              let nodes: any[] = []

              // 根据你提供的信息，使用_nodesByName获取节点名称，然后直接使用nodes数组
              if (model._nodesByName) {
                // 从_nodesByName获取所有节点名称
                const nodeNames = Object.keys(model._nodesByName)
                console.log('从_nodesByName获取节点名称:', nodeNames)

                nodes = nodeNames
                  .map((nodeName: string) => {
                    try {
                      return model.getNode(nodeName)
                    } catch (e) {
                      console.warn(`无法获取节点 ${nodeName}:`, e)
                      return null
                    }
                  })
                  .filter((node) => node !== null)
                console.log('nodes', nodes)
              }

              if (nodes.length > 0) {
                console.log(
                  `模型${entity.id}节点信息:`,
                  nodes.map((n) => n.name || n.id || '无名节点')
                )
                processedEntities.current.add(entity.id)
                setModelsReady(true)
                // 在传递节点之前，为每个节点添加_runtimeNode引用（如果需要）
                const enrichedNodes = nodes.map((node, index) => {
                  // 如果节点没有_runtimeNode属性，但有对应的runtimeNode，添加引用
                  if (
                    !node._runtimeNode &&
                    model._sceneGraph &&
                    model._sceneGraph._runtimeNodes
                  ) {
                    // 查找对应的runtimeNode
                    const runtimeNode = model._sceneGraph._runtimeNodes.find(
                      (rn: any) => rn._node?.name === node.name
                    )
                    if (runtimeNode) {
                      // 给节点添加_runtimeNode引用
                      node._runtimeNode = runtimeNode
                    }
                  }
                  return node
                })
                onModelReady?.(model, entity.id, enrichedNodes)
              } else {
                // 模型可能尚未完全加载，延迟重试
                console.log(`模型${entity.id}节点尚未准备好，重试中...`)
                setTimeout(checkNodes, 500)
              }
            }

            // 初始检查
            checkNodes()
          }
        },
        [onModelReady, setModelsReady]
      )

      // 生成模型矩阵
      const getModelMatrix = useCallback(
        (entity: BridgeEntity) => {
          const coords = processEntityCoordinates(entity.epsg_3857)
          const position = CesiumCartesian3.fromDegrees(
            coords.longitude,
            coords.latitude,
            coords.height
          )
          const heading = Cesium.Math.toRadians(105)
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
            onReady={handleTilesetReady}
            onError={(error) => console.error('Tileset加载失败:', error)}
          />

          {/* 渲染所有GLB模型 */}
          {entities.map((entity) => (
            <ResiumModel
              key={entity.id}
              id={entity.id}
              url={entity.uri}
              modelMatrix={getModelMatrix(entity)}
              scale={1}
              allowPicking={true}
              colorBlendMode={Cesium.ColorBlendMode.MIX}
              color={CesiumColor.WHITE.withAlpha(1.0)}
              onReady={(model) => handleModelReady(model, entity)}
              onError={(error) =>
                console.error(`模型${entity.id}加载失败:`, error)
              }
            />
          ))}
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
  const viewerRef = useRef<any>(null)
  const [viewerInstance, setViewerInstance] = useState<Cesium.Viewer | null>(
    null
  )
  const { viewer } = useCesiumViewer()
  const [modelsReady, setModelsReady] = useState(false)

  // 缓存模型原始材质和节点信息
  const originalMaterialsRef = useRef<Map<string, any>>(new Map())
  const modelNodesRef = useRef<Map<string, any[]>>(new Map()) // 存储每个模型的节点列表

  const getHighlightMaterial = useCallback((status: ModelStatus) => {
    const materialConfig = {
      [ModelStatus.DEFAULT]: CesiumColor.fromCssColorString(
        'rgba(34, 139, 230, 0.7)'
      ),
      [ModelStatus.PROCESS]: CesiumColor.fromCssColorString(
        'rgba(255, 165, 0, 0.7)'
      ),
      [ModelStatus.SUCCESS]: CesiumColor.fromCssColorString(
        'rgba(50, 205, 50, 0.7)'
      ),
      [ModelStatus.ERROR]: CesiumColor.fromCssColorString(
        'rgba(255, 99, 71, 0.7)'
      ),
    }
    return Material.fromType(Material.ColorType, {
      color: materialConfig[status] || materialConfig[ModelStatus.DEFAULT],
    })
  }, [])
  // 轮询获取viewer实例
  useEffect(() => {
    const timer = setInterval(() => {
      if (viewerRef.current?.cesiumElement) {
        console.log('获取到 viewer 实例')
        setViewerInstance(viewerRef.current.cesiumElement)
        clearInterval(timer)
      }
    }, 500)
    return () => clearInterval(timer)
  }, [])

  // 模型加载完成处理 - 缓存节点和材质
  const handleModelReady = useCallback(
    (model: Cesium.Model, entityId: string, nodes: Cesium.ModelNode[]) => {
      console.log(`模型${entityId}加载完成，节点数量:`, nodes.length)
      console.log('节点数据:', nodes)
      modelNodesRef.current.set(entityId, nodes)
      modelInstancesRef.current.set(entityId, model) // 存储模型实例

      // 缓存原始材质
      nodes.forEach((node: Cesium.ModelNode, index: number) => {
        // 检查多种可能的图元属性
        let primitives: any[] = []

        if (
          node._runtimeNode &&
          node._runtimeNode.runtimePrimitives &&
          Array.isArray(node._runtimeNode.runtimePrimitives)
        ) {
          // 通过_runtimeNode访问
          primitives = node._runtimeNode.runtimePrimitives
        }

        console.log(
          `节点${index} (${node.name || 'unknown'}) 找到图元数量: ${
            primitives.length
          }`
        )

        if (primitives && primitives.length > 0) {
          let validMaterialCount = 0
          primitives.forEach((runtimePrimitive: any, pIndex: number) => {
            const key = `${entityId}-${index}-${pIndex}`

            const originalMaterial = runtimePrimitive.primitive?.material
            console.log(
              `===节点${index}图元${pIndex}缓存的原始材质:`,
              originalMaterial
            )
            console.log(
              `===节点${index}图元${pIndex}缓存的原始材质颜色:`,
              originalMaterial?.uniforms?.color?.toBytes()
            )
            // 检查内部primitive对象的材质
            // 无论材质是否存在，都缓存实际的值（包括undefined）
            originalMaterialsRef.current.set(
              key,
              runtimePrimitive.primitive?.material
            )
            if (runtimePrimitive.primitive?.material) {
              console.log(`缓存材质: ${key}`)
              validMaterialCount++
            } else {
              console.log(`缓存 undefined 材质: ${key}`)
            }
          })
          console.log(
            `节点${index}图元数量: ${primitives.length}, 处理材质数量: ${primitives.length}`
          )
        } else {
          console.warn(
            `节点${index} (${
              node.name || 'unknown'
            }) 没有找到图元数据，无法处理材质`
          )
        }
      })
    },
    []
  )
  // 节点高亮/恢复材质
  const toggleNodeMaterial = useCallback(
    (
      entityId: string,
      node: any,
      nodeIndex: number,
      highlight: boolean,
      status: ModelStatus
    ) => {
      if (!viewerInstance) {
        console.error('无法切换材质：viewer实例不存在')
        return
      }

      // 检查多种可能的图元属性
      let primitives: any[] = []

      if (
        node._runtimeNode &&
        node._runtimeNode.runtimePrimitives &&
        Array.isArray(node._runtimeNode.runtimePrimitives)
      ) {
        // 通过_runtimeNode访问
        primitives = node._runtimeNode.runtimePrimitives
      }

      if (!primitives || primitives.length === 0) {
        console.error('无法切换材质：节点没有图元')
        return
      }

      const material = highlight ? getHighlightMaterial(status) : null
      console.log('===将要应用的新材质:', material)
      console.log(
        '===将要应用的材质颜色:',
        material?.uniforms?.color?.toBytes()
      )
      let appliedCount = 0

      primitives.forEach((runtimePrimitive: any, pIndex: number) => {
        const key = `${entityId}-${nodeIndex}-${pIndex}`

        // 确保内部的primitive对象存在
        if (!runtimePrimitive.primitive) {
          console.warn(`图元${pIndex}没有内部primitive对象`)
          return
        }
        console.log('===========================')
        console.log(
          '===应用材质前 - 完整材质:',
          runtimePrimitive.primitive.material
        )
        console.log(
          '===应用材质前 - 材质颜色:',
          runtimePrimitive.primitive.material?.uniforms?.color?.toBytes()
        )
        // 打印原始材质信息
        if (highlight) {
          console.log(
            '原始材质类型:',
            runtimePrimitive.primitive.material?.type
          )
          console.log(
            '原始材质uniforms:',
            runtimePrimitive.primitive.material?.uniforms
          )
          // 检查是否有其他与材质相关的属性
          console.log('primitive的其他可能材质相关属性:', {
            appearance: runtimePrimitive.primitive.appearance,
            renderState: runtimePrimitive.primitive.renderState,
            shaderProgram: runtimePrimitive.primitive.shaderProgram,
          })
        }
        console.log('操作前的完整材质:', runtimePrimitive.primitive.material)
        if (highlight) {
          // 保存原始材质（如果还没有保存）
          if (!originalMaterialsRef.current.has(key)) {
            // 无论原始材质是否存在，都进行缓存（即使是undefined）
            originalMaterialsRef.current.set(
              key,
              runtimePrimitive.primitive.material
            )
            console.log(`为图元缓存当前材质（可能是undefined）: ${key}`)
          }

          // console.log('应用材质前的primitive对象:', runtimePrimitive.primitive)
          // console.log('应用的高亮材质:', material)
          if (material) {
            runtimePrimitive.primitive.material = material
            console.log(`高亮材质应用: ${key}`)
            console.log(
              '===应用材质后 - 完整材质:',
              runtimePrimitive.primitive.material
            )
            console.log(
              '===应用材质后 - 材质颜色:',
              runtimePrimitive.primitive.material?.uniforms?.color?.toBytes()
            )
            appliedCount++
          } else {
            console.warn(`无法应用高亮材质到图元${pIndex}`)
          }
        } else {
          // 恢复原始材质或移除高亮材质
          const original = originalMaterialsRef.current.get(key)
          console.log(`获取到的原始材质:`, original)

          if (original) {
            runtimePrimitive.primitive.material = original
            console.log(`恢复原始材质: ${key}`)
            appliedCount++
          } else {
            // 如果原始材质是undefined，删除当前材质以恢复默认状态
            delete runtimePrimitive.primitive.material
            console.log(`移除材质以恢复默认状态: ${key}`)
            appliedCount++
          }
        }

        // console.log('应用材质后的primitive对象:', runtimePrimitive.primitive)
        console.log('操作后的完整材质:', runtimePrimitive.primitive.material)
        console.log(
          '应用材质后的材质类型:',
          runtimePrimitive.primitive.material?.type
        )
      })

      console.log(`成功应用材质到${appliedCount}个图元`)
      if (appliedCount > 0 && viewerInstance) {
        // 强制重新渲染场景
        viewerInstance.scene.requestRender()
        console.log('场景已重新渲染')

        // 添加额外的渲染调用以确保更新
        setTimeout(() => {
          viewerInstance.scene.requestRender()
          console.log('二次渲染调用完成')
        }, 100)
      }
    },
    [viewerInstance, getHighlightMaterial]
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
      // 这个函数现在可能接收部分参数为null，需要根据nodeName查找节点
      console.log(`点击节点名称: ${nodeName}，实体ID: ${entityId}`)

      if (!modelsReady) {
        console.warn('模型尚未准备好，无法处理点击')
        return
      }

      // 通过实体ID和节点名称查找对应的节点
      const nodes = modelNodesRef.current.get(entityId)
      if (!nodes || nodes.length === 0) {
        console.warn(`未找到实体${entityId}的节点数据`)
        return
      }

      // 查找匹配的节点
      let foundNode = null
      let foundNodeIndex = -1
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i] && nodes[i].name === nodeName) {
          foundNode = nodes[i]
          foundNodeIndex = i
          break
        }
      }

      if (!foundNode) {
        console.warn(`未找到名称为${nodeName}的节点`)
        return
      }

      console.log(`找到点击的节点: ${nodeName} (索引: ${foundNodeIndex})`)

      // 获取节点数据
      const currentEntityData = entityMock.find((item) => item.id === entityId)
      const nodeData = currentEntityData?.nodes?.[nodeName]
      const nodeStatus =
        (nodeData?.status as ModelStatus) || ModelStatus.DEFAULT

      console.log(`节点数据:`, nodeData, `状态: ${ModelStatus[nodeStatus]}`)

      setSelectedNode((prev) => {
        // 恢复上一个选中节点的材质
        if (prev) {
          console.log('恢复上一个节点的材质:', prev.entityId, prev.nodeIndex)
          const prevNodes = modelNodesRef.current.get(prev.entityId)
          const prevNode = prevNodes?.[prev.nodeIndex]
          if (prevNode) {
            const prevNodeStatus =
              (prev.nodeData?.status as ModelStatus) || ModelStatus.DEFAULT
            toggleNodeMaterial(
              prev.entityId,
              prevNode,
              prev.nodeIndex,
              false,
              prevNodeStatus
            )
          }
        }

        // 处理当前节点
        if (prev?.entityId === entityId && prev?.nodeIndex === foundNodeIndex) {
          console.log('关闭信息面板')
          setShowInfoPanel(false)
          return null
        }

        // 高亮当前节点并显示面板
        console.log('高亮当前节点:', entityId, foundNodeIndex, nodeStatus)
        toggleNodeMaterial(
          entityId,
          foundNode,
          foundNodeIndex,
          true,
          nodeStatus
        )
        setShowInfoPanel(true)
        return {
          entityId,
          node: foundNode,
          nodeName,
          nodeData,
          nodeIndex: foundNodeIndex,
        }
      })
    },
    [modelsReady, toggleNodeMaterial]
  )
  // 相机变化处理
  const handleCameraChange = useCallback((state: any) => {
    setCameraState(state)
  }, [])

  // 3D Tiles加载完成处理
  const handleTilesetLoad = useCallback(() => {
    console.log('Tileset loaded')
  }, [])

  // 关闭信息面板时恢复材质
  const handleClosePanel = useCallback(() => {
    if (selectedNode) {
      const nodes = modelNodesRef.current.get(selectedNode.entityId)
      const node = nodes?.[selectedNode.nodeIndex]
      if (node) {
        const nodeStatus =
          (selectedNode.nodeData?.status as ModelStatus) || ModelStatus.DEFAULT
        toggleNodeMaterial(
          selectedNode.entityId,
          node,
          selectedNode.nodeIndex,
          false,
          nodeStatus
        )
      }
    }
    setSelectedNode(null)
    setShowInfoPanel(false)
  }, [selectedNode, toggleNodeMaterial])
  // 缓存模型原始材质和节点信息
  const modelInstancesRef = useRef<Map<string, Cesium.Model>>(new Map()) // 存储模型实例
  const testModelColor = useCallback(
    (entityId: string, colorMode: 'original' | 'red' | 'green' | 'blue') => {
      const model = modelInstancesRef.current.get(entityId)
      if (!model) {
        console.log(`未找到模型实例: ${entityId}`)
        return
      }

      switch (colorMode) {
        case 'original':
          // 恢复原始颜色
          model.color = CesiumColor.WHITE.withAlpha(1.0)
          break
        case 'red':
          model.color = CesiumColor.RED.withAlpha(0.7)
          break
        case 'green':
          model.color = CesiumColor.GREEN.withAlpha(0.7)
          break
        case 'blue':
          model.color = CesiumColor.BLUE.withAlpha(0.7)
          break
      }
      model.silhouetteColor = CesiumColor.YELLOW
      model.silhouetteSize = 5.0
      console.log(`为模型${entityId}添加轮廓线`)
      // 强制重新渲染
      if (viewerInstance) {
        viewerInstance.scene.requestRender()
      }
    },
    [viewerInstance]
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
        setModelsReady={setModelsReady}
        onModelReady={handleModelReady}
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
        <Button
          style={{ margin: 5 }}
          onClick={() => testModelColor('test-bridge-model1', 'original')}
        >
          恢复原始
        </Button>
        <Button
          style={{ margin: 5 }}
          onClick={() => testModelColor('test-bridge-model1', 'red')}
        >
          模型变红
        </Button>
        <Button
          style={{ margin: 5 }}
          onClick={() => testModelColor('test-bridge-model1', 'green')}
        >
          模型变绿
        </Button>
      </div>
      <TechFooter zIndex={MapItemZIndex.FOOTER} />
    </div>
  )
}

export default Home
