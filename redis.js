import redis from 'redis'
import bluebird from 'bluebird'

bluebird.promisifyAll(redis)
const redisClient = redis.createClient()

redisClient.on('error', (err) => {
  console.log('redis err: ', err)
})

export default redisClient
