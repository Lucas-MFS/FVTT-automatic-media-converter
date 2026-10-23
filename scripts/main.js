import {convertFile, mediaKind} from "./converter.js";

export const MODULE_ID = "automatic-media-converter";

export function wrapUpload(original, convert = convertFile) {
  return async function(source, path, file, body, options) {
    if (!game.settings.get(MODULE_ID, "enabled") || !mediaKind(file)) {
      return original.call(this, source, path, file, body, options);
    }
    let converted;
    try {
      converted = await convert(file, {
        quality: game.settings.get(MODULE_ID, "quality"),
        bitrate: game.settings.get(MODULE_ID, "bitrate"),
        maxSize: game.settings.get(MODULE_ID, "maxSize")
      });
    } catch (error) {
      console.error(`${MODULE_ID} | Conversion failed`, error);
      const key = `AMC.errors.${error.message}`;
      const reason = game.i18n.has(key) ? game.i18n.localize(key) : game.i18n.localize("AMC.errors.generic");
      ui.notifications.error(game.i18n.format("AMC.failed", {name: file.name, reason}));
      throw error;
    }
    // Upload errors belong to Foundry; never retry with the original file.
    return original.call(this, source, path, converted, body, options);
  };
}

Hooks.once("init", () => {
  const settings = {
    enabled: {type: Boolean, default: true},
    quality: {type: Number, default: 0.85, range: {min: 0.1, max: 1, step: 0.05}},
    bitrate: {type: Number, default: 128, choices: {64: "64 kbps", 96: "96 kbps", 128: "128 kbps", 192: "192 kbps", 256: "256 kbps"}},
    maxSize: {type: Number, default: 100, range: {min: 1, max: 250, step: 1}}
  };
  for (const [key, config] of Object.entries(settings)) {
    game.settings.register(MODULE_ID, key, {name: `AMC.settings.${key}.name`, hint: `AMC.settings.${key}.hint`,
      scope: "world", config: true, ...config});
  }
  const picker = foundry.applications.apps.FilePicker.implementation;
  picker.upload = wrapUpload(picker.upload);
});
