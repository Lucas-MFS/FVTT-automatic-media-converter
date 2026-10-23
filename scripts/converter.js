import {muxOpus} from "./ogg.js";

export function mediaKind(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (["webp", "ogg", "opus"].includes(ext)) return null;
  if (/^image\//.test(file.type) || ["jpg", "jpeg", "png", "bmp", "gif", "avif", "svg", "tif", "tiff"].includes(ext)) return "image";
  if (/^audio\//.test(file.type) || ["mp3", "wav", "flac", "m4a", "aac", "aiff", "aif", "weba"].includes(ext)) return "audio";
  return null;
}

export function convertedName(name, extension) {
  return `${name.replace(/\.[^.]*$/, "") || "media"}.${extension}`;
}

async function imageToWebP(file, quality) {
  // Animated sources cannot be flattened silently.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = new TextDecoder("latin1").decode(bytes);
  if (/\.gif$/i.test(file.name) || file.type === "image/gif" || text.includes("acTL") || text.includes("avis")) {
    throw new Error("animatedImage");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob || blob.type !== "image/webp") throw new Error("imageUnsupported");
    return blob;
  } finally { bitmap.close(); }
}

async function audioToOgg(file, bitrate) {
  if (!globalThis.AudioEncoder || !globalThis.AudioData || !globalThis.OfflineAudioContext) throw new Error("audioUnsupported");
  const decoder = new OfflineAudioContext(2, 1, 48000);
  const decoded = await decoder.decodeAudioData(await file.arrayBuffer());
  if (decoded.numberOfChannels > 2) throw new Error("audioChannels");
  const channels = decoded.numberOfChannels;
  const config = {codec: "opus", sampleRate: 48000, numberOfChannels: channels,
    bitrate: bitrate * 1000, opus: {format: "ogg", frameDuration: 20000}};
  if (!(await AudioEncoder.isConfigSupported(config)).supported) throw new Error("audioUnsupported");
  const frames = Math.ceil(decoded.duration * 48000);
  const context = new OfflineAudioContext(channels, frames, 48000);
  const source = context.createBufferSource();
  source.buffer = decoded;
  source.connect(context.destination);
  source.start();
  const pcm = await context.startRendering();
  const packets = [];
  let head, failure;
  const encoder = new AudioEncoder({
    output(chunk, metadata) {
      if (metadata?.decoderConfig?.description) head = new Uint8Array(metadata.decoderConfig.description).slice();
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      packets.push({data, duration: chunk.duration});
    },
    error(error) { failure = error; }
  });
  try {
    encoder.configure(config);
    for (let offset = 0; offset < frames; offset += 960) {
      if (failure) throw failure;
      const count = Math.min(960, frames - offset);
      const data = new Float32Array(count * channels);
      for (let c = 0; c < channels; c++) data.set(pcm.getChannelData(c).subarray(offset, offset + count), c * count);
      const audio = new AudioData({format: "f32-planar", sampleRate: 48000, numberOfFrames: count,
        numberOfChannels: channels, timestamp: Math.round(offset / 48000 * 1e6), data});
      try { encoder.encode(audio); } finally { audio.close(); }
      // Do not flush between batches: flushing can introduce codec end padding.
      while (encoder.encodeQueueSize >= 50) {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (failure) throw failure;
      }
    }
    await encoder.flush();
    if (failure) throw failure;
    if (!head || packets.some(p => !Number.isFinite(p.duration))) throw new Error("audioUnsupported");
    return muxOpus(packets, head, frames, crypto.getRandomValues(new Uint32Array(1))[0]);
  } finally { if (encoder.state !== "closed") encoder.close(); }
}

export async function convertFile(file, {quality = 0.85, bitrate = 128, maxSize = 100} = {}) {
  const kind = mediaKind(file);
  if (!kind) return file;
  if (!file.size || file.size > maxSize * 1024 * 1024) throw new Error("sizeLimit");
  const blob = kind === "image" ? await imageToWebP(file, quality) : await audioToOgg(file, bitrate);
  return new File([blob], convertedName(file.name, kind === "image" ? "webp" : "ogg"),
    {type: blob.type, lastModified: file.lastModified});
}
