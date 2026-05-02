import request from './request';

// 定义接口返回和请求的数据类型 (Types)
export interface ApiResponseResult<T> {
  success: boolean;
  code: number;
  msg: string;
  cost: number;
  data: T;
}

export interface UserRegistryInfoRequest {
  username?: string;
  password?: string;
  mobile?: string;
  picCheckCode?: string;
}

export interface SlideVerificationData {
  id: string;
  image: string;
  x: number;
  y: number;
}

export interface UserLoginRequest {
  mobile: string;
  password: string;
  slideCode: string;
}

export interface UserInfo {
  id?: string;
  userId?: string;
  userName?: string;
  mobile?: string;
  photo?: string;
  signature?: string;
  [key: string]: any;
}

export interface SearchUserInfo {
  id: number;
  mobile: string;
  photo: string | null;
  registryTime: string | null;
  registryTimeStr: string | null;
  roleCode: number;
  sex: number | null;
  signature: string;
  userId: string;
  userName: string;
}

export interface FriendApplyItem {
  applyId: number;
  applyTime: number;
  applyUser: SearchUserInfo;
}

export interface SendMessageRequest {
  senderId: string;
  receiverId: string;
  proxySenderId?: string | null;
  message: string;
  type: number;
  image?: string | null;
  rejectVideoOffer?: boolean;
}

export interface CreateChatGroupRequest {
  groupName: string;
  userIds: string[] | string;
  createUserId: string;
}

export interface GroupInfo {
  groupId: string;
  groupName: string;
  id: number;
  userCount: number;
}

export interface ChatHistoryMessage {
  groupMessage: boolean;
  image: string | null;
  isRead: boolean;
  message: string;
  messageId: number;
  momentMessage: boolean;
  printMessage: string | null;
  proxySender: SearchUserInfo | null;
  proxySenderId: string | null;
  receiver: SearchUserInfo;
  receiverId: string;
  redPacket: boolean;
  rejectVideoOffer: boolean;
  sender: SearchUserInfo;
  senderId: string;
  senderName: string | null;
  time: number;
  type: number;
  videoOffer: boolean;
}

// 注册接口
export const registerUser = (data: UserRegistryInfoRequest): Promise<ApiResponseResult<unknown>> => {
  return request.post('/api/user/register', data);
};

// 登录接口 (预留)
export const loginUser = (data: UserLoginRequest): Promise<ApiResponseResult<unknown>> => {
  return request.post('/api/user/login', data, { withCredentials: true });
};

// 退出登录接口
export const logoutUser = (): Promise<ApiResponseResult<unknown>> => {
  return request.post('/api/user/logout', {}, { withCredentials: true });
};

// 获取当前登录用户信息
export const getCurrentUserInfo = (): Promise<ApiResponseResult<UserInfo>> => {
  return request.get('/api/user/getCurrentUserInfo', { withCredentials: true });
};

// 根据手机号搜索用户
export const searchUserByMobile = (mobile: string): Promise<ApiResponseResult<SearchUserInfo>> => {
  return request.get(`/api/user/search/${encodeURIComponent(mobile)}`, { withCredentials: true });
};

// 申请添加好友
export const applyAddFriend = (friendId: string): Promise<ApiResponseResult<boolean>> => {
  // 根据常见的 REST 规范，申请操作使用 POST，若您的后端是 GET，请改为 request.get
  return request.post(`/api/friend/applyAdd/${encodeURIComponent(friendId)}`, {}, { withCredentials: true });
};

// 获取未处理的好友申请列表
export const getUnhandledFriendApplies = (): Promise<ApiResponseResult<FriendApplyItem[]>> => {
  return request.get('/api/friend/listUnHandleApply', { withCredentials: true });
};

// 获取未处理的好友申请数量
export const countUnhandledFriendApplies = (): Promise<ApiResponseResult<number>> => {
  return request.get('/api/friend/countUnHandleApply', { withCredentials: true });
};

// 搜索好友列表
export const listFriendUsers = (userName: string = ""): Promise<ApiResponseResult<any[]>> => {
  return request.get(`/api/friend/listFriendUsers?userName=${encodeURIComponent(userName)}`, { withCredentials: true });
};

// 同意好友申请
export const passFriendApply = (applyId: number): Promise<ApiResponseResult<boolean>> => {
  return request.post(`/api/friend/applyPass/${applyId}`, {}, { withCredentials: true });
};

// 拒绝好友申请
export const refuseFriendApply = (applyId: number): Promise<ApiResponseResult<boolean>> => {
  return request.post(`/api/friend/applyRefuse/${applyId}`, {}, { withCredentials: true });
};

export const getSlideVerification = (): Promise<ApiResponseResult<SlideVerificationData>> => {
  return request.get('/api/slide/verification/get', { withCredentials: true });
};

export const getSlideVerificationImage = async (imagePath: string): Promise<string> => {
  const res = await request.get(imagePath, { responseType: 'blob', withCredentials: true });
  return URL.createObjectURL(res.data);
};

export const validateSlideVerification = (accessToken: string): Promise<ApiResponseResult<boolean>> => {
  return request.request({
    url: `/api/slide/verification/validate/${encodeURIComponent(accessToken)}`,
    method: 'post',
    withCredentials: true,
  });
};

// 获取图形验证码 (返回图片 Blob URL)
export const getCaptchaImage = async (): Promise<string> => {
  const res = await request.get('/api/valid-code/pic', {
    responseType: 'blob',
    withCredentials: true
  });
  return URL.createObjectURL(res.data);
};

// 发送聊天消息
export const sendMessage = (data: SendMessageRequest): Promise<ApiResponseResult<unknown>> => {
  return request.post('/api/chat/message/send', data);
};

export const listChatMessageUsers = (selectUser?: string): Promise<ApiResponseResult<any[]>> => {
  const query = selectUser ? `?selectUser=${encodeURIComponent(selectUser)}` : "";
  return request.get(`/api/chat/message/users${query}`, { withCredentials: true });
};

export const countUnreadMessageUsers = (): Promise<ApiResponseResult<number>> => {
  return request.get('/api/chat/message/unReadUserCount', { withCredentials: true });
};

export const queryChatMessages = (chatUserId: string, size: number): Promise<ApiResponseResult<ChatHistoryMessage[]>> => {
  return request.get(`/api/chat/message/query/${encodeURIComponent(chatUserId)}/${size}`, { withCredentials: true });
};

export const createChatGroup = (data: CreateChatGroupRequest): Promise<ApiResponseResult<unknown>> => {
  return request.post('/api/user/createChatGroup', data, { withCredentials: true });
};

export const listGroups = (): Promise<ApiResponseResult<GroupInfo[]>> => {
  return request.get('/api/user/listGroups', { withCredentials: true });
};
