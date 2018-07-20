import crypto from 'crypto'
import { salt } from './config/crypto'

export const splitCookies = (cookie) => {
  const cookies = {}
  cookie && cookie.split(';').forEach(( item ) => {
    const parts = item.split('=')
    cookies[parts[ 0 ].trim()] = (parts[ 1 ] || '').trim()
  })
  return cookies
}

export const passwordMD5 = (password) => {
  const md5 = crypto.createHash('md5')
  return md5.update(salt + password).digest('hex').substring(8, 24)
}
