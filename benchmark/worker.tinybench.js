import Piscina from 'piscina'
import { Worker } from '../index.js'
import { Bench } from 'tinybench'

const veloce = new Worker(new URL('./add-veloce.worker.js', import.meta.url))
const piscina = new Piscina({
  filename: new URL('./add-piscina.worker.js', import.meta.url).href,
})

const bench = new Bench()

bench.add(
  'veloce',
  () =>
    new Promise((resolve) => {
      veloce.run(
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

bench.add('piscina', () => piscina.run({ a: 1, b: 2 }))

await bench.run()

console.table(bench.table())

veloce.destroy()
