import { useRuntimeConfig } from '#imports'
import { defineI18nMiddleware } from '@intlify/h3'
import { localeCodes, vueI18nConfigs, localeLoaders } from '#internal/i18n/options.mjs'
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin'
import { localeDetector as _localeDetector } from '#internal/i18n/locale.detector.mjs'
import { nuxtMock } from './utils'
import { loadVueI18nOptions, loadInitialMessages, makeFallbackLocaleCodes, loadAndSetLocaleMessages } from '../messages'

import type { H3Event } from 'h3'
import type { Locale, DefineLocaleMessage } from 'vue-i18n'
import type { CoreContext } from '@intlify/h3'

// eslint-disable-next-line @typescript-eslint/no-misused-promises
export default defineNitroPlugin(async nitro => {
  // `defineI18nMiddleware` options (internally, options passed to`createCoreContext` in intlify / core) are compatible with vue-i18n options
  const options = await loadVueI18nOptions(vueI18nConfigs, nuxtMock)
  options.messages = options.messages || {}
  const fallbackLocale = (options.fallbackLocale = options.fallbackLocale ?? false)

  const runtimeI18n = useRuntimeConfig().public.i18n
  const initialLocale = runtimeI18n.defaultLocale || options.locale || 'en-US'

  // load initial locale messages for intlify/h3
  options.messages = await loadInitialMessages(
    options.messages,
    localeLoaders,
    {
      localeCodes,
      initialLocale,
      lazy: runtimeI18n.lazy,
      defaultLocale: runtimeI18n.defaultLocale,
      fallbackLocale: options.fallbackLocale
    },
    nuxtMock
  )

  const localeDetector = async (
    event: H3Event,
    i18nContext: CoreContext<string, DefineLocaleMessage>
  ): Promise<Locale> => {
    const locale = _localeDetector(event, {
      defaultLocale: initialLocale,
      fallbackLocale: options.fallbackLocale
    })
    if (runtimeI18n.lazy) {
      if (fallbackLocale) {
        const fallbackLocales = makeFallbackLocaleCodes(fallbackLocale, [locale])
        await Promise.all(
          fallbackLocales.map(locale => loadAndSetLocaleMessages(locale, localeLoaders, i18nContext.messages, nuxtMock))
        )
      }
      await loadAndSetLocaleMessages(locale, localeLoaders, i18nContext.messages, nuxtMock)
    }
    return locale
  }

  const { onRequest, onAfterResponse } = defineI18nMiddleware({
    ...options,
    locale: localeDetector
  } as Parameters<typeof defineI18nMiddleware>[0])

  nitro.hooks.hook('request', onRequest)
  nitro.hooks.hook('afterResponse', onAfterResponse)
})
