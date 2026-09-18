import type { Transcript } from "./types"

export function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const local = (name: string, data: Uint8Array, crc: number) => {
    const nameBuf = new TextEncoder().encode(name)
    const n = nameBuf.length
    const size = data.byteLength

    const localHeader = new Uint8Array(30)
    const dv = new DataView(localHeader.buffer)
    dv.setUint32(0, 0x04034b50, true) // local file header signature
    dv.setUint16(4, 20, true) // version needed
    dv.setUint16(6, 0x0800, true) // flags: UTF-8
    dv.setUint16(8, 0, true) // compression: stored
    dv.setUint16(10, 0, true) // mod time
    dv.setUint16(12, 0x21, true) // mod date
    dv.setUint32(14, crc, true) // crc-32
    dv.setUint32(18, size, true) // compressed size
    dv.setUint32(22, size, true) // uncompressed size
    dv.setUint16(26, n, true) // name length
    dv.setUint16(28, 0, true) // extra length

    return concat([localHeader, nameBuf, data])
  }

  const central = (name: string, data: Uint8Array, crc: number, offset: number) => {
    const nameBuf = new TextEncoder().encode(name)
    const n = nameBuf.length
    const size = data.byteLength

    const cd = new Uint8Array(46)
    const dv = new DataView(cd.buffer)
    dv.setUint32(0, 0x02014b50, true) // central directory signature
    dv.setUint16(4, 20, true) // version made by
    dv.setUint16(6, 20, true) // version needed
    dv.setUint16(8, 0x0800, true) // flags: UTF-8
    dv.setUint16(10, 0, true) // compression: stored
    dv.setUint16(12, 0, true) // mod time
    dv.setUint16(14, 0x21, true) // mod date
    dv.setUint32(16, crc, true)
    dv.setUint32(20, size, true)
    dv.setUint32(24, size, true)
    dv.setUint16(28, n, true) // name length
    dv.setUint16(30, 0, true) // extra length
    dv.setUint16(32, 0, true) // comment length
    dv.setUint16(34, 0, true) // disk number start
    dv.setUint16(36, 0, true) // internal attrs
    dv.setUint32(38, 0, true) // external attrs
    dv.setUint32(42, offset, true) // local header offset

    return concat([cd, nameBuf])
  }

  let offset = 0
  const parts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  for (const f of files) {
    const data = f.data
    const crc = crc32(data)
    parts.push(local(f.name, data, crc))
    centralParts.push(central(f.name, data, crc, offset))
    offset += 30 + new TextEncoder().encode(f.name).length + data.byteLength
  }

  const centralSize = centralParts.reduce((a, b) => a + b.byteLength, 0)
  const cdStart = offset

  const eocd = new Uint8Array(22)
  const dv = new DataView(eocd.buffer)
  dv.setUint32(0, 0x06054b50, true) // end of central directory signature
  dv.setUint16(8, files.length, true) // total entries on disk
  dv.setUint16(10, files.length, true) // total entries
  dv.setUint32(12, centralSize, true) // central directory size
  dv.setUint32(16, cdStart, true) // central directory offset
  dv.setUint16(20, 0, true) // comment length

  return concat([...parts, ...centralParts, eocd])
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((a, b) => a + b.byteLength, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.byteLength
  }
  return out
}

export function zipName(orderId: string): string {
  return `${orderId}.zip`
}

export function transcriptsToZipFiles(ts: Transcript[]): { name: string; data: Uint8Array }[] {
  return ts.map((t) => ({ name: t.filename, data: t.data }))
}