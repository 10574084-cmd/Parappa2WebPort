const SECTOR_SIZE = 2048;
const MAX_ENTRIES = 30000;
const MAX_DEPTH = 16;

function readBothEndian32(view, offset, label) {
  const little = view.getUint32(offset, true);
  const big = view.getUint32(offset + 4, false);
  if (little !== big) throw new Error('Campo ISO 9660 inconsistente: ' + label);
  return little;
}

function decodeIdentifier(bytes) {
  return new TextDecoder('ascii').decode(bytes).replace(/;\d+$/, '').replace(/\.$/, '');
}

function parseDirectoryRecord(view, offset, available) {
  const length = view.getUint8(offset);
  if (length === 0) return null;
  if (length < 34 || length > available) throw new Error('Registro de directorio ISO 9660 inválido.');
  const idLength = view.getUint8(offset + 32);
  if (33 + idLength > length) throw new Error('Identificador ISO 9660 fuera del registro.');
  const identifier = new Uint8Array(view.buffer, view.byteOffset + offset + 33, idLength);
  return {
    length,
    extent: readBothEndian32(view, offset + 2, 'extent'),
    size: readBothEndian32(view, offset + 10, 'data length'),
    flags: view.getUint8(offset + 25),
    name: decodeIdentifier(identifier),
    special: idLength === 1 && (identifier[0] === 0 || identifier[0] === 1)
  };
}

export class Iso9660Image {
  constructor(buffer) {
    if (!(buffer instanceof ArrayBuffer)) throw new TypeError('Se esperaba un ArrayBuffer.');
    if (buffer.byteLength < SECTOR_SIZE * 18) throw new Error('La imagen es demasiado pequeña para ser un ISO 9660.');
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.sectorSize = SECTOR_SIZE;
    this.volumeId = '';
    this.systemId = '';
    this.entries = [];
    this.root = null;
    this.readVolumeDescriptor();
    this.walkDirectory(this.root, '', 0, new Set());
  }

  readVolumeDescriptor() {
    const maxSector = Math.min(64, Math.floor(this.buffer.byteLength / SECTOR_SIZE));
    let primary = null;
    for (let sector = 16; sector < maxSector; sector++) {
      const offset = sector * SECTOR_SIZE;
      const type = this.view.getUint8(offset);
      const identifier = new TextDecoder('ascii').decode(new Uint8Array(this.buffer, offset + 1, 5));
      const version = this.view.getUint8(offset + 6);
      if (identifier !== 'CD001' || version !== 1) continue;
      if (type === 1) { primary = offset; break; }
      if (type === 255) break;
    }
    if (primary === null) throw new Error('No se encontró el descriptor primario ISO 9660 (CD001).');

    const pvd = new DataView(this.buffer, primary, SECTOR_SIZE);
    this.systemId = new TextDecoder('ascii').decode(new Uint8Array(this.buffer, primary + 8, 32)).trim();
    this.volumeId = new TextDecoder('ascii').decode(new Uint8Array(this.buffer, primary + 40, 32)).trim();
    const littleBlock = pvd.getUint16(128, true);
    const bigBlock = pvd.getUint16(130, false);
    if (littleBlock !== bigBlock || littleBlock < 512 || littleBlock > 4096 || (littleBlock & (littleBlock - 1)) !== 0) {
      throw new Error('Tamaño de bloque lógico ISO 9660 no compatible.');
    }
    this.sectorSize = littleBlock;
    const rootRecord = parseDirectoryRecord(pvd, 156, SECTOR_SIZE - 156);
    if (!rootRecord || !(rootRecord.flags & 2)) throw new Error('El directorio raíz de la imagen no es válido.');
    this.root = {
      name: '/',
      path: '/',
      extent: rootRecord.extent,
      size: rootRecord.size,
      flags: rootRecord.flags,
      directory: true
    };
  }

  walkDirectory(directory, parentPath, depth, visited) {
    if (depth > MAX_DEPTH) throw new Error('La estructura de directorios supera el límite de profundidad.');
    if (this.entries.length >= MAX_ENTRIES) throw new Error('La imagen contiene demasiadas entradas para el inspector.');
    const key = directory.extent + ':' + directory.size;
    if (visited.has(key)) return;
    visited.add(key);

    const start = directory.extent * this.sectorSize;
    const end = start + directory.size;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end > this.buffer.byteLength || directory.size === 0) {
      throw new Error('Un directorio apunta fuera de los límites de la imagen.');
    }

    let cursor = start;
    while (cursor < end) {
      const sectorOffset = cursor % this.sectorSize;
      const recordLength = this.view.getUint8(cursor);
      if (recordLength === 0) {
        cursor += this.sectorSize - sectorOffset;
        continue;
      }
      const record = parseDirectoryRecord(this.view, cursor, Math.min(recordLength, end - cursor));
      if (!record) break;
      cursor += record.length;
      if (record.special || !record.name) continue;
      const isDirectory = (record.flags & 2) !== 0;
      const path = parentPath ? parentPath + '/' + record.name : record.name;
      const entry = {
        name: record.name,
        path,
        extent: record.extent,
        size: record.size,
        flags: record.flags,
        directory: isDirectory
      };
      this.entries.push(entry);
      if (this.entries.length > MAX_ENTRIES) throw new Error('La imagen contiene demasiadas entradas para el inspector.');
      if (isDirectory) this.walkDirectory(entry, path, depth + 1, visited);
    }
  }

  readHeader(entry, length = 32) {
    if (!entry || entry.directory) throw new Error('Selecciona un archivo, no una carpeta.');
    const count = Math.max(0, Math.min(256, length, entry.size));
    const start = entry.extent * this.sectorSize;
    const end = start + count;
    if (!Number.isSafeInteger(start) || end > this.buffer.byteLength) throw new Error('El archivo apunta fuera de la imagen.');
    return new Uint8Array(this.buffer, start, count);
  }

  summary() {
    const files = this.entries.filter(entry => !entry.directory);
    return {
      volumeId: this.volumeId,
      systemId: this.systemId,
      sectorSize: this.sectorSize,
      totalEntries: this.entries.length,
      files: files.length,
      directories: this.entries.length - files.length,
      bytes: files.reduce((sum, file) => sum + file.size, 0)
    };
  }
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
