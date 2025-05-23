import { deepCopy, isArray, isFunction, isObject } from '@intlify/shared'
import { vueI18nConfigs, localeLoaders, nuxtI18nOptions, normalizedLocales } from '#internal/i18n/options.mjs'
// @ts-expect-error virtual file
import { dtsFile } from '#internal/i18n-type-generation-options'
import { loadLocale, loadVueI18nOptions } from '../messages'
import { nuxtMock } from './utils'
import { writeFile } from 'fs/promises'

import type { DefineLocaleMessage } from '@intlify/h3'
import type { Locale, LocaleMessages, I18nOptions } from 'vue-i18n'

export default async () => {
  const targetLocales: string[] = []

  if (nuxtI18nOptions.experimental.typedOptionsAndMessages === 'default' && nuxtI18nOptions.defaultLocale != null) {
    targetLocales.push(nuxtI18nOptions.defaultLocale)
  } else if (nuxtI18nOptions.experimental.typedOptionsAndMessages === 'all') {
    targetLocales.push(...normalizedLocales.map(x => x.code))
  }

  const merged = {
    messages: {},
    datetimeFormats: {},
    numberFormats: {}
  }

  const vueI18nConfig: I18nOptions = await loadVueI18nOptions(vueI18nConfigs, nuxtMock)
  for (const locale of targetLocales) {
    deepCopy(vueI18nConfig.messages?.[locale] || {}, merged.messages)
    deepCopy(vueI18nConfig.numberFormats?.[locale] || {}, merged.numberFormats)
    deepCopy(vueI18nConfig.datetimeFormats?.[locale] || {}, merged.datetimeFormats)
  }

  const loaderPromises: Promise<void>[] = []
  for (const locale in localeLoaders) {
    if (!targetLocales.includes(locale)) continue

    async function loader() {
      const setter = (_: Locale, message: LocaleMessages<DefineLocaleMessage, Locale>) => {
        deepCopy(message, merged.messages)
      }

      await loadLocale(locale, localeLoaders, setter, nuxtMock)
    }

    loaderPromises.push(loader())
  }

  await Promise.all(loaderPromises)

  await writeFile(dtsFile, generateTypeCode(merged), 'utf-8')
}

/**
 * Simplifies messages object to properties of an interface
 */
function generateInterface(obj: Record<string, unknown>, indentLevel = 1) {
  const indent = '  '.repeat(indentLevel)
  let str = ''

  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue

    if (isObject(obj[key]) && obj[key] !== null && !isArray(obj[key])) {
      str += `${indent}"${key}": {\n`
      str += generateInterface(obj[key] as Record<string, unknown>, indentLevel + 1)
      str += `${indent}};\n`
    } else {
      // str += `${indent}/**\n`
      // str += `${indent} * ${JSON.stringify(obj[key])}\n`
      // str += `${indent} */\n`
      let propertyType = isArray(obj[key]) ? 'unknown[]' : typeof obj[key]
      if (isFunction(propertyType)) {
        propertyType = '() => string'
      }
      str += `${indent}"${key}": ${propertyType};\n`
    }
  }
  return str
}

function generateTypeCode(res: I18nOptions) {
  return `// generated by @nuxtjs/i18n
import type { DateTimeFormatOptions, NumberFormatOptions, SpecificNumberFormatOptions, CurrencyNumberFormatOptions } from '@intlify/core'

interface GeneratedLocaleMessage {
  ${generateInterface(res.messages || {}).trim()}
}

interface GeneratedDateTimeFormat {
  ${Object.keys(res.datetimeFormats || {})
    .map(k => `${k}: DateTimeFormatOptions;`)
    .join(`\n  `)}
}

interface GeneratedNumberFormat {
  ${Object.entries(res.numberFormats || {})
    .map(([k]) => `${k}: NumberFormatOptions;`)
    .join(`\n  `)}
}

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends GeneratedLocaleMessage {}
  export interface DefineDateTimeFormat extends GeneratedDateTimeFormat {}
  export interface DefineNumberFormat extends GeneratedNumberFormat {}
}

declare module '@intlify/core' {
  export interface DefineCoreLocaleMessage extends GeneratedLocaleMessage {}
}

export {}`
}
