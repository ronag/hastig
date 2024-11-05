export default function (src, respond) {
  respond(
    1,
    (dst, src) => {
      dst.buffer[dst.byteOffset++] = src.buffer[src.byteOffset++] + src.buffer[src.byteOffset++]
    },
    src
  )
}
