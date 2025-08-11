import '@ant-design/v5-patch-for-react-19'
import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  createContext,
} from 'react'
import {
  Viewer,
  Cesium3DTileset,
  Entity as ResiumEntity,
  Model as ResiumModel,
} from 'resium'
import {
  Cartesian3 as CesiumCartesian3,
  Cartesian2 as CesiumCartesian2,
  Math as CesiumMath,
  Quaternion,
  Cartographic,
  WebMercatorProjection,
  CameraEventType,
  Entity as CesiumEntity,
  Color as CesiumColor,
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

// 定义桥梁实体的数据结构
interface BridgeEntity {
  id: string
  modelName: string
  modelType: string
  description: string
  modelId: string
  horizontal_distance: number // 平距
  height: number // 高度
  along_length: number // 顺桥向长度
  pier_no: number // 桥墩号
  substructure: string
  buried_depth: number // 埋深
  guidepost_no: string // 里程桩号
  uuid: string // 预留的外部数据标识
  mark: string
  epsg_3857: string // EPSG:3857 坐标
  uri: string // GLB模型路径
  material: string // 材质,将来会有一系列描述未开始、进行中、已完成的三种半透明纯色材质
  plan_time_begin: any // 计划开始时间
  plan_time_end: any // 计划结束时间
  status: ModelStatus // 状态，使用ModelStatus枚举
  real_time_begin: any // 实际开始时间
  real_time_end: any // 实际结束时间
  // 添加坐标解析后的经纬度
  longitude?: number
  latitude?: number
  elevation?: number
  nodes?: any[] // 预留的节点信息
}

// 实体数据mock
const entityMock: BridgeEntity[] = [
  {
    id: 'test-bridge-model1',
    modelName: '桥梁模型',
    modelType: '桥梁',
    description: '这是一个使用GLB格式的3D桥梁模型',
    modelId: 'test-bridge-model1',
    horizontal_distance: 13425,
    height: 2000,
    along_length: 5500,
    pier_no: 67,
    substructure: '盖梁柱式墩',
    buried_depth: -3106,
    guidepost_no: 'K44+395.734',
    uuid: 'B92EC076-921A-4f69-8983-6A1574DD4358_SBCA-1',
    mark: '', // 备注
    epsg_3857: '13433492.4, 3692043.9, 45',
    uri: '/models/0806-5/0806-5.gltf',
    material: 'default',
    plan_time_begin: '2025-08-05 18:40:15',
    plan_time_end: null,
    status: ModelStatus.DEFAULT,
    real_time_begin: null,
    real_time_end: null,
  },
]
// 定义暗黑模式配置
const { darkAlgorithm } = theme
const darkTheme: ThemeConfig = {
  algorithm: darkAlgorithm, // 使用正确的暗黑模式算法
  token: {
    colorPrimary: '#4096ff',
    colorBgContainer: '#1f1f1f', // 暗黑模式下的容器背景色
    colorText: '#ffffff', // 暗黑模式下的文本颜色
    formItemMarginBottom: 8, // 默认约 24px，调小后间距更紧凑
    controlHeight: 30, // 输入框高度（默认约 32px）
    controlPaddingHorizontal: 8, // 输入框左右内边距
  },
}

const dateFormat = 'YYYY-MM-DD HH:mm:ss'

const parseDate = (dateString: string | null): Dayjs | null => {
  if (!dateString) return null
  return dayjs(dateString, dateFormat)
}

const formatDate = (date: Dayjs | null): string | null => {
  if (!date) return null
  // 返回datestring
  return date.format(dateFormat)
}

// 【1】分离Cesium地图组件
const CesiumMap = React.memo(
  React.forwardRef(
    (
      {
        onEntityClick,
        onCameraChange,
        onTilesetLoad,
        entities, // 传入实体数据
      },
      ref
    ) => {
      const viewerRef = ref || useRef<any>(null)
      const isTilesetLoaded = useRef(false)
      // 创建一个稳定的creditContainer引用
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
      const initialPosition = useMemo(() => {
        const entityCoords = processEntityCoordinates(
          '13433492.4, 3692043.9, 45'
        )
        return Cesium.Cartesian3.fromDegrees(
          entityCoords.longitude,
          entityCoords.latitude - 0.00206,
          entityCoords.height + 100
        )
      }, [])

      const initialViewerInfo = useMemo(() => {
        return {
          destination: initialPosition,
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-30),
            roll: 0.0,
          },
        }
      }, [initialPosition])
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
      // 添加节点点击处理函数
      const handleNodeClick = useCallback((node: any) => {
        

        // 可以触发一些UI更新或状态改变
        // 例如高亮显示、显示信息面板等
      }, [])
      // 初始化地图和事件监听
      useEffect(() => {
        const timer = setTimeout(() => {
          if (viewerRef.current && viewerRef.current.cesiumElement) {
            const viewer = viewerRef.current.cesiumElement
            setViewer(viewer) // 将viewer存入Context
            // 只在第一次加载时设置初始相机位置
            if (!viewer.camera[Symbol.for('cameraInitialized')]) {
              // 设置初始相机位置（以第一个实体为准）
              if (entities.length > 0) {
              }
              viewer.camera.setView(initialViewerInfo)

              // 标记相机已初始化
              viewer.camera[Symbol.for('cameraInitialized')] = true
            }
            // 检查是否已经绑定过事件监听器
            if (viewer[Symbol.for('eventListenersInitialized')]) {
              return
            }
            // 配置相机控制
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
            // viewer.scene.screenSpaceCameraController.translateEventTypes = []
            viewer.scene.screenSpaceCameraController.lookEventTypes = [
              Cesium.CameraEventType.MIDDLE_DRAG,
            ]
            // 移除默认的单击/双击事件，防止相机自动移动
            viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
              Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
            )
            viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
              Cesium.ScreenSpaceEventType.LEFT_CLICK
            )
            // 监听实体点击
            viewer.screenSpaceEventHandler.setInputAction((movement) => {},
            Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
            viewer.screenSpaceEventHandler.setInputAction((movement) => {
              const pickedObject = viewer.scene.pick(movement.position)
              console.log(pickedObject)
              if (Cesium.defined(pickedObject)) {
                // 重点：从detail中获取模型信息（你的环境中节点信息在这里）
                const model = pickedObject.detail?.model
                const clickedNode = pickedObject.detail?.node?.node
                if (model && clickedNode && clickedNode.name != 'root') {
                  console.log('点击到具体节点：', {
                    name: clickedNode.name,
                    index: clickedNode.index,
                    id: clickedNode.id,
                  })
                  // 执行节点级操作
                  handleNodeClick(clickedNode)
                } else if (pickedObject.id instanceof Cesium.Entity) {
                  // 若未命中节点，再处理实体级点击
                  console.log('点击到整个实体：', pickedObject.id.id)
                  onEntityClick?.(pickedObject.id)
                }
              }
            }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

            // 监听相机变化
            viewer.camera.changed.addEventListener(() => {
              onCameraChange?.({
                position: Cesium.Cartesian3.clone(viewer.camera.position),
                direction: Cesium.Cartesian3.clone(viewer.camera.direction),
                up: Cesium.Cartesian3.clone(viewer.camera.up),
              })
            })
            // 【bugfix】添加全局坐标系参考
            viewer.scene.primitives.add(
              new Cesium.DebugModelMatrixPrimitive({
                modelMatrix: Cesium.Matrix4.IDENTITY,
                length: 100.0, // 坐标轴长度为100米
              })
            )

            console.log('Cesium map initialized')
            // 标记事件监听器已初始化
            viewer[Symbol.for('eventListenersInitialized')] = true
          }
        }, 1000)

        return () => clearTimeout(timer)
      }, [onEntityClick, onCameraChange])

      return (
        <Viewer
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
          // skyBox={false}
          // skyAtmosphere={false}
          useBrowserRecommendedResolution={true}
          resolutionScale={1.0}
          creditContainer={creditContainerRef.current}
        >
          {/* 3D Tiles 模型 */}
          <Cesium3DTileset
            url='/models/g524/tileset.json'
            onReady={handleTilesetReady}
            onError={(error) => {
              console.error('Failed to load 3D Tiles model:', error)
            }}
            cacheBytes={512 * 1024 * 1024} // 512MB（默认可能是128MB）
            maximumCacheOverflowBytes={256 * 1024 * 1024} // 256MB（默认可能更小）
            // 增大误差值（例如从16调整为32），减少高精度瓦片加载
            maximumScreenSpaceError={32}
            modelMatrix={Cesium.Matrix4.fromTranslation(
              new Cesium.Cartesian3(0, 0, -45) // Z轴向下移动45米
            )}
          />

          {/* 渲染所有GLB模型实体 */}
          {entities.map((entity) => {
            const coords = processEntityCoordinates(entity.epsg_3857)

            // [todo] 待抽离的模型旋转方法
            // 创建绕Z轴旋转的姿态
            const heading = Cesium.Math.toRadians(105) // 绕Z轴旋转45度
            const pitch = 0 // 绕X轴旋转
            const roll = 0 // 绕Y轴旋转
            const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll)

            // 转换为四元数方向
            const position = Cesium.Cartesian3.fromDegrees(
              coords.longitude,
              coords.latitude,
              coords.height
            )
            const orientation = Cesium.Transforms.headingPitchRollQuaternion(
              position,
              hpr
            )
            return (
              <ResiumEntity
                key={entity.id}
                id={entity.id}
                position={Cesium.Cartesian3.fromDegrees(
                  coords.longitude,
                  coords.latitude,
                  coords.height
                )}
                name={entity.modelName}
                description={entity.description}
                model={{
                  uri: entity.uri,
                  // minimumPixelSize: 128,
                  // maximumScale: 20000,
                  scale: 1, // 使用原始大小
                  minimumPixelSize: 0, // 禁用最小像素大小限制
                  maximumScale: undefined, // 移除最大缩放限制
                  // 关键：允许颜色与原始材质混合
                  colorBlendMode: Cesium.ColorBlendMode.MIX,
                  // 初始颜色（不影响原有材质，透明度设为1）
                  color: Cesium.Color.WHITE.withAlpha(1.0),
                }}
                orientation={orientation}
                onReady={(entityObj: any) => {
                  const model = entityObj.model
                  if (model) {
                    // 设置渲染顺序（值越大，越晚渲染，优先级越高）
                    model.renderOrder = 100
                    // 可选：关闭深度测试（强制显示在最上层，视需求开启）
                    // model.depthTestAgainstTerrain = false;
                    console.log(`模型 ${entity.id} 已设置渲染优先级`)
                  }
                }}
              />
            )
          })}
          <CustomButton initialViewerInfo={initialViewerInfo} />
        </Viewer>
      )
    }
  )
)
CesiumMap.displayName = 'CesiumMap'
// 【2】自定义信息面板组件
const EntityInfoPanel = ({
  entity,
  visible,
  onClose,
  onInfoChange,
  allEntityData, // 所有实体数据
}) => {
  const [form] = Form.useForm()
  // 根据选中的实体找到完整信息
  const [selectedEntityData, setSelectedEntityData] =
    useState<BridgeEntity | null>(null)

  useEffect(() => {
    if (entity && allEntityData) {
      const fullEntityData =
        allEntityData.find((item: BridgeEntity) => item.id === entity.id) ||
        null
      setSelectedEntityData(fullEntityData)

      if (fullEntityData) {
        form.setFieldsValue({
          ...fullEntityData,
          statusText: getModelStatusText(fullEntityData?.status as ModelStatus),
          // 转换日期字符串为Dayjs对象
          plan_time_begin: parseDate(fullEntityData.plan_time_begin),
          plan_time_end: parseDate(fullEntityData.plan_time_end),
          real_time_begin: parseDate(fullEntityData.real_time_begin),
          real_time_end: parseDate(fullEntityData.real_time_end),
        })
      }
    }
  }, [entity, allEntityData, form])

  if (!visible || !entity || !selectedEntityData) return null

  const handleInputChange = (field: string, value: string) => {
    // 这里可以处理输入变化
    onInfoChange?.(field, value)
  }

  const handleSubmit = () => {
    // 获取表单值，此时日期字段已经是字符串格式
    const values = form.getFieldsValue()

    // 处理日期值，确保格式正确
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
        style={{ zIndex: MapItemZIndex.ENTITYPANEL }}
      >
        <div className='common-title-wrapper'>
          <h3>{selectedEntityData.modelName} 信息</h3>
          <div
            style={{
              float: 'right',
              display: 'inline-block',
            }}
          >
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

          {/* <Form.Item>
            <Button type='primary' htmlType='submit' size='small' style={{ marginRight: 8 }}>
              提交
            </Button>
            <Button onClick={onClose} danger size='small'>
              关闭
            </Button>
          </Form.Item> */}
        </Form>
      </div>
    </ConfigProvider>
  )
}

// 【3】总的整合组件
const Home = () => {
  const [modal, contextHolder] = Modal.useModal()
  const [selectedEntity, setSelectedEntity] = useState<any>(null)
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [cameraState, setCameraState] = useState<any>(null)
  const viewerRef = useRef<any>(null)
  const originalColorsRef = useRef<Map<any, any>>(new Map())
  const { viewer } = useCesiumViewer()
  // 相机变化处理
  const handleCameraChange = useCallback((state) => {
    setCameraState(state)
  }, [])
  // 添加高亮颜色常量（使用useMemo确保稳定）
  const highlightColor = useMemo(() => {
    return {
      [ModelStatus.DEFAULT]: new Cesium.Color(0.2, 0.6, 1.0, 0.7), // 浅蓝色半透明
      [ModelStatus.SUCCESS]: new Cesium.Color(0.2, 1.0, 0.4, 0.7), // 浅绿色半透明
      [ModelStatus.PROCESS]: new Cesium.Color(1.0, 0.6, 0.2, 0.7), // 橙色半透明
      [ModelStatus.ERROR]: new Cesium.Color(1.0, 0.4, 0.4, 0.7), // 淡红色半透明
    }
  }, [])
  // 高亮实体的函数（完整保留颜色设置/恢复逻辑）
  const highlightEntity = useCallback(
    (
      entity: any,
      highlight: boolean,
      type: ModelStatus = ModelStatus.DEFAULT
    ) => {
      // 确保实体和模型存在，避免空引用错误
      if (!entity || !entity.model) {
        console.log('实体或模型不存在，无法执行高亮操作')
        return
      }

      // 使用requestAnimationFrame确保与Cesium渲染循环同步
      requestAnimationFrame(() => {
        // 1. 高亮：保存原始颜色 → 设置新颜色
        if (highlight) {
          // 高亮：只在未缓存时保存原始颜色（解决重复触发）
          if (!originalColorsRef.current.has(entity)) {
            originalColorsRef.current.set(entity, entity.model.color)
            entity.model.color = highlightColor[type]
            // console.log(`实体 ${entity.id} 已高亮`) // 只打印一次
          }
        }
        // 2. 取消高亮：恢复原始颜色 → 清除缓存
        else {
          // 取消高亮：直接恢复原始颜色（沿用你原本有效的逻辑）
          const originalColor = originalColorsRef.current.get(entity)
          if (originalColor !== undefined) {
            entity.model.color = originalColor
            originalColorsRef.current.delete(entity)
            // console.log(`实体 ${entity.id} 已恢复原始颜色`)
          } else {
            delete entity.model.color // 用你原本有效的删除方式
          }
        }
      })
    },
    [highlightColor]
  )

  // 实体点击处理（保留所有逻辑，添加详细时序注释）
  const handleEntityClick = useCallback(
    (entity) => {
      setSelectedEntity((prevSelectedEntity) => {
        const isSameEntity = prevSelectedEntity?.id === entity.id

        if (isSameEntity) {
          // 点击已选中的实体 → 取消选中
          highlightEntity(entity, false)
          setShowInfoPanel(false)
          return null
        }
        const currentEntityData = entityMock.find(
          (item) => item.id === entity.id
        )
        const entityStatus =
          (currentEntityData?.status as ModelStatus) || ModelStatus.DEFAULT
        // 点击新实体 → 选中新实体
        if (prevSelectedEntity) {
          highlightEntity(prevSelectedEntity, false)
        }

        highlightEntity(entity, true, entityStatus)
        setShowInfoPanel(true)
        return entity
      })
    },
    [highlightEntity]
  )

  // 3D Tiles加载完成处理
  const handleTilesetLoad = useCallback(() => {
    console.log('Tileset loaded')
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {contextHolder}
      <TechHeader title='相城高铁新城G524改造施工段示意' zIndex={MapItemZIndex.HEADER}/>
      {/* Cesium地图组件 - 使用React.memo优化 */}
      <CesiumMap
        ref={viewerRef}
        entities={entityMock} // 传入实体数据
        onEntityClick={handleEntityClick}
        onCameraChange={handleCameraChange}
        onTilesetLoad={handleTilesetLoad}
      />

      {/* 自定义信息面板 */}
      <EntityInfoPanel
        entity={selectedEntity}
        visible={showInfoPanel}
        onClose={() => {
          // 关闭面板时也要取消高亮
          if (selectedEntity) {
            highlightEntity(selectedEntity, false)
          }
          setSelectedEntity(null)
          setShowInfoPanel(false)
        }}
        onInfoChange={(field, value) =>
          console.log(`更新字段 ${field}:`, value)
        }
        allEntityData={entityMock} // 传入所有实体数据
      />

      {/* 控制按钮 */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: MapItemZIndex.TOOLBAR,
        }}
      >
        {/* <Button onClick={() => {}} style={{ margin: 5 }}>
          todo
        </Button> */}
      </div>
      <TechFooter  zIndex={MapItemZIndex.FOOTER}/>
    </div>
  )
}

export default Home
