import test from 'node:test'
import assert from 'node:assert'
import { Worker } from '../index.js'

test('add', async () => {
  const worker = new Worker(new URL('./add.worker.js', import.meta.url))

  await new Promise((resolve) => {
    setTimeout(() => {
      worker.run(
        2,
        (dst) => {
          dst.buffer[dst.byteOffset++] = 1
          dst.buffer[dst.byteOffset++] = 2
        },
        (err, src, resolve) => {
          assert(!err)
          assert.strictEqual(src.buffer[src.byteOffset], 3)
          resolve(null)
        },
        resolve
      )
    }, 100)
  })

  worker.destroy()
})
