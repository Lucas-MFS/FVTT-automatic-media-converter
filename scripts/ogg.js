// Ogg framing (RFC 3533) for Opus packets (RFC 7845).
export function crc32(bytes) {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 24;
    for (let bit = 0; bit < 8; bit++) crc = (crc << 1) ^ ((crc & 0x80000000) ? 0x04c11db7 : 0);
  }
  return crc >>> 0;
}

export function oggPage(packet, {serial, sequence, granule = 0, flags = 0}) {
  const segments = Math.floor(packet.length / 255) + 1;
  if (segments > 255) throw new Error("Ogg packet too large");
  const page = new Uint8Array(27 + segments + packet.length);
  const view = new DataView(page.buffer);
  page.set(new TextEncoder().encode("OggS"));
  page[5] = flags;
  view.setBigUint64(6, BigInt(granule), true);
  view.setUint32(14, serial, true);
  view.setUint32(18, sequence, true);
  page[26] = segments;
  page.fill(255, 27, 27 + segments - 1);
  page[27 + segments - 1] = packet.length % 255;
  page.set(packet, 27 + segments);
  view.setUint32(22, crc32(page), true);
  return page;
}

export function muxOpus(packets, head, samples, serial) {
  if (!packets.length || head.length !== 19 || new TextDecoder().decode(head.subarray(0, 8)) !== "OpusHead" || head[18] !== 0) {
    throw new Error("Invalid or unsupported Opus stream");
  }
  const preSkip = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint16(10, true);
  const vendor = new TextEncoder().encode("Automatic Media Converter");
  const tags = new Uint8Array(16 + vendor.length);
  tags.set(new TextEncoder().encode("OpusTags"));
  new DataView(tags.buffer).setUint32(8, vendor.length, true);
  tags.set(vendor, 12);
  const pages = [oggPage(head, {serial, sequence: 0, flags: 2}), oggPage(tags, {serial, sequence: 1})];
  let granule = 0;
  for (let i = 0; i < packets.length; i++) {
    granule += Math.round(packets[i].duration * 48000 / 1e6);
    const last = i === packets.length - 1;
    pages.push(oggPage(packets[i].data, {serial, sequence: i + 2,
      granule: last ? Math.min(granule, preSkip + samples) : granule, flags: last ? 4 : 0}));
  }
  return new Blob(pages, {type: "audio/ogg"});
}
