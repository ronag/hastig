export default function (src, respond) {
  const len1 = src.buffer[src.byteOffset++]
  const str1 = src.buffer.toString('ascii', src.byteOffset, len1)
  src.byteOffset += len1

  const len2 = src.buffer[src.byteOffset++]
  const str2 = src.buffer.toString('ascii', src.byteOffset, len2)
  src.byteOffset += len2

  respond(
    128,
    (dst, str1, str2) => {
      const str3 = str1 + ' ' + str2
      dst.buffer[dst.byteOffset] = dst.buffer.write(str3, dst.byteOffset + 1, str3.length, 'ascii')
      dst.byteOffset += dst.buffer[dst.byteOffset] + 1
    },
    str1,
    str2
  )
}
