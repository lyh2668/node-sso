基于Node Express的SSO（单点登录）实践
=====

[掘金文章：不务正业的前端之SSO（单点登录）实践](https://juejin.im/post/5b51f39b5188251a9f24a264)

## 简介
此示例主要实现了a.xxx.com和b.xxx.com同一域名下的单点登录，其中一个子系统登录以后passport认证服务器将会颁发一个令牌token，存于domain为.xxx.com的cookie中，子系统可使用该令牌去向各自系统的服务器发起受保护资源的请求，子系统将会对token进行检验，通过则会注册子系统，子系统会和用户建立一个局部会话，后续的受保护资源请求将会优先通过cookie中的sid获取。

## 项目目录
```
├── config // 配置文件，该文件已脱敏，执行该项目前需要自行添加
│   ├── crypto.js // 存放了一个salt值
│   └── db.js // 数据库连接配置
├── db.js // 数据库入口
├── index.js // 子系统入口
├── models
│   └── users.js // 用户模型
├── package.json 
├── passport.js // 认证服务
├── redis.js // redis入口及配置
├── test.html // 测试页面
├── utils.js // 通用方法
└── yarn.lock
```

## 启动准备
这里设置了两个测试的子系统，分别为http://testssoa.xxx.com:1280/和http://testssob.xxx.com:1280/，认证服务器的域名为http://passport.xxx.com:1280，为了让本地能够访问到这些域名，需要做一些准备工作

ps: 均在MacOS上操作，不同的操作系统文件目录会有些差别 
### 1. 配置hosts文件
```
// MacOS
sudo vim /etc/hosts
// 添加以下三行
127.0.0.1   testssoa.xxx.com
127.0.0.1   testssob.xxx.com
127.0.0.1   passport.xxx.com
```

### 2. 添加nginx反向代理配置
1. 先安装nginx
2. 添加对应站点的配置
```
vim /usr/local/etc/nginx/nginx.conf

// 添加以下3个代理
server {
  listen 1280;
  server_name passport.xxx.com;

  location / {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_pass http://127.0.0.1:11000;
  }
}

server {
  listen 1280;
  server_name testssoa.xxx.com;

  location / {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_pass http://127.0.0.1:11001;
  }
}

server {
  listen 1280;
  server_name testssob.xxx.com;

  location / {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_pass http://127.0.0.1:11002;
  }
}
```
3. nginx -t 检测配置是否有效
4. nginx -s reload 重启nginx

### 3. 安装所需环境
1. node环境，建议8.x以上
2. redis环境，因为项目最后部署到windows上，所以我安装的是3.x版本

### 4. 添加脱敏config文件
```
// db.js 数据库类型是mssql，可自行修改
export default {
  database: '',
  username: '',
  password: '',
  host: '',
  port: 
}
// crypto.js
export const salt = 'xxxx'
```

### 5. 启动服务
```
"start": "babel-node passport.js",
"starta": "cross-env NODE_ENV=ssoa babel-node index.js",
"startb": "cross-env NODE_ENV=ssob babel-node index.js"
```
分别用npm start、npm run starta 和 npm run startb启动三个服务

