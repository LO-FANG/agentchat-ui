# AgentChat UI

一个面向即时通讯场景的前端项目，基于 `Vite + React + TypeScript + Tailwind CSS` 构建，包含登录/注册、安全校验、好友与群组管理、会话列表、聊天消息流以及 WebSocket 实时通信能力。

项目当前实现重点：

- 票据机风格的登录 / 注册界面
- 注册图形验证码与登录滑块拼图验证
- 桌面端三栏 IM 布局
- 移动端会话列表 / 聊天页切换
- 好友搜索、好友申请、通知处理
- 群组创建、会话切换、聊天记录查询
- WebSocket 实时消息与心跳重连

## 页面概览

### 1. 登录 / 注册页

路由：`/`

特性：

- 登录与注册共用一套票据式交互 UI
- 注册时调用图形验证码接口
- 登录时调用滑块拼图验证接口
- 登录成功后带过渡动画跳转到聊天页

### 2. 聊天主页面

路由：`/chat`

特性：

- 桌面端三栏布局：功能栏 / 会话列表 / 消息区 / 信息栏
- 移动端适配：列表页与会话页分屏切换
- 会话列表、未读标记、历史消息加载
- 好友搜索、加好友、通知审批
- 群组列表、建群弹窗、群会话入口
- WebSocket 在线状态、心跳保活、断线重连

## 技术栈

- `React 18`
- `TypeScript`
- `Vite 6`
- `React Router`
- `Tailwind CSS`
- `Axios`
- `Zustand`
- `lucide-react`

## 运行环境

- `Node.js 18+`
- `npm 9+`

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

开发环境默认使用 `.env.development`：

```bash
VITE_API_BASE_URL=http://localhost:8101
```

生产环境示例 `.env.production`：

```bash
VITE_API_BASE_URL=https://api.yourdomain.com
```

### 3. 启动开发环境

```bash
npm run dev -- --host
```

默认访问地址通常为：

```text
http://localhost:5173
```

### 4. 其他脚本

```bash
npm run build
npm run preview
npm run check
npm run lint
```

## 环境变量说明

### `VITE_API_BASE_URL`

用途：

- 作为 `axios` 实例的 `baseURL`
- 用于拼接用户头像、验证码等后端静态资源地址
- 生产环境下用于生成 WebSocket 直连地址

当前默认值：

- 开发环境：`http://localhost:8101`
- 生产环境：空字符串，需要部署时自行配置

## 开发代理说明

`vite.config.ts` 中已配置本地代理：

- `/api` -> `http://localhost:8101`
- `/ws` -> `ws://localhost:8101`

这意味着本地开发时：

- HTTP 请求默认访问后端 `8101`
- WebSocket 可通过前端域名下的 `/ws/chat/:uid` 转发

## 接口约定

当前前端已接入的主要接口如下。

### 用户与认证

- `POST /api/user/register`
- `POST /api/user/login`
- `POST /api/user/logout`
- `GET /api/user/getCurrentUserInfo`
- `GET /api/user/search/{mobile}`

### 验证码

- `GET /api/valid-code/pic`
- `GET /api/slide/verification/get`
- `POST /api/slide/verification/validate/{accessToken}`

### 好友系统

- `POST /api/friend/applyAdd/{friendId}`
- `GET /api/friend/listUnHandleApply`
- `GET /api/friend/countUnHandleApply`
- `GET /api/friend/listFriendUsers?userName=`
- `POST /api/friend/applyPass/{applyId}`
- `POST /api/friend/applyRefuse/{applyId}`

### 聊天与群组

- `POST /api/chat/message/send`
- `GET /api/chat/message/users`
- `GET /api/chat/message/unReadUserCount`
- `GET /api/chat/message/query/{chatUserId}/{size}`
- `POST /api/user/createChatGroup`
- `GET /api/user/listGroups`

## 后端联调约定

- 所有请求默认开启 `withCredentials: true`
- 后端如果使用 Session / Cookie 鉴权，需要正确配置跨域和凭证传递
- 滑块验证接口既兼容标准响应体，也兼容直接返回 `true/false`
- 未登录或登录态失效时，前端会在部分场景下跳回首页

建议后端确保以下能力正常：

- `Access-Control-Allow-Credentials`
- 正常响应和异常响应都带上 CORS 头
- WebSocket 服务可访问 `/ws/chat/:uid`

## WebSocket 说明

聊天页会在获取到当前用户信息后建立 WebSocket 连接。

行为包括：

- 连接地址在开发环境下优先走当前域名下的 `/ws/chat/:uid`
- 生产环境若配置了 `VITE_API_BASE_URL`，则转为绝对地址直连
- 每 25 秒发送一次心跳
- 若 10 秒内未收到服务端 `ok` 响应，会判定连接异常并触发重连
- 使用指数退避策略进行自动重连

## 项目结构

```text
agentchat-ui/
├─ public/
├─ src/
│  ├─ api/
│  │  ├─ auth.ts
│  │  └─ request.ts
│  ├─ components/
│  │  └─ ui/
│  ├─ hooks/
│  ├─ lib/
│  ├─ pages/
│  │  ├─ Chat.tsx
│  │  ├─ Home.tsx
│  │  └─ IMHome.tsx
│  ├─ App.tsx
│  └─ main.tsx
├─ .env.development
├─ .env.production
├─ package.json
└─ vite.config.ts
```

核心文件说明：

- `src/pages/IMHome.tsx`：登录、注册、图形验证码、滑块验证、跳转过渡
- `src/pages/Chat.tsx`：聊天主界面、会话列表、好友与群组、通知、WebSocket
- `src/api/auth.ts`：所有业务接口封装与类型定义
- `src/api/request.ts`：Axios 实例和统一响应拦截
- `src/components/ui/InteractiveBackground.tsx`：页面动态背景
- `vite.config.ts`：开发代理、插件与构建配置

## 可用脚本

```bash
npm run dev      # 启动开发服务器
npm run build    # TypeScript 编译并构建产物
npm run preview  # 本地预览构建结果
npm run check    # 执行 TypeScript 类型检查
npm run lint     # 执行 ESLint
```

## 适用场景

这个项目适合作为以下场景的前端基础工程：

- 即时通讯系统原型
- 社交 / 私聊 / 群聊类后台前端
- WebSocket 聊天业务演示项目
- 登录验证与多状态交互页面练习项目

## 说明

- `src/pages/Home.tsx` 当前为占位页面，实际路由未使用
- 如果你计划部署到生产环境，建议补充项目截图、部署地址和后端仓库链接
- 如需进一步完善 README，可继续增加接口返回示例、页面截图和部署章节
