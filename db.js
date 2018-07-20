import Sequelize from 'sequelize'
import config from './config/db'

const db = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: 'mssql'
})

db.authenticate().then(() => {
  console.log('Connection has been established successfully.')
  // db.query('select * from sys.tables').then(res => {
  //   console.log(res)
  // })
}).catch(err => {
  console.error('Unable to connect to the database:', err)
})

export default db
