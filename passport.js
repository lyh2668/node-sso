import express from 'express'
import bodyParser from 'body-parser'
import redisClient from './redis'
import userModel from './models/users'
import jwt from 'jsonwebtoken'
import { splitCookies, passwordMD5 } from './utils'

const app = express()
app.use(bodyParser.json())

const tokenConfig = {
  secret: 'token-secret',
  expiresIn: 60 * 60 * 24
}

app.all('*', (req, res, next) => {
  // Access-Control-Allow-Origin 只能设置一个域名，所以这里稍微取巧匹配一下，其实也可以通过nginx代理
  const whiteOriginDomain = '.xxx.com'
  let origin = req.headers.origin
  if (origin) {
    origin.indexOf(whiteOriginDomain) > -1
      && res.header('Access-Control-Allow-Origin', origin)
  }
  // Access-Control-Allow-Credentials 必须为 ture，才能把Cookie携带过来 
  res.header('Access-Control-Allow-Credentials', true)
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type')
  res.header('Access-Control-Allow-Methods','PUT,POST,GET,DELETE,OPTIONS')
  res.header('Content-Type', 'application/json;charset=utf-8')
  next()
})

// 这里用来验证是否登录
app.post('/authenticate', async (req, res, next) => {
  const { token, sid, name } = req.body
  try {
    // 检查请求的真实IP是否为授权系统
    // nginx会将真实IP传过来，伪造x-forward-for是无效的
    if (!checkSecurityIP(req.headers['x-real-ip'])) {
      throw new Error('ip is invalid')
    }
    // 判断token是否还存在于redis中并验证token是否有效, 取得用户名和用户id
    const tokenExists = await redisClient.existsAsync(token)
    if (!tokenExists) {
      throw new Error('token is invalid')
    }
    const { username, id } = await jwt.verify(token, tokenConfig.secret)
    // 校验成功注册子系统
    register(token, sid, name)
    return res.json({
      code: 0,
      msg: 'success',
      data: { username, id }
    })
  } catch (err) {
    // 对于token过期也应该执行一次clear操作
    next(new Error(err))
  }
})

app.post('/login', async (req, res, next) => {
  // 登录成功则给当前domain下的cookie设置token
  const { username, password } = req.body

  // 通过 username 跟 password 取出数据库中的用户
  try {
    console.log('begin auth user')
    const user = await authUser(username, password)
    const lastToken = user.token
    // 此处生成token，此处使用jwt
    const newToken = jwt.sign(
      { username, id: user.id },
      tokenConfig.secret,
      { expiresIn: tokenConfig.expiresIn }
    )
    await storeToken(newToken)

    // 生成新的token以后需要清除子系统的session
    if (lastToken) {
      await clearClientStore(lastToken)
      await deleteToken(lastToken)
    }

    res.setHeader(
      'Set-Cookie',
      `token=${newToken};domain=xxx.com;max-age=${tokenConfig.expiresIn};httpOnly`)

    return res.json({
      code: 0,
      msg: 'success'
    })
  } catch (err) {
    next(new Error(err))
  }
})

// 用户主动退出登录，将所有的子系统退出
app.post('/logout', async (req, res, next) => {
  // 这里需要做的就是把 token 对应的所有子系统的 seesionID 清除
  try {
    let cookies = splitCookies(req.headers.cookie)
    let token = cookies['token']
    console.log('cookies: ', cookies)

    if (token) {
      await clearClientStore(token)
      await deleteToken(token)
    }

    return res.json({
      code: 0,
      msg: 'logout success'
    })
  } catch (err) {
    next(new Error(err))
  }
})

// 这里对所有抛出的异常简单处理一下
app.use((err, req, res, next) => {
  console.error('err: ', err.message)
  return res.json({
    code: 9999,
    msg: err.message
  })
})

// 注册子系统
const register = async (token, sid, name) => {
  try {
    // 保存到redis里
    let value = await redisClient.getAsync(token)
    if (!value) {
      value = [{ name, sid }]
    } else {
      value = JSON.parse(value)
      value.push({ name, sid })
    }
    await redisClient.setAsync(token, JSON.stringify(value))
  } catch (err) {
    throw err
  }
}

const clearClientStore = async (token) => {
  // 根据token去查询redis，并把子系统的session清除
  if (!token) {
    return
  }
  try {
    let value = await redisClient.getAsync(token)
    if (!value) {
      return
    }
    // 这个value肯定是一个数组，这里就不检查类型了
    value = JSON.parse(value)

    for (let item of value) {
      redisClient.del(item.sid)
    }
  } catch (err) {
    throw err
  }
}

const authUser = async (username, password) => {
  try {
    let { dataValues } = await userModel.findOne({ where: { username } }) || {}
    if (!dataValues) {
      throw new Error('this user does not exist.')
    }
    if (dataValues.pass === passwordMD5(password)) {
      return dataValues
    }
    throw new Error('password is error')
  } catch (err) {
    throw err
  }
}

// 将token存储在redis里
const storeToken = async (token) => {
  try {
    // 填入一个空的数组，后续需要用到这个数组
    await redisClient.setAsync(token, JSON.stringify([]))
  } catch (err) {
    throw err
  }
}

const deleteToken = async (token) => {
  try {
    await redisClient.delAsync(token)
  } catch (err) {
    throw err
  }
}

const checkSecurityIP = (ip) => {
  // 这里可以去从数据库中读取一份维护的有效IP地址列表
  const securityIP = '127.0.0.1'
  return securityIP === ip
}

const port = 11000
console.log('passport server listen port: ', port)
app.listen(port)
