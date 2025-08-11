import { ModelStatus } from '../enum'
const getModelStatusText = (status: ModelStatus) => {
  let text = ''
  switch (status) {
    case ModelStatus.DEFAULT:
      text = '未开始'
      break
    case ModelStatus.SUCCESS:
      text = '已完成'
      break
    case ModelStatus.PROCESS:
      text = '进行中'
      break
    case ModelStatus.ERROR:
      text = '异常中'
      break
    default:
      text = '未知状态'
  }
  return text
}

export { getModelStatusText }
