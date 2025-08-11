import { Entity } from "resium";

const ModelStatus = {
  DEFAULT: 0, // 未开始
  SUCCESS: 1, // 已完成
  PROCESS: 2, // 进行中
  ERROR: 3,   // 异常
} as const;

const MapItemZIndex = {
  ENTITYPANEL: 100, // 实体信息面板
  TOOLBAR: 100, // 工具栏
  HEADER: 90, // 头部
  FOOTER: 90 // 底部
}
// 导出类型（如需使用联合类型）
export type ModelStatus = typeof ModelStatus[keyof typeof ModelStatus];
export { ModelStatus, MapItemZIndex };