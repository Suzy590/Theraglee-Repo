// Checks site/downloads/Pip-mac.zip, the Mac desktop pet members download from
// /pet, for the three things that make Finder say "The application "Pip" can't
// be opened" without saying why:
//
//   - the program inside the bundle is not marked executable (the zip was
//     made by a tool that drops Unix permissions, instead of build.sh's ditto)
//   - the program was compiled for a newer macOS than the bundle promises
//     (swiftc was run without the -target flag build.sh passes, so the minimum
//     macOS baked into the binary is whatever Mac it was built on)
//   - the program has no code signature (Apple Silicon refuses to run one)
//
// It also warns when the binary has no Intel slice, since build.sh falls back
// to Apple Silicon only when the Intel toolchain is missing.
//
//   node tests/pet-mac-zip/check.mjs              # the shipped download
//   node tests/pet-mac-zip/check.mjs pet/mac/Pip.app.zip   # a fresh build
//
// Exits non-zero on the first failed assertion. Only the standard library is
// used: the zip's central directory and the Mach-O load commands are read by
// hand, so this runs anywhere Node does, no Mac required.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const ZIP = process.argv[2] ?? fileURLToPath(new URL("../../site/downloads/Pip-mac.zip", import.meta.url));
const EXECUTABLE = "Pip.app/Contents/MacOS/Pip";
const PLIST = "Pip.app/Contents/Info.plist";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };

// --- zip reading -----------------------------------------------------------

function readZip(buf) {
  // End of central directory record: scan back for its signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  assert.ok(eocd >= 0, "zip has an end-of-central-directory record");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, "central directory entry signature");
    const madeBy = buf.readUInt16LE(p + 4);
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const externalAttr = buf.readUInt32LE(p + 38);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    entries.set(name, {
      name, method, compressed, size, localOffset,
      hostOs: madeBy >> 8,                // 3 = Unix, 0 = FAT (no permissions kept)
      mode: externalAttr >>> 16,          // Unix st_mode, only meaningful when hostOs is 3
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntry(buf, entry) {
  const p = entry.localOffset;
  assert.equal(buf.readUInt32LE(p), 0x04034b50, `local header signature for ${entry.name}`);
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + entry.compressed);
  if (entry.method === 0) return Buffer.from(raw);
  assert.equal(entry.method, 8, `${entry.name} is stored or deflated`);
  const out = inflateRawSync(raw);
  assert.equal(out.length, entry.size, `${entry.name} inflates to its declared size`);
  return out;
}

// --- Mach-O reading --------------------------------------------------------

const FAT_MAGIC = 0xcafebabe;    // big-endian universal header
const MH_MAGIC_64 = 0xfeedfacf;  // little-endian 64-bit thin header
const CPU_ARM64 = 0x0100000c;
const CPU_X86_64 = 0x01000007;
const LC_CODE_SIGNATURE = 0x1d;
const LC_VERSION_MIN_MACOSX = 0x24;
const LC_BUILD_VERSION = 0x32;

const version = (v) => `${v >> 16}.${(v >> 8) & 0xff}`;
const cpuName = (c) => ({ [CPU_ARM64]: "arm64", [CPU_X86_64]: "x86_64" })[c] ?? `0x${c.toString(16)}`;

// Returns one record per architecture: { cpu, minOs, signed }.
function readMachO(bin) {
  const slices = [];
  if (bin.readUInt32BE(0) === FAT_MAGIC) {
    const count = bin.readUInt32BE(4);
    for (let i = 0; i < count; i++) {
      const off = bin.readUInt32BE(8 + i * 20 + 8);
      const size = bin.readUInt32BE(8 + i * 20 + 12);
      slices.push(bin.subarray(off, off + size));
    }
  } else {
    slices.push(bin);
  }
  return slices.map((s) => {
    assert.equal(s.readUInt32LE(0), MH_MAGIC_64, "slice is a 64-bit Mach-O");
    const cpu = s.readUInt32LE(4);
    const ncmds = s.readUInt32LE(16);
    let p = 32, minOs = null, signed = false;
    for (let i = 0; i < ncmds; i++) {
      const cmd = s.readUInt32LE(p);
      const size = s.readUInt32LE(p + 4);
      if (cmd === LC_BUILD_VERSION) minOs = s.readUInt32LE(p + 12);
      else if (cmd === LC_VERSION_MIN_MACOSX) minOs = s.readUInt32LE(p + 8);
      else if (cmd === LC_CODE_SIGNATURE) signed = true;
      p += size;
    }
    return { cpu, minOs, signed };
  });
}

// --- the checks ------------------------------------------------------------

const zip = readFileSync(ZIP);
const entries = readZip(zip);
console.log("checking", ZIP);

test("the zip holds Pip.app with its program, Info.plist, icon and signature", () => {
  for (const name of [EXECUTABLE, PLIST, "Pip.app/Contents/Resources/Pip.icns",
                      "Pip.app/Contents/_CodeSignature/CodeResources"]) {
    assert.ok(entries.has(name), `${name} is in the zip`);
  }
});

const exe = entries.get(EXECUTABLE);
test("the program is marked executable, so Finder can launch it", () => {
  assert.equal(exe.hostOs, 3,
    `${EXECUTABLE} was zipped without Unix permissions; pack Pip.app with ditto (build.sh) or zip -r`);
  assert.ok(exe.mode & 0o111,
    `${EXECUTABLE} has mode ${exe.mode.toString(8)} with no execute bit; chmod +x it before zipping`);
});

const plist = readEntry(zip, entries.get(PLIST)).toString("utf8");
const plistValue = (key) =>
  plist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`))?.[1];
const promised = plistValue("LSMinimumSystemVersion");

test("Info.plist names the program and a minimum macOS", () => {
  assert.equal(plistValue("CFBundleExecutable"), "Pip");
  assert.equal(plistValue("CFBundleIdentifier"), "local.desktoppet.pip");
  assert.match(promised ?? "", /^\d+(\.\d+)*$/, "LSMinimumSystemVersion is a version");
});

const slices = readMachO(readEntry(zip, exe));
const [promisedMajor, promisedMinor = 0] = promised.split(".").map(Number);

test("every slice runs on the macOS the bundle promises", () => {
  for (const s of slices) {
    assert.ok(s.minOs !== null, `${cpuName(s.cpu)} slice records a minimum macOS`);
    const major = s.minOs >> 16, minor = (s.minOs >> 8) & 0xff;
    assert.ok(major < promisedMajor || (major === promisedMajor && minor <= promisedMinor),
      `${cpuName(s.cpu)} slice needs macOS ${version(s.minOs)} but Info.plist promises ${promised}; ` +
      `build with swiftc -target <arch>-apple-macos${promisedMajor} (build.sh does)`);
  }
});

test("every slice is code-signed", () => {
  for (const s of slices) assert.ok(s.signed, `${cpuName(s.cpu)} slice has a code signature`);
});

test("there is an Apple Silicon slice", () => {
  assert.ok(slices.some((s) => s.cpu === CPU_ARM64), "arm64 slice present");
});

if (!slices.some((s) => s.cpu === CPU_X86_64)) {
  console.log("warning - no Intel (x86_64) slice: this Pip.app will not open on Intel Macs. " +
              "build.sh makes a universal binary when the full command line tools are installed.");
}

console.log(`\n${n} checks passed: ${slices.map((s) => `${cpuName(s.cpu)} (macOS ${version(s.minOs)}+)`).join(", ")}`);
