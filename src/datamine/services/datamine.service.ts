import { inflateRawSync } from "node:zlib";
import { read_datamine_file, type s_datamine_file } from "@blamnetwork/blf";
import {
  event_error,
  event_message,
  event_warning,
} from "@blamnetwork/datamine";
import { Injectable } from "@nestjs/common";
import * as yauzl from "yauzl";

const DATAMINE_ZIP_ENTRY = "compressed.dat";
const MULTIPART_BOUNDARY_RE = /^--([^\r\n]+)/;
const MULTIPART_UPLOAD_NAME_RE = /name="upload"/i;

function extractMultipartFile(body: Buffer): Buffer | undefined {
  const asAscii = body.toString("latin1");
  const boundaryMatch = asAscii.match(MULTIPART_BOUNDARY_RE);
  if (!boundaryMatch) {
    // Raw zip / compressed.dat (tests / manual drops)
    if (body.length >= 2 && body[0] === 0x50 && body[1] === 0x4b) {
      return body;
    }
    if (body.length >= 2 && body[0] === 0xff && body[1] === 0xfe) {
      return body;
    }
    return;
  }

  const boundary = boundaryMatch[1];
  const parts = asAscii.split(`--${boundary}`);
  for (const part of parts) {
    if (!MULTIPART_UPLOAD_NAME_RE.test(part)) {
      continue;
    }
    const sep = part.indexOf("\r\n\r\n");
    if (sep < 0) {
      continue;
    }
    let payload = part.slice(sep + 4);
    if (payload.endsWith("\r\n")) {
      payload = payload.slice(0, -2);
    }
    return Buffer.from(payload, "latin1");
  }
  return;
}

// Every entry in a zip, by name. Crash archives are a few small text files
// plus a ~3.5 MB screenshot, so reading them all is fine. Names are left
// undecoded because yauzl rejects the console's device paths
// ("d:/sku_config.txt") as absolute when it decodes them itself.
function readZipEntries(buffer: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    const options = { lazyEntries: true, decodeStrings: false };
    yauzl.fromBuffer(buffer, options, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error("failed to open zip"));
        return;
      }
      const entries = new Map<string, Buffer>();
      zipfile.on("entry", (entry) => {
        const fileName = Buffer.from(
          entry.fileName as unknown as Uint8Array
        ).toString("latin1");
        if (fileName.endsWith("/")) {
          zipfile.readEntry();
          return;
        }
        zipfile.openReadStream(entry, (streamErr, stream) => {
          if (streamErr || !stream) {
            reject(streamErr ?? new Error("failed to read zip entry"));
            return;
          }
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("end", () => {
            entries.set(fileName, Buffer.concat(chunks));
            zipfile.readEntry();
          });
          stream.on("error", reject);
        });
      });
      zipfile.on("end", () => resolve(entries));
      zipfile.on("error", reject);
      zipfile.readEntry();
    });
  });
}

const LOCAL_FILE_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const LOCAL_FILE_HEADER_SIZE = 30;
const ZIP_METHOD_DEFLATE = 8;

// Walks local file headers instead of the central directory, keeping every
// entry whose data fully arrived. For partial (multi-part) uploads.
function readLocalZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let offset = buffer.indexOf(LOCAL_FILE_HEADER);
  while (offset >= 0 && offset + LOCAL_FILE_HEADER_SIZE <= buffer.length) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + LOCAL_FILE_HEADER_SIZE;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) {
      break;
    }
    const name = buffer.toString("latin1", nameStart, nameStart + nameLength);
    const data = buffer.subarray(dataStart, dataEnd);
    try {
      entries.set(
        name,
        method === ZIP_METHOD_DEFLATE ? inflateRawSync(data) : Buffer.from(data)
      );
    } catch {
      // Corrupt entry; keep the rest.
    }
    offset = buffer.indexOf(LOCAL_FILE_HEADER, dataEnd);
  }
  return entries;
}

const CRASH_INFO_ENTRY = "crash_info.txt";
const LINE_BREAK_RE = /\r?\n/;

// The line after each `<label>:` header in crash_info.txt, e.g. "halt
// information:" -> "failed to load bootstrap_patchable".
function crashInfoField(info: string, label: string): string | undefined {
  const lines = info.split(LINE_BREAK_RE);
  const index = lines.findIndex((line) => line.trim() === `${label}:`);
  return index < 0 ? undefined : lines[index + 1]?.trim();
}

// "state:: bootflow:bap_signin" style lines.
function crashInfoValue(info: string, key: string): string | undefined {
  const match = info.match(new RegExp(`^\\s*${key}:+\\s*(.*)$`, "m"));
  return match?.[1]?.trim();
}

function openZipEntry(buffer: Buffer, fileName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error("failed to open zip"));
        return;
      }
      let found = false;
      zipfile.on("entry", (entry) => {
        if (entry.fileName !== fileName) {
          zipfile.readEntry();
          return;
        }
        found = true;
        zipfile.openReadStream(entry, (streamErr, stream) => {
          if (streamErr || !stream) {
            reject(streamErr ?? new Error("failed to read zip entry"));
            return;
          }
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("end", () => resolve(Buffer.concat(chunks)));
          stream.on("error", reject);
        });
      });
      zipfile.on("end", () => {
        if (!found) {
          reject(new Error(`zip entry missing: ${fileName}`));
        }
      });
      zipfile.on("error", reject);
      zipfile.readEntry();
    });
  });
}

async function parseTicketDropBody(
  upload: Buffer
): Promise<s_datamine_file | undefined> {
  // Multipart usually wraps a ZIP; compressed.dat may also arrive bare.
  let datamineBuf: Buffer;
  if (upload.length >= 2 && upload[0] === 0xff && upload[1] === 0xfe) {
    datamineBuf = upload;
  } else {
    try {
      datamineBuf = await openZipEntry(upload, DATAMINE_ZIP_ENTRY);
    } catch {
      return;
    }
  }

  return read_datamine_file(datamineBuf);
}

// Uploads are only logged; nothing is written to disk.
@Injectable()
export class DatamineService {
  async absorbTicketDrop(
    body: Buffer,
    meta?: { method?: string; host?: string }
  ): Promise<{ ok: true; bytes: number; events?: number }> {
    const method = meta?.method ?? "PUT";
    const host = meta?.host ? ` host=${meta.host}` : "";

    let events: number | undefined;
    try {
      const upload = extractMultipartFile(body);
      if (!upload) {
        event_warning(
          "datamine: %s /ticket_drop not multipart (%dB)%s",
          method,
          body.length,
          host
        );
        return { ok: true, bytes: body.length };
      }

      // Crash reports (bootflow halts, asserts) arrive as crash_archive.zip.
      if (await this.absorbCrashArchive(upload)) {
        return { ok: true, bytes: body.length };
      }

      const datamine = await parseTicketDropBody(upload);
      if (datamine) {
        events = datamine.events.length;
        event_message(
          "datamine: Datamine upload received for session %s (%d events)",
          datamine.header.sessionid,
          events
        );
      } else {
        // The report worker uploads multipart crash/report bundles here.
        event_warning(
          "datamine: %s /ticket_drop parse failed (%dB)%s",
          method,
          body.length,
          host
        );
      }
    } catch (error) {
      event_error(
        "datamine: %s /ticket_drop parse error: %s",
        method,
        error instanceof Error ? error.message : String(error)
      );
    }

    return { ok: true, bytes: body.length, events };
  }

  // Whether the upload was a crash archive (its report is logged).
  private async absorbCrashArchive(upload: Buffer): Promise<boolean> {
    if (upload.length < 2 || upload[0] !== 0x50 || upload[1] !== 0x4b) {
      return false;
    }
    let entries: Map<string, Buffer>;
    try {
      entries = await readZipEntries(upload);
    } catch {
      // Crash archives with a minidump are sent in ~1 MB parts, so the
      // central directory can point past what arrived. The small text
      // entries come first and are still complete.
      entries = readLocalZipEntries(upload);
    }
    const info = entries.get(CRASH_INFO_ENTRY)?.toString("utf8");
    if (info === undefined) {
      return false;
    }

    event_warning(
      'datamine: Crash report: session=%s halt=%s reason="%s" state=%s (%d files)',
      crashInfoField(info, "session_id") ?? "?",
      crashInfoField(info, "halt") ?? "?",
      crashInfoField(info, "halt information") ?? "?",
      crashInfoValue(info, "state") ?? "?",
      entries.size
    );
    return true;
  }
}
