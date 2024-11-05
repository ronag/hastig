import { EventEmitter } from 'node:events'
import { Worker as NodeWorker } from 'node:worker_threads'
import * as shared from './shared.js'

export class Worker extends EventEmitter {
  #reader
  #writer
  #worker
  #queue = []
  #index = 0
  #destroyed = false

  constructor (
    scriptURL,
    { inputBufferSize = 1024 * 1024, outputBufferSize = 1024 * 1024 } = {}
  ) {
    super()

    if (!Atomics.isLockFree) {
      throw new Error('Atomics are not lock-free')
    }

    const state1 = shared.alloc(inputBufferSize)
    const state2 = shared.alloc(outputBufferSize)
    this.#writer = shared.writer(state1)
    this.#reader = shared.reader(state2, (data) => {
      if (this.#destroyed) {
        return
      }

      const callback = this.#queue[this.#index++]
      const opaque = this.#queue[this.#index++]
      if (this.#queue.length === this.#index) {
        this.#queue.length = 0
        this.#index = 0
      }
      callback(null, data, opaque)
    })

    this.#worker = new NodeWorker(new URL('./worker.worker.js', import.meta.url), {
      workerData: {
        input: state1,
        output: state2,
        scriptURL: scriptURL.href,
      },
    }).on('error', err => {
      this.destroy(err)
    })
  }

  /**
   * @param {number} maxLen - Maximum length of the data to write.
   * @param {function} fn - Function to write data.
   * @param {function} callback - Function to call when data is read.
   * @param {*} opaque - Opaque data to pass to the callback.
   */
  run (maxLen, fn, callback, opaque) {
    if (this.#destroyed) {
      throw new Error('Worker has been destroyed')
    }

    this.#writer.write(maxLen, fn)
    this.#queue.push(callback, opaque)
  }

  destroy (err) {
    if (this.#destroyed) {
      return
    }

    this.#reader.destroy()
    this.#writer.destroy()

    this.#worker.postMessage({ type: 'terminate' })

    let error = err
    while (this.#index < this.#queue.length) {
      const callback = this.#queue[this.#index++]
      const opaque = this.#queue[this.#index++]
      try {
        callback(error ??= new Error('Worker has been destroyed'), null, opaque)
      } catch {
        // TODO (fix): What if callback throws?
      }
    }

    this.#worker.terminate()
      .catch(() => {
        // TODO (fix): What if terminate throws?
      })
      .then(() => {
        if (err) {
          // TODO (fix): What if handlers throw?
          this.emit('error', err)
        }

        // TODO (fix): What if handlers throw?
        this.emit('close')
      })
  }
}
