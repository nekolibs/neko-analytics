// TODO: Remove neko-ui deps
import { Platform } from '@neko-os/ui'

let DeviceModule = null
try {
  DeviceModule = require('expo-device')
} catch {}

let ConstantsModule = null
try {
  ConstantsModule = require('expo-constants')?.default
} catch {}

let LocalizationModule = null
try {
  LocalizationModule = require('expo-localization')
} catch {}

function getBrowserLocale() {
  if (typeof navigator === 'undefined') return null
  const tag = navigator.language || navigator.languages?.[0]
  if (!tag) return null
  const parts = tag.split('-')
  return { languageCode: parts[0] || null, regionCode: parts[1]?.toUpperCase() || null }
}

export function getDeviceInfo(config) {
  const locale = LocalizationModule?.getLocales?.()?.[0] || getBrowserLocale()

  return {
    platform: Platform.OS || null,
    language: config?.language || locale?.languageCode || null,
    country: config?.country || locale?.regionCode || null,
    device_model: config?.device_model || DeviceModule?.modelName || null,
    platform_version: config?.platform_version || DeviceModule?.osVersion || null,
    app_version: config?.app_version || ConstantsModule?.expoConfig?.version || null,
  }
}
