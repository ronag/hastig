import Piscina from 'piscina'
import { Worker } from '../index.js'
import { bench, run } from 'mitata'

const hastig = new Worker(new URL('./add-hastig.worker.js', import.meta.url))
const piscina = new Piscina({
  filename: new URL('./add-piscina.worker.js', import.meta.url).href,
  maxThreads: 1,
  minThreads: 1
})

bench(
  'hastig',
  () =>
    new Promise((resolve) => {
      hastig.run(
        2,
        (dst) => {
          dst.buffer[dst.byteOffset++] = 1
          dst.buffer[dst.byteOffset++] = 2
        },
        (err, src, resolve) => {
          resolve(err ? Promise.reject(err) : src.buffer[src.byteOffset])
        },
        resolve
      )
    })
)

bench('piscina', () => piscina.run({ a: 1, b: 2 }))

await run()

hastig.destroy()
