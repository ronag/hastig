import { workerData, parentPort } from 'node:worker_threads'
import * as shared from './shared.js'

const script = await import(workerData.scriptURL)
const writer = shared.writer(workerData.output)
const reader = shared.reader(workerData.input, (src) => {
  script.default(src, writer.write)
})

const keepAliveInterval = setInterval(() => {}, 9999)
parentPort?.on('message', (message) => {
  if (message.type === 'terminate') {
    clearInterval(keepAliveInterval)
    reader.destroy()
    writer.destroy()
  }
})
