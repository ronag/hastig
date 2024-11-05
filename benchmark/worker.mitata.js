import Piscina from 'piscina'
import { Worker } from '../index.js'
import { bench, run } from 'mitata'

const hastig = new Worker(new URL('./hastig.worker.js', import.meta.url))
const piscina = new Piscina({
  filename: new URL('./piscina.worker.js', import.meta.url).href,
  maxThreads: 1,
  minThreads: 1
})

const str1 = 'Hello'
const str2 = 'World'

bench(
  'hastig',
  () =>
    new Promise((resolve) => {
      hastig.run(
        128,
        (dst) => {
          dst.buffer[dst.byteOffset] = dst.buffer.write(str1, dst.byteOffset + 1, str1.length, 'ascii')
          dst.byteOffset += dst.buffer[dst.byteOffset] + 1
          dst.buffer[dst.byteOffset] = dst.buffer.write(str2, dst.byteOffset + 1, str2.length, 'ascii')
          dst.byteOffset += dst.buffer[dst.byteOffset] + 1
        },
        (err, src, resolve) => {
          if (err) {
            resolve(Promise.reject(err))
          } else {
            const len3 = src.buffer[src.byteOffset++]
            const str3 = src.buffer.toString('ascii', src.byteOffset, len3)
            resolve(str3)
          }
        },
        resolve
      )
    })
)

bench('piscina', () => piscina.run({ str1, str2 }))

await run()

hastig.destroy()
