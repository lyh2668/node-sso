import express from 'express'
import bodyParser from 'body-parser'
import session from 'express-session'
import connectRedis from 'connect-redis'
import redisClient from './redis'
import path from 'path'
import axios from 'axios'
import uuidV4 from 'uuid/v4'

import { splitCookies } from './utils'

const passportBaseUrl= 'http://passport.xxx.com:1280'
const axiosInstance = axios.create({
  baseURL: passportBaseUrl,
  withCredentials: true
})

const app = express()
const redisStore = connectRedis(session)
const store = new redisStore({
  client: redisClient
})
// connenct-redis默认的prefix就是这个
const defaultPrefix = 'sess:'

const sess = {
  cookie: {
    maxAge: 1000 * 1000  // 有效期，单位是毫秒
  }
}

app.use(session({
  ...sess,
  name: 'sid',
  genid: (req) => {
    return uuidV4() // use UUIDs for session IDs
  },
  store,
  secret: 'session-secret',
  resave: true,
  saveUninitialized: false,
}))
app.use(bodyParser.json())

// 发起一个认证请求
const authenticate = async (req) => {
  const cookies = splitCookies(req.headers.cookie)
  // 判断是否含有token，如没有token，则返回失败分支
  const token = cookies['token']
  if (!token) {
    throw ('token is required.')
  }

  const sid = cookies['sid']

  // 如果获取到user，则说明该用户已经登录
  if (req.session.user) {
    return req.session.user
  }

  // 向passport服务器发起一个认证请求
  try {
    // 这里的sid应该是存在redis里的key
    let response = await axiosInstance.post('/authenticate', {
      token,
      sid: defaultPrefix + req.sessionID,
      name: 'xxxx' // 可以用来区分具体的子系统
    })
    if (response.data.code !== 0) {
      throw new Error(response.data.msg)
    }
    // 认证成功则建立局部会话，并将用户标识保存起来，比如这里可以是一个uid，或者也可以是token
    req.session.user = response.data.data
    req.session.save()

    return response.data
  } catch (err) {
    throw err
  }
}

app.get('/users', async (req, res, next) => {
  try {
    // 认证成功并返回保护资源
    let response = await authenticate(req, res)
    // 此处表示认证成功，使用获得的用户标识去请求用户信息，具体的业务逻辑每个系统自行实现
    return res.json({
      code: 0,
      msg: 'success',
      data: req.session.user
    })
  } catch (err) {
    // 认证失败，让用户主动去登录
    return res.json({
      code: 1,
      msg: `Authenticate Failed: ${err.message}`
    })
  }
})

app.get('/', async (req, res, next) => {
  return res.sendFile(path.resolve('./test.html'))
})

app.use((err, req, res, next) => {
  console.error('err: ', err.message)
  return res.json({
    code: 9999,
    msg: err.message
  })
})

const mapPort = {
  'ssoa': 11001,
  'ssob': 11002
}
const port = mapPort[process.env.NODE_ENV]
if (port) {
  console.log('listen port: ', port)
  app.listen(port)
}
