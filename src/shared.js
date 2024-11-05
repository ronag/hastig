import assert from 'node:assert'

// Make sure write and read are in different
// cache lines.
const WRITE_INDEX = 0
const READ_INDEX = 16

export function alloc (size) {
  return {
    sharedState: new SharedArrayBuffer(128),
    sharedBuffer: new SharedArrayBuffer(size),
  }
}

export function reader ({ sharedState, sharedBuffer }, onRead) {
  const state = new Int32Array(sharedState)
  const size = sharedBuffer.byteLength
  const buffer = Buffer.from(sharedBuffer)
  const view = new DataView(sharedBuffer)
  const data = { buffer, view, byteOffset: 0, byteLength: 0 }

  let readPos = Atomics.load(state, READ_INDEX) | 0
  let writePos = Atomics.load(state, WRITE_INDEX) | 0

  let destroyed = false

  async function read (next, arg1, arg2, arg3) {
    let yieldCount = 0
    while (true) {
      writePos = Atomics.load(state, WRITE_INDEX) | 0

      if (readPos !== writePos) {
        yieldCount = 0

        const dataPos = readPos + 4
        const dataLen = view.getInt32(dataPos - 4, true) | 0

        if (dataLen === -1) {
          readPos = 0
        } else {
          assert(dataLen >= 0)
          assert(dataPos + dataLen <= size)

          readPos += 4 + dataLen

          data.byteOffset = dataPos
          data.byteLength = dataLen

          // TODO (fix): What if next throws?
          next(data, arg1, arg2, arg3)
        }

        Atomics.store(state, READ_INDEX, readPos)
      } else if (yieldCount < 1024) {
        // `Atomics.waitAsync` is super slow.
        yieldCount += 1
        await Promise.resolve()
      } else {
        // timeout is an ugly way to detect destroy.
        const { value, async } = Atomics.waitAsync(
          state,
          WRITE_INDEX,
          writePos,
          1e3
        )
        if (async) {
          await value
        }
      }

      if (destroyed) {
        break
      }
    }
  }

  function destroy () {
    destroyed = true
  }

  read(onRead)

  return { destroy }
}

export function writer ({ sharedState, sharedBuffer }) {
  const state = new Int32Array(sharedState)
  const size = sharedBuffer.byteLength
  const buffer = Buffer.from(sharedBuffer)
  const view = new DataView(sharedBuffer)
  const data = { buffer, view, byteOffset: 0, byteLength: 0 }

  let readPos = Atomics.load(state, READ_INDEX) | 0
  let writePos = Atomics.load(state, WRITE_INDEX) | 0

  let destroyed = false

  function _acquire (len) {
    // len + {current packet header} + {next packet header}
    const required = len + 4 + 4
    assert(required >= 0)
    assert(required <= size)

    readPos = Atomics.load(state, READ_INDEX) | 0

    if (writePos >= readPos) {
      // 0----RxxxxxxW---S
      if (size - writePos >= required) {
        return true
      }

      if (readPos === 0) {
        return false
      }

      view.setInt32(writePos, -1, true)

      writePos = 0

      assert(writePos + 4 <= size) // must have room for next header also
      assert(writePos !== readPos)
    }

    // 0xxxxW------RxxxS
    return readPos - writePos >= required
  }

  function _write (len, fn, arg1, arg2, arg3) {
    const dataPos = writePos + 4

    data.byteOffset = dataPos
    data.byteLength = len

    fn(data, arg1, arg2, arg3)

    const dataLen = data.byteOffset - dataPos

    assert(dataLen <= len + 4)
    assert(dataLen >= 0)
    assert(dataPos + dataLen <= size)

    view.setInt32(dataPos - 4, dataLen, true)

    writePos += 4 + dataLen

    assert(writePos + 4 <= size) // must have room for next header also
    assert(writePos !== readPos)

    readPos = Atomics.load(state, READ_INDEX) | 0

    const needsNotify = state[WRITE_INDEX] === readPos
    Atomics.store(state, WRITE_INDEX, writePos)

    if (needsNotify) {
      Atomics.notify(state, WRITE_INDEX)
    }
  }

  function write (len, fn, arg1, arg2, arg3) {
    // len + {current packet header} + {next packet header} + {alignment}
    const required = len + 4 + 4 + 8
    assert(required >= 0)
    assert(required <= size)
    assert(!destroyed)

    while (!_acquire(required)) {
      if (destroyed) {
        return
      }
      // TODO (fix): How to avoid deadlock?
    }

    _write(len, fn, arg1, arg2, arg3)

    assert(writePos !== readPos)
  }

  function destroy () {
    destroyed = true
  }

  return { write, destroy }
}
