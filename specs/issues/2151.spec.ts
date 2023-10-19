import { test, describe, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { setup } from '../utils'
import { getText, gotoPath, renderPage } from '../helper'

describe('#2151', async () => {
  await setup({
    rootDir: fileURLToPath(new URL(`../fixtures/issues/2151`, import.meta.url)),
    browser: true
  })

  test('should load resources with `autoImport` disabled', async () => {
    const { page } = await renderPage('/', { locale: 'ja' })

    expect(await getText(page, '#msg')).toEqual('日本語のメッセージ')

    await gotoPath(page, '/en')
    expect(await getText(page, '#msg')).toEqual('English message')
  })
})
