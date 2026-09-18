import { describe, expect, test } from "bun:test"
import { buildZip, zipName } from "../src/lib/zip"

async function withTempZip(zip: Uint8Array, fn: (path: string) => void): Promise<void> {
  const p = `/tmp/zip-test-${crypto.randomUUID()}.zip`
  await Bun.write(p, zip)
  try {
    fn(p)
  } finally {
    await Bun.file(p).unlink()
  }
}

async function unzipList(zip: Uint8Array): Promise<string> {
  let out = ""
  await withTempZip(zip, (p) => {
    const r = Bun.spawnSync(["unzip", "-l", p])
    out = r.stdout.toString()
  })
  return out
}

async function unzipExtract(zip: Uint8Array, name: string): Promise<string> {
  let out = ""
  await withTempZip(zip, (p) => {
    const r = Bun.spawnSync(["unzip", "-p", p, name])
    out = r.stdout.toString()
  })
  return out
}

describe("zip", () => {
  test("produces a valid zip with stored files", async () => {
    const a = new TextEncoder().encode("hello world")
    const b = new TextEncoder().encode("[0] linha um\nlinha dois")
    const zip = buildZip([
      { name: "a.txt", data: a },
      { name: "b.srt", data: b },
    ])
    const listing = await unzipList(zip)
    expect(listing).toContain("a.txt")
    expect(listing).toContain("b.srt")
    expect(listing).toMatch(/2 files/)
    expect(await unzipExtract(zip, "a.txt")).toBe("hello world")
    expect(await unzipExtract(zip, "b.srt")).toBe("[0] linha um\nlinha dois")
  })

  test("empty file list produces an empty zip", async () => {
    const zip = buildZip([])
    const listing = await unzipList(zip)
    expect(listing).toContain("Archive:")
  })

  test("zipName uses the order id", () => {
    expect(zipName("ord-xyz")).toBe("ord-xyz.zip")
  })
})