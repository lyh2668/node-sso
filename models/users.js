import db from '../db'
import Sequelize from 'sequelize'

const User = db.define('user', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true
  },
  username: {
    type: Sequelize.STRING
  },
  pass: {
    type: Sequelize.STRING
  },
  token: {
    type: Sequelize.STRING
  }
}, {
  tableName: 'lg_user',
  freezeTableName: true,
  timestamps: false
})

export default User
