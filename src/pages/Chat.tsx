import React from "react";
import { useNavigate } from "react-router-dom";
import { InteractiveBackground } from "@/components/ui/InteractiveBackground";
import { ChevronLeft, Search, Send, Paperclip, Info, LogOut, Bell, UserPlus, Smile, Folder, Image as ImageIcon, MessageSquare, Users } from "lucide-react";
import { tiks } from "@rexa-developer/tiks";
import { getCurrentUserInfo, UserInfo, searchUserByMobile, SearchUserInfo, applyAddFriend, getUnhandledFriendApplies, countUnhandledFriendApplies, FriendApplyItem, passFriendApply, refuseFriendApply, listFriendUsers, logoutUser, sendMessage, listChatMessageUsers, countUnreadMessageUsers, queryChatMessages, createChatGroup, listGroups, GroupInfo } from "@/api/auth";

type ChatMessage = {
  id: string;
  role: "me" | "them";
  text: string;
  time: string;
  timestamp?: number | null;
  senderDisplayName?: string;
  senderPhoto?: string | null;
};

type ToastState = {
  variant: "success" | "error" | "info";
  message: string;
};

type Conversation = {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  unread?: number;
  hasUnread?: boolean;
  photo?: string | null;
  online?: boolean;
};

const isSameConversationList = (prev: Conversation[], next: Conversation[]) => {
  if (prev.length !== next.length) return false;
  return prev.every((item, index) => {
    const target = next[index];
    return (
      item.id === target?.id &&
      item.title === target?.title &&
      item.subtitle === target?.subtitle &&
      item.time === target?.time &&
      item.unread === target?.unread &&
      item.hasUnread === target?.hasUnread &&
      item.photo === target?.photo &&
      item.online === target?.online
    );
  });
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const MESSAGE_TIME_GAP_MS = 5 * 60 * 1000;

const formatTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const formatMessageTime = (d: Date) =>
  `${d.getFullYear()}年${pad2(d.getMonth() + 1)}月${pad2(d.getDate())}日 ${formatTime(d)}`;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const shouldShowMessageTime = (messages: ChatMessage[], index: number) => {
  const current = messages[index];
  if (!current) return false;
  if (index === 0) return true;

  const previous = messages[index - 1];
  if (!previous) return true;

  if (typeof current.timestamp === "number" && typeof previous.timestamp === "number") {
    const currentDate = new Date(current.timestamp);
    const previousDate = new Date(previous.timestamp);
    if (!isSameDay(currentDate, previousDate)) return true;
    return current.timestamp - previous.timestamp >= MESSAGE_TIME_GAP_MS;
  }

  return current.time !== previous.time;
};

const getMessageTimeLabel = (message: ChatMessage) => {
  if (typeof message.timestamp === "number") {
    return formatMessageTime(new Date(message.timestamp));
  }
  return message.time;
};

const seedConversations: Conversation[] = [
  { id: "c1", title: "Agent Support", subtitle: "随时输入 /help", time: "09:12", unread: 2, online: true },
  { id: "c2", title: "Team Alpha", subtitle: "今天的进度同步一下", time: "昨天", unread: 0, online: true },
  { id: "c3", title: "System", subtitle: "欢迎使用 Agent Chat", time: "周一", unread: 0, online: false },
];

const seedMessages: Record<string, ChatMessage[]> = {
  c1: [
    { id: "m1", role: "them", text: "欢迎回来。需要我帮你做什么？", time: "09:10" },
    { id: "m2", role: "me", text: "给我一个主流 IM 的聊天界面布局。", time: "09:11" },
    { id: "m3", role: "them", text: "左侧会话列表，中间消息流 + 输入框，右侧信息栏（可选）。", time: "09:12" },
  ],
  c2: [
    { id: "m1", role: "them", text: "10:30 站会别迟到。", time: "昨天" },
    { id: "m2", role: "me", text: "收到。", time: "昨天" },
  ],
  c3: [{ id: "m1", role: "them", text: "系统提示：这是一个演示会话。", time: "周一" }],
};

export default function Chat() {
  const navigate = useNavigate();
  const [sidebarTab, setSidebarTab] = React.useState<"sessions" | "friends">("sessions");
  const [contactListTab, setContactListTab] = React.useState<"friends" | "groups">("friends");
  const [sidebarQuery, setSidebarQuery] = React.useState("");
  const [friendQuery, setFriendQuery] = React.useState("");
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeId, setActiveId] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [messagesById, setMessagesById] = React.useState<Record<string, ChatMessage[]>>(seedMessages);
  const [isMobile, setIsMobile] = React.useState(false);
  const [mobileStage, setMobileStage] = React.useState<"list" | "chat">("list");
  const [userInfo, setUserInfo] = React.useState<UserInfo | null>(null);
  const [searchResult, setSearchResult] = React.useState<SearchUserInfo | null>(null);
  const [isSearchingUser, setIsSearchingUser] = React.useState(false);
  const [selectedUserForDetails, setSelectedUserForDetails] = React.useState<SearchUserInfo | null>(null);
  const [isApplying, setIsApplying] = React.useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = React.useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = React.useState(false);
  const [friendApplies, setFriendApplies] = React.useState<FriendApplyItem[]>([]);
  const [isLoadingApplies, setIsLoadingApplies] = React.useState(false);
  const [processingApplyId, setProcessingApplyId] = React.useState<number | null>(null);
  const [isAddFriendOpen, setIsAddFriendOpen] = React.useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = React.useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = React.useState(false);
  const [friends, setFriends] = React.useState<SearchUserInfo[]>([]);
  const [groups, setGroups] = React.useState<GroupInfo[]>([]);
  const [groupFriends, setGroupFriends] = React.useState<SearchUserInfo[]>([]);
  const [isSearchingFriends, setIsSearchingFriends] = React.useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = React.useState(false);
  const [isLoadingGroupFriends, setIsLoadingGroupFriends] = React.useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = React.useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = React.useState(0);
  const [momentRedPoint, setMomentRedPoint] = React.useState(false);
  const [typingStatus, setTypingStatus] = React.useState("");
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const [groupName, setGroupName] = React.useState("");
  const [groupMemberQuery, setGroupMemberQuery] = React.useState("");
  const [selectedGroupUserIds, setSelectedGroupUserIds] = React.useState<string[]>([]);
  const [isWsConnected, setIsWsConnected] = React.useState(false);
  const toastTimerRef = React.useRef<number | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const heartbeatTimeoutRef = React.useRef<number | null>(null);
  const reconnectTimerRef = React.useRef<number | null>(null);
  const reconnectAttemptsRef = React.useRef<number>(0);
  const isIntentionalCloseRef = React.useRef<boolean>(false);
  const sessionsRequestIdRef = React.useRef(0);
  const unreadRefreshTimerRef = React.useRef<number | null>(null);
  const activeIdRef = React.useRef(activeId);
  const messageRequestIdRef = React.useRef(0);
  const initialHistoryLoadedRef = React.useRef(false);
  const conversationRefreshTimerRef = React.useRef<number | null>(null);
  const previousActiveIdRef = React.useRef("");
  const fetchSessionsRef = React.useRef<(selectUser?: string, options?: { silent?: boolean }) => void | Promise<void>>(() => {});
  const refreshUnreadMessageCountRef = React.useRef<() => void | Promise<void>>(() => {});
  const updateConversationLocallyRef = React.useRef<(mess: any, conversationId: string, isActiveConversation: boolean) => void>(() => {});

  const activeMessages = messagesById[activeId] ?? [];
  const activeConversation = conversations.find((c) => c.id === activeId);
  const activeFriend = friends.find((f) => f.userId === activeId);
  const activeGroup = groups.find((g) => g.groupId === activeId);
  const isActiveGroupConversation = Boolean(activeGroup);
  const currentUserId = userInfo?.userId || userInfo?.id || "";
  const activeChatTitle = activeFriend?.userName || activeFriend?.mobile || activeGroup?.groupName || activeConversation?.title || "会话";

  const meDisplayName = userInfo?.userName || userInfo?.mobile || "我";
  const mePhoto = userInfo?.photo ?? null;
  const peerDisplayName = activeFriend?.userName || activeFriend?.mobile || activeGroup?.groupName || activeConversation?.title || "对方";
  const peerPhoto = activeFriend?.photo || (isActiveGroupConversation ? null : activeConversation?.photo) || null;

  const buildPhotoSrc = (photo: string | null | undefined) => {
    if (!photo) return null;
    if (photo.startsWith("http")) return photo;
    const base = import.meta.env.VITE_API_BASE_URL || "";
    return `${base}${photo.startsWith("/") ? "" : "/"}${photo}`;
  };

  const getIncomingConversationId = React.useCallback((mess: any) => {
    if (mess?.groupMessage) {
      return String(mess?.receiverId ?? mess?.groupId ?? mess?.receiver?.groupId ?? "");
    }
    return String(mess?.sender?.userId ?? mess?.senderId ?? "");
  }, []);

  React.useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const showToast = React.useCallback((variant: ToastState["variant"], message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ variant, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2200);
  }, []);

  React.useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await getCurrentUserInfo();
        if (res.success && res.data) {
          setUserInfo(res.data);
        }
      } catch (err: any) {
        console.error("获取当前用户信息失败", err);
        if (err.code === 101400 || err.response?.data?.code === 101400) {
          navigate("/", { replace: true });
        }
      }
    };
    fetchUser();
  }, [navigate]);

  React.useEffect(() => {
    const behavior = previousActiveIdRef.current === activeId ? "smooth" : "auto";
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    previousActiveIdRef.current = activeId;
  }, [activeId, activeMessages.length]);

  React.useEffect(() => {
    if (!userInfo) return;
    const uid = userInfo.userId || userInfo.id;
    if (!uid) return;

    let heartbeatTimer: number;

    const connectWs = () => {
      // 如果已经有连接，先标记为主动断开，再清理
      if (wsRef.current) {
        // 防止旧的连接触发 onclose 重连
        wsRef.current.onclose = null;
        wsRef.current.close();
      }

      // 优先使用当前域名的相对路径走 Vite Proxy 代理，规避跨域断连问题
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsUrl = `${protocol}//${window.location.host}/ws/chat/${uid}`;

      // 如果是生产环境且配置了 VITE_API_BASE_URL，才使用绝对路径直连
      if (import.meta.env.PROD && import.meta.env.VITE_API_BASE_URL) {
        wsUrl = import.meta.env.VITE_API_BASE_URL.replace(/^http/, "ws") + `/ws/chat/${uid}`;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("已经连通了websocket");
        setIsWsConnected(true);
        // 连接成功后重置重试次数
        reconnectAttemptsRef.current = 0;
        
        // 每次重新连接成功后，清理之前的定时器，防止泄漏
        if (heartbeatTimer) {
          window.clearInterval(heartbeatTimer);
        }
        
        // 建立连接后，每 25 秒发送一次心跳保活
        heartbeatTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("heartbeat");
            console.log("heartbeat");
            
            // 如果超过 10 秒没有收到后端的 ok 回应，则认为连接已断开（离线）
            if (heartbeatTimeoutRef.current) {
              window.clearTimeout(heartbeatTimeoutRef.current);
            }
            heartbeatTimeoutRef.current = window.setTimeout(() => {
              console.log("心跳响应超时，更新为 OFFLINE 状态并尝试重连");
              setIsWsConnected(false);
              ws.close(); // 主动断开当前无响应的连接，触发 onclose 进入重连流程
            }, 10000);
          }
        }, 25000);
      };

      ws.onmessage = (evt) => {
        const data = evt.data;
        if (data === "ok") {
          if (heartbeatTimeoutRef.current) {
            window.clearTimeout(heartbeatTimeoutRef.current);
            heartbeatTimeoutRef.current = null;
          }
          if (!isWsConnected) {
             setIsWsConnected(true);
          }
          return;
        }

        try {
          const mess = JSON.parse(data);
          if (mess?.momentMessage) {
            setMomentRedPoint(true);
          } else if (mess?.videoOffer || mess?.rejectVideoOffer) {
            showToast("info", mess?.rejectVideoOffer ? "对方已取消音视频邀请" : "收到音视频邀请");
          } else if (mess?.type === 5) {
            console.log("收到APPLY好友申请消息:", mess);
            tiks.notify();
            setUnreadNotificationCount(prev => prev + 1);
            showToast("success", "收到新的好友申请");
          } else if (mess?.type === 100 || mess?.type === 101) {
            setTypingStatus(mess.type === 100 ? "对方正在输入..." : "");
          } else {
            if (mess?.type === 1) {
              console.log("收到 TEXT 消息(type=1):", mess);
            }
            const conversationId = getIncomingConversationId(mess);
            const currentActiveId = activeIdRef.current;
            const isActiveConversation = Boolean(conversationId && currentActiveId === conversationId);
            if (conversationId && currentActiveId === conversationId) {
              const now = new Date();
              const text = mess?.type === 1 ? String(mess?.message ?? "") : `[${String(mess?.type ?? "unknown")}]`;
              const actualSender = mess?.groupMessage ? (mess?.proxySender ?? mess?.sender) : mess?.sender;
              const actualSenderId = String(
                mess?.groupMessage
                  ? (mess?.proxySenderId ?? mess?.proxySender?.userId ?? mess?.senderId ?? "")
                  : (mess?.sender?.userId ?? mess?.senderId ?? "")
              );
              const msg: ChatMessage = {
                id: `${now.getTime()}`,
                role: actualSenderId === currentUserId ? "me" : "them",
                text,
                time: formatMessageTime(now),
                timestamp: now.getTime(),
                senderDisplayName: actualSender?.userName || actualSender?.mobile || undefined,
                senderPhoto: typeof actualSender?.photo === "string" ? actualSender.photo : null,
              };
              setMessagesById((prev) => ({ ...prev, [conversationId]: [...(prev[conversationId] ?? []), msg] }));
            }
            if (conversationId) {
              updateConversationLocallyRef.current(mess, conversationId, isActiveConversation);
            }
          }

          if (unreadRefreshTimerRef.current) {
            window.clearTimeout(unreadRefreshTimerRef.current);
          }
          unreadRefreshTimerRef.current = window.setTimeout(() => {
            fetchSessionsRef.current(undefined, { silent: true });
            refreshUnreadMessageCountRef.current();
          }, 1000);
        } catch (err) {
          console.error("解析 WebSocket 消息失败", err);
        }
      };

      ws.onclose = () => {
        if (heartbeatTimer) {
          window.clearInterval(heartbeatTimer);
        }
        if (heartbeatTimeoutRef.current) {
          window.clearTimeout(heartbeatTimeoutRef.current);
        }
        setIsWsConnected(false);
        
        // 如果是主动断开（如退出登录或组件卸载），则不再重连
        if (isIntentionalCloseRef.current) {
          return;
        }

        // 只有当这是当前正在被引用的 WebSocket 对象时才触发重连
        // 避免因为快速刷新/多次调用导致旧的连接触发重连
        if (wsRef.current !== ws) {
          return;
        }

        // 指数退避重连机制
        // 基础等待时间 1000ms，每次失败等待时间翻倍
        const baseDelay = 1000;
        // 最大等待时间 30000ms (30秒)
        const maxDelay = 30000;
        
        // 计算当前延迟时间：1s, 2s, 4s, 8s, 16s, 30s...
        let delay = baseDelay * Math.pow(2, reconnectAttemptsRef.current);
        if (delay > maxDelay) {
          delay = maxDelay;
        }

        console.log(`WebSocket 连接已断开，${delay / 1000} 秒后尝试第 ${reconnectAttemptsRef.current + 1} 次重连...`);
        
        if (reconnectTimerRef.current) {
          window.clearTimeout(reconnectTimerRef.current);
        }
        
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connectWs();
        }, delay);
      };
      
      ws.onerror = (err) => {
        console.error("WebSocket 发生错误:", err);
        // onerror 发生后通常会紧接着触发 onclose，由 onclose 统一处理重连
      };
    };

    // 初始连接
    isIntentionalCloseRef.current = false;
    connectWs();

    return () => {
      // 组件卸载时标记为主动关闭，防止重连
      isIntentionalCloseRef.current = true;
      
      if (heartbeatTimer) {
        window.clearInterval(heartbeatTimer);
      }
      if (heartbeatTimeoutRef.current) {
        window.clearTimeout(heartbeatTimeoutRef.current);
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (unreadRefreshTimerRef.current) {
        window.clearTimeout(unreadRefreshTimerRef.current);
      }
      if (conversationRefreshTimerRef.current) {
        window.clearTimeout(conversationRefreshTimerRef.current);
      }
      
      setIsWsConnected(false);
      if (wsRef.current) {
        // 主动断开当前连接
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [getIncomingConversationId, showToast, userInfo]);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", update);
    return () => {
      mq.removeEventListener("change", update);
    };
  }, []);

  React.useEffect(() => {
    if (isMobile) setMobileStage("list");
  }, [isMobile]);

  React.useEffect(() => {
    if (!isAddFriendOpen) return;
    const q = friendQuery.trim();
    if (!q) {
      setSearchResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingUser(true);
      try {
        const res = await searchUserByMobile(q);
        if (res.success && res.data) {
          tiks.success();
          setSearchResult(res.data);
        } else {
          setSearchResult(null);
        }
      } catch (err) {
        setSearchResult(null);
      } finally {
        setIsSearchingUser(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [friendQuery, isAddFriendOpen]);

  const parseFriendUsers = React.useCallback((list: any[]) => {
    const seen = new Set<string>();
    return (Array.isArray(list) ? list : [])
      .map((item: any) => item.applyUser || item.friendUser || item)
      .filter((item: any) => {
        const id = String(item?.userId ?? item?.id ?? "");
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
  }, []);

  const fetchFriends = React.useCallback(async () => {
    if (!userInfo) return;
    setIsSearchingFriends(true);
    try {
      const res = await listFriendUsers(sidebarQuery.trim());
      if (res.success && res.data) {
        setFriends(parseFriendUsers(res.data));
      } else {
        setFriends([]);
      }
    } catch (err) {
      console.error("获取好友列表失败", err);
      setFriends([]);
    } finally {
      setIsSearchingFriends(false);
    }
  }, [userInfo, sidebarQuery, parseFriendUsers]);

  React.useEffect(() => {
    const timer = setTimeout(fetchFriends, 300);
    return () => clearTimeout(timer);
  }, [fetchFriends]);

  const fetchGroups = React.useCallback(async () => {
    if (!userInfo) return;
    setIsLoadingGroups(true);
    try {
      const res = await listGroups();
      if (res.success && Array.isArray(res.data)) {
        const keyword = sidebarQuery.trim().toLowerCase();
        const nextGroups = !keyword
          ? res.data
          : res.data.filter((group) => {
              const name = String(group.groupName ?? "").toLowerCase();
              const count = String(group.userCount ?? "");
              const groupId = String(group.groupId ?? "").toLowerCase();
              return name.includes(keyword) || count.includes(keyword) || groupId.includes(keyword);
            });
        setGroups(nextGroups);
      } else {
        setGroups([]);
      }
    } catch (err) {
      console.error("获取群组列表失败", err);
      setGroups([]);
    } finally {
      setIsLoadingGroups(false);
    }
  }, [sidebarQuery, userInfo]);

  React.useEffect(() => {
    const timer = setTimeout(fetchGroups, 300);
    return () => clearTimeout(timer);
  }, [fetchGroups]);

  const refreshUnreadMessageCount = React.useCallback(async () => {
    if (!userInfo) return;
    try {
      const res = await countUnreadMessageUsers();
      if (res.success && typeof res.data === "number") {
        console.log("unReadUserCount:", res.data);
        setUnreadMessageCount(res.data);
      }
    } catch (err: any) {
      console.error("unReadUserCount 请求失败:", err?.response?.data ?? err);
    }
  }, [userInfo]);

  React.useEffect(() => {
    refreshUnreadMessageCountRef.current = refreshUnreadMessageCount;
  }, [refreshUnreadMessageCount]);

  const fetchChatHistory = React.useCallback(
    async (chatUserId: string) => {
      if (!userInfo || !chatUserId) return;
      const currentUserId = userInfo.userId || userInfo.id;
      if (!currentUserId) return;

      const requestId = (messageRequestIdRef.current += 1);
      setIsLoadingHistory(true);
      try {
        const res = await queryChatMessages(chatUserId, 50);
        if (requestId !== messageRequestIdRef.current) return;
        const list = Array.isArray(res.data) ? res.data : [];
        const nextMessages: ChatMessage[] = list
          .slice()
          .sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
          .map((item) => {
            const isGroupMessage = Boolean(item.groupMessage);
            const actualSender = isGroupMessage ? (item.proxySender ?? item.sender) : item.sender;
            const actualSenderId = String(
              isGroupMessage
                ? (item.proxySenderId ?? item.proxySender?.userId ?? item.senderId ?? "")
                : (item.senderId ?? item.sender?.userId ?? "")
            );

            return {
              id: String(item.messageId ?? `${item.senderId}-${item.time}`),
              role: actualSenderId === currentUserId ? "me" : "them",
              text: item.printMessage || item.message || (item.type === 1 ? "" : `[${item.type}]`),
              time: typeof item.time === "number" ? formatMessageTime(new Date(item.time)) : "",
              timestamp: typeof item.time === "number" ? item.time : null,
              senderDisplayName: actualSender?.userName || actualSender?.mobile || undefined,
              senderPhoto: typeof actualSender?.photo === "string" ? actualSender.photo : null,
            };
          });
        setMessagesById((prev) => ({ ...prev, [chatUserId]: nextMessages }));
      } catch (err) {
        console.error("获取聊天记录失败", err);
      } finally {
        if (requestId === messageRequestIdRef.current) {
          setIsLoadingHistory(false);
        }
      }
    },
    [userInfo]
  );

  const normalizeConversation = React.useCallback((item: any): Conversation => {
    const rawId = item?.groupId ?? item?.receiverId ?? item?.id ?? item?.userId;
    const candidateId = rawId == null ? "" : String(rawId);
    const isKnownGroup = Boolean(candidateId && groups.some((group) => group.groupId === candidateId));
    const isGroup = Boolean(item?.groupId || item?.groupMessage || item?.groupName || isKnownGroup);
    const user = item?.user ?? item?.friendUser ?? item?.applyUser ?? item;
    const id = String(isGroup ? (item?.groupId ?? item?.receiverId ?? item?.id ?? "") : (user?.userId ?? item?.userId ?? item?.id ?? ""));
    const title = String(isGroup ? (item?.groupName ?? item?.title ?? id) : (user?.userName ?? user?.mobile ?? item?.title ?? id));
    const subtitle = String(item?.lastMessage ?? item?.message ?? (isGroup ? "暂无聊天记录" : user?.signature ?? ""));
    const rawTime = item?.time ?? item?.lastTime ?? item?.updateTime;
    const time = typeof rawTime === "number" ? formatTime(new Date(rawTime)) : String(rawTime ?? "");
    const hasUnread = Boolean(item?.unReadMess ?? item?.hasUnread ?? item?.unread);
    const photo = isGroup ? null : (typeof user?.photo === "string" ? user.photo : null);
    const online = user?.online ?? item?.online;
    return {
      id,
      title,
      subtitle,
      time,
      hasUnread,
      photo,
      online: typeof online === "boolean" ? online : undefined,
    };
  }, [groups]);

  const buildFallbackConversation = React.useCallback((targetId: string): Conversation | null => {
    if (!targetId) return null;
    const friend = friends.find((f) => f.userId === targetId);
    const group = groups.find((g) => g.groupId === targetId);

    if (!friend && !group) return null;

    return {
      id: targetId,
      title: friend?.userName || friend?.mobile || group?.groupName || targetId,
      subtitle: friend?.signature || (group ? "暂无聊天记录" : ""),
      time: "",
      photo: friend?.photo ?? null,
      hasUnread: false,
    };
  }, [friends, groups]);

  const updateConversationLocally = React.useCallback((mess: any, conversationId: string, isActiveConversation: boolean) => {
    if (!conversationId) return;

    const actualSender = mess?.groupMessage ? (mess?.proxySender ?? mess?.sender) : mess?.sender;
    const messageText = mess?.type === 1
      ? String(mess?.printMessage ?? mess?.message ?? "")
      : `[${String(mess?.type ?? "unknown")}]`;
    const nextTime = formatTime(new Date());
    const fallbackConversation = buildFallbackConversation(conversationId);

    let shouldIncreaseUnread = false;

    setConversations((prev) => {
      const current = prev.find((item) => item.id === conversationId) ?? fallbackConversation;
      if (!current) return prev;

      const remaining = prev.filter((item) => item.id !== conversationId);
      const nextConversation: Conversation = {
        ...current,
        title: current.title || actualSender?.userName || actualSender?.mobile || conversationId,
        subtitle: messageText || current.subtitle,
        time: nextTime,
        hasUnread: isActiveConversation ? false : true,
        unread: typeof current.unread === "number"
          ? (isActiveConversation ? 0 : Math.max(1, current.unread + 1))
          : current.unread,
      };

      if (!isActiveConversation && !current.hasUnread && !(typeof current.unread === "number" && current.unread > 0)) {
        shouldIncreaseUnread = true;
      }

      return [nextConversation, ...remaining];
    });

    if (shouldIncreaseUnread) {
      setUnreadMessageCount((prev) => prev + 1);
    }
  }, [buildFallbackConversation]);

  React.useEffect(() => {
    updateConversationLocallyRef.current = updateConversationLocally;
  }, [updateConversationLocally]);

  const fetchSessions = React.useCallback(
    async (selectUser?: string, options?: { silent?: boolean }) => {
      if (!userInfo) return;
      const requestId = (sessionsRequestIdRef.current += 1);
      if (!options?.silent) {
        setIsLoadingSessions(true);
      }
      try {
        const res = await listChatMessageUsers(selectUser);
        if (requestId !== sessionsRequestIdRef.current) return;

        const list = Array.isArray(res.data) ? res.data : [];
        let next = list.map(normalizeConversation).filter((c) => c.id);
        const targetConversationId = selectUser || activeIdRef.current;

        if (targetConversationId && !next.some((c) => c.id === targetConversationId)) {
          const fallbackConversation = buildFallbackConversation(targetConversationId);
          if (fallbackConversation) {
            next = [fallbackConversation, ...next];
          }
        }

        setConversations((prev) => (isSameConversationList(prev, next) ? prev : next));
        if (selectUser) {
          setActiveId(selectUser);
        } else {
          setActiveId((prev) => prev || next[0]?.id || "");
        }
      } catch (err: any) {
        if (requestId !== sessionsRequestIdRef.current) return;
        console.error("获取会话列表失败", err);
        showToast("error", err?.response?.data?.msg || err?.message || "获取会话列表失败");
        if (!options?.silent) {
          setConversations([]);
        }
      } finally {
        if (requestId === sessionsRequestIdRef.current && !options?.silent) {
          setIsLoadingSessions(false);
        }
      }
    },
    [buildFallbackConversation, normalizeConversation, showToast, userInfo]
  );

  React.useEffect(() => {
    fetchSessionsRef.current = fetchSessions;
  }, [fetchSessions]);

  React.useEffect(() => {
    if (!userInfo) return;
    fetchSessions();
  }, [fetchSessions, userInfo]);

  React.useEffect(() => {
    if (!userInfo) return;
    refreshUnreadMessageCount();
  }, [refreshUnreadMessageCount, userInfo]);

  React.useEffect(() => {
    initialHistoryLoadedRef.current = false;
  }, [userInfo?.userId, userInfo?.id]);

  React.useEffect(() => {
    if (!userInfo || !activeId || initialHistoryLoadedRef.current) return;
    initialHistoryLoadedRef.current = true;
    fetchChatHistory(activeId);
  }, [activeId, fetchChatHistory, userInfo]);

  React.useEffect(() => {
    if (!userInfo) return;
    const checkUnreadApplies = async () => {
      try {
        const res = await countUnhandledFriendApplies();
        if (res.success && typeof res.data === 'number') {
          setUnreadNotificationCount(res.data);
        }
      } catch (err) {
        console.error("获取未处理好友申请数失败", err);
      }
    };
    checkUnreadApplies();
  }, [userInfo]);

  const filtered = React.useMemo(() => {
    return conversations;
  }, [conversations]);

  const filteredFriends = React.useMemo(() => {
    const keyword = sidebarQuery.trim().toLowerCase();
    if (!keyword) return friends;
    return friends.filter((friend) => {
      const name = String(friend.userName ?? "").toLowerCase();
      const mobile = String(friend.mobile ?? "").toLowerCase();
      const signature = String(friend.signature ?? "").toLowerCase();
      return name.includes(keyword) || mobile.includes(keyword) || signature.includes(keyword);
    });
  }, [friends, sidebarQuery]);

  const filteredGroupFriends = React.useMemo(() => {
    const keyword = groupMemberQuery.trim().toLowerCase();
    return groupFriends.filter((friend) => {
      const id = String(friend.userId ?? "");
      if (!id || id === currentUserId) return false;
      if (!keyword) return true;
      const name = String(friend.userName ?? "").toLowerCase();
      const mobile = String(friend.mobile ?? "").toLowerCase();
      const signature = String(friend.signature ?? "").toLowerCase();
      return name.includes(keyword) || mobile.includes(keyword) || signature.includes(keyword);
    });
  }, [currentUserId, groupFriends, groupMemberQuery]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !userInfo || !activeId) return;
    const now = new Date();
    const msg: ChatMessage = {
      id: `${now.getTime()}`,
      role: "me",
      text,
      time: formatMessageTime(now),
      timestamp: now.getTime(),
    };
    setMessagesById((prev) => ({ ...prev, [activeId]: [...(prev[activeId] ?? []), msg] }));
    setDraft("");
    tiks.pop();

    const senderId = userInfo.userId || userInfo.id;
    if (!senderId) return;

    // 2. 即时通知：通过 websocket 发送消息到后端
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const wsData = JSON.stringify({
        receiverId: activeId,
        type: 1,
        senderId: senderId,
        message: text
      });
      wsRef.current.send(wsData);
    } else {
      console.warn("WebSocket 未连接，无法发送即时通知");
    }

    // 3. 消息落库：调用 api/chat/message/send 接口
    try {
      const res = await sendMessage({
        senderId: senderId,
        receiverId: activeId,
        message: text,
        type: 1
      });
      if (!res.success) {
        console.error("消息发送落库失败", res.msg);
        showToast("error", res.msg || "消息发送失败");
      }
    } catch (err: any) {
      console.error("消息发送落库异常", err);
      showToast("error", err?.response?.data?.msg || err?.message || "网络异常，消息发送失败");
    }
  };

  const openConversation = React.useCallback((id: string, options?: { skipPostRefresh?: boolean }) => {
    setActiveId(id);
    if (isMobile) setMobileStage("chat");
    void fetchChatHistory(id);
    if (options?.skipPostRefresh) return;
    if (conversationRefreshTimerRef.current) {
      window.clearTimeout(conversationRefreshTimerRef.current);
    }
    conversationRefreshTimerRef.current = window.setTimeout(() => {
      fetchSessions(undefined, { silent: true });
      refreshUnreadMessageCount();
    }, 500);
  }, [fetchChatHistory, fetchSessions, isMobile, refreshUnreadMessageCount]);

  const switchToSessions = React.useCallback(
    (selectUser?: string) => {
      setSidebarTab("sessions");
      tiks.click();
      fetchSessions(selectUser);
      refreshUnreadMessageCount();
    },
    [fetchSessions, refreshUnreadMessageCount]
  );

  const startConversationFromFriend = React.useCallback(
    (friendId: string) => {
      switchToSessions(friendId);
      openConversation(friendId, { skipPostRefresh: true });
    },
    [openConversation, switchToSessions]
  );

  const startConversationFromGroup = React.useCallback(
    (groupId: string) => {
      switchToSessions(groupId);
      openConversation(groupId, { skipPostRefresh: true });
    },
    [openConversation, switchToSessions]
  );

  const openAddFriend = () => {
    setFriendQuery("");
    setSearchResult(null);
    setIsSearchingUser(false);
    setSelectedUserForDetails(null);
    setIsAddFriendOpen(true);
  };

  const closeCreateGroupModal = React.useCallback(() => {
    if (isCreatingGroup) return;
    setIsCreateGroupOpen(false);
    setGroupName("");
    setGroupMemberQuery("");
    setSelectedGroupUserIds([]);
  }, [isCreatingGroup]);

  const openCreateGroupModal = React.useCallback(async () => {
    setGroupName("");
    setGroupMemberQuery("");
    setSelectedGroupUserIds([]);
    setGroupFriends([]);
    setIsCreateGroupOpen(true);
    setIsLoadingGroupFriends(true);
    try {
      const res = await listFriendUsers("");
      if (res.success && res.data) {
        setGroupFriends(parseFriendUsers(res.data));
      } else {
        setGroupFriends([]);
      }
    } catch (err) {
      console.error("获取建群好友列表失败", err);
      setGroupFriends([]);
      showToast("error", "获取好友列表失败");
    } finally {
      setIsLoadingGroupFriends(false);
    }
  }, [parseFriendUsers, showToast]);

  const toggleGroupMember = React.useCallback((userId: string) => {
    setSelectedGroupUserIds((prev) => (
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    ));
  }, []);

  const handleCreateGroup = React.useCallback(async () => {
    const trimmedName = groupName.trim();
    if (!currentUserId) {
      showToast("error", "未获取到当前登录用户");
      return;
    }
    if (!trimmedName) {
      showToast("error", "请输入群名称");
      return;
    }
    if (selectedGroupUserIds.length < 2) {
      showToast("error", "请至少选择 2 位好友");
      return;
    }

    setIsCreatingGroup(true);
    try {
      const res = await createChatGroup({
        groupName: trimmedName,
        userIds: selectedGroupUserIds,
        createUserId: currentUserId,
      });
      if (res.success) {
        tiks.success();
        closeCreateGroupModal();
        setSidebarTab("sessions");
        await fetchGroups();
        await fetchSessions();
        refreshUnreadMessageCount();
        showToast("success", "群组创建成功");
      } else {
        tiks.error();
        showToast("error", res.msg || "创建群组失败");
      }
    } catch (err: any) {
      console.error("创建群组失败", err);
      tiks.error();
      showToast("error", err?.response?.data?.msg || err?.message || "创建群组失败，请稍后重试");
    } finally {
      setIsCreatingGroup(false);
    }
  }, [closeCreateGroupModal, currentUserId, fetchGroups, fetchSessions, groupName, refreshUnreadMessageCount, selectedGroupUserIds, showToast]);

  const handleLogout = async () => {
    try {
      const res = await logoutUser();
      if (res.success) {
        showToast("success", "已成功退出登录");
      } else {
        showToast("error", res.msg || "退出登录失败");
      }
    } catch (err: any) {
      console.error("登出请求失败", err);
      showToast("error", err?.response?.data?.msg || err?.message || "登出失败，请稍后重试");
    } finally {
      // 稍微延迟一下跳转，让用户能看到 toast 提示
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 800);
    }
  };

  const openNotifications = async () => {
    setIsNotificationOpen(true);
    setIsLoadingApplies(true);
    try {
      const res = await getUnhandledFriendApplies();
      if (res.success && res.data) {
        setFriendApplies(res.data);
        // 方案一容错：拉取到列表后，用实际未处理列表的长度校准红点数字
        setUnreadNotificationCount(res.data.length);
      } else {
        setFriendApplies([]);
        setUnreadNotificationCount(0);
      }
    } catch (err) {
      console.error("获取通知失败", err);
      showToast("error", "获取通知列表失败");
    } finally {
      setIsLoadingApplies(false);
    }
  };

  const handleApplyAction = async (applyId: number, action: 'pass' | 'refuse') => {
    setProcessingApplyId(applyId);
    try {
      const res = action === 'pass' ? await passFriendApply(applyId) : await refuseFriendApply(applyId);
      if (res.success && res.data) {
        tiks.success();
        showToast("success", action === 'pass' ? "已同意好友申请" : "已拒绝好友申请");
        // 方案一更新：处理完成后，将该项从列表中移除，同时红点数字减1
        setFriendApplies(prev => prev.filter(item => item.applyId !== applyId));
        setUnreadNotificationCount(prev => Math.max(0, prev - 1));
        
        // 如果是通过好友申请，则刷新好友列表
        if (action === 'pass') {
          fetchFriends();
        }
      } else {
        tiks.error();
        showToast("error", res.msg || "处理失败，请重试");
      }
    } catch (err: any) {
      console.error("处理好友申请失败", err);
      tiks.error();
      showToast("error", err?.response?.data?.msg || err?.message || "请求出错，请稍后再试");
    } finally {
      setProcessingApplyId(null);
    }
  };

  const renderSidebarList = (isMobileView: boolean) => {
    if (sidebarTab === 'sessions') {
      if (isLoadingSessions) {
        return (
          <div className="px-4 py-6 text-[11px] font-mono text-zinc-400 text-center flex items-center justify-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-zinc-300 border-t-zinc-800 animate-spin" />
            加载中...
          </div>
        );
      }
      const filteredConversations = conversations.filter(c => c.title.toLowerCase().includes(sidebarQuery.toLowerCase()) || c.subtitle.toLowerCase().includes(sidebarQuery.toLowerCase()));
      return (
        <>
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => {
              const active = conv.id === activeId;
              const isGroupConversation = groups.some((group) => group.groupId === conv.id);
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => openConversation(conv.id)}
                  className={`w-full text-left px-4 ${isMobileView ? "py-4" : "py-3"} border-b border-zinc-200 transition-colors ${
                    active ? "bg-white" : isMobileView ? "bg-transparent active:bg-white/60" : "bg-transparent hover:bg-white/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-zinc-100 border-[2px] border-zinc-900 overflow-hidden flex items-center justify-center shrink-0 shadow-[0_0_0_2px_rgba(255,255,255,1),0_0_0_3px_rgba(0,0,0,0.1)]">
                      {!isGroupConversation && conv.photo ? (
                        <img
                          src={conv.photo.startsWith('http') ? conv.photo : `${import.meta.env.VITE_API_BASE_URL || ''}${conv.photo.startsWith('/') ? '' : '/'}${conv.photo}`}
                          alt="avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="font-mono text-[16px] font-bold text-zinc-400">
                          {conv.title.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-mono text-[12px] font-bold text-zinc-900 truncate">
                          {conv.title}
                        </div>
                        <div className="font-mono text-[10px] text-zinc-400 shrink-0">
                          {conv.time}
                        </div>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <div className="font-mono text-[10px] text-zinc-500 truncate">
                          {conv.subtitle}
                        </div>
                        {typeof conv.unread === "number" ? (
                          conv.unread > 0 ? (
                            <div className="h-4 min-w-[16px] px-1 bg-red-500 rounded-full flex items-center justify-center font-mono text-[9px] font-bold text-white shrink-0">
                              {conv.unread}
                            </div>
                          ) : null
                        ) : conv.hasUnread ? (
                          <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="px-4 py-6 text-[11px] font-mono text-zinc-400 text-center">暂无会话</div>
          )}
        </>
      );
    }

    return (
      <>
        <div className="px-3 py-3 border-b border-zinc-200 bg-zinc-50/80 sticky top-0 z-[1]">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setContactListTab("friends")}
              className={`h-9 rounded-full border font-mono text-[11px] tracking-widest transition-colors ${
                contactListTab === "friends" ? "bg-white border-black text-black" : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400"
              }`}
            >
              联系人
            </button>
            <button
              type="button"
              onClick={() => setContactListTab("groups")}
              className={`h-9 rounded-full border font-mono text-[11px] tracking-widest transition-colors ${
                contactListTab === "groups" ? "bg-white border-black text-black" : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400"
              }`}
            >
              群组
            </button>
          </div>
        </div>

        {contactListTab === "friends" ? (
          isSearchingFriends ? (
            <div className="px-4 py-6 text-[11px] font-mono text-zinc-400 text-center flex items-center justify-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-zinc-300 border-t-zinc-800 animate-spin" />
              搜索中...
            </div>
          ) : filteredFriends.length > 0 ? (
            filteredFriends.map((friend) => {
              const active = friend.userId === activeId;
              return (
                <button
                  key={friend.userId}
                  type="button"
                  onClick={() => startConversationFromFriend(friend.userId)}
                  className={`w-full text-left px-4 ${isMobileView ? "py-4" : "py-3"} border-b border-zinc-200 transition-colors ${
                    active ? "bg-white" : isMobileView ? "bg-transparent active:bg-white/60" : "bg-transparent hover:bg-white/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-zinc-100 border-[2px] border-zinc-900 overflow-hidden flex items-center justify-center shrink-0 shadow-[0_0_0_2px_rgba(255,255,255,1),0_0_0_3px_rgba(0,0,0,0.1)]">
                      {friend.photo ? (
                        <img
                          src={friend.photo.startsWith('http') ? friend.photo : `${import.meta.env.VITE_API_BASE_URL || ''}${friend.photo.startsWith('/') ? '' : '/'}${friend.photo}`}
                          alt="avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="font-mono text-[16px] font-bold text-zinc-400">
                          {(friend.userName || friend.mobile || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-mono text-[12px] font-bold text-zinc-900 truncate">
                          {friend.userName || friend.mobile}
                        </div>
                        <div className={`w-2 h-2 rounded-full ${friend.id % 2 === 0 ? "bg-green-500" : "bg-zinc-300"} shrink-0`} />
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-zinc-500 truncate">
                        {friend.signature || "暂无签名"}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="px-4 py-6 text-[11px] font-mono text-zinc-400 text-center">暂无联系人</div>
          )
        ) : isLoadingGroups ? (
          <div className="px-4 py-6 text-[11px] font-mono text-zinc-400 text-center flex items-center justify-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-zinc-300 border-t-zinc-800 animate-spin" />
            加载群组中...
          </div>
        ) : groups.length > 0 ? (
          groups.map((group) => {
            const active = group.groupId === activeId;
            return (
              <button
                key={group.groupId}
                type="button"
                onClick={() => startConversationFromGroup(group.groupId)}
                className={`w-full text-left px-4 ${isMobileView ? "py-4" : "py-3"} border-b border-zinc-200 transition-colors ${
                  active ? "bg-white" : isMobileView ? "bg-transparent active:bg-white/60" : "bg-transparent hover:bg-white/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-zinc-100 border-[2px] border-zinc-900 overflow-hidden flex items-center justify-center shrink-0 shadow-[0_0_0_2px_rgba(255,255,255,1),0_0_0_3px_rgba(0,0,0,0.1)]">
                    <span className="font-mono text-[15px] font-bold text-zinc-500">
                      {(group.groupName || "群").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-[12px] font-bold text-zinc-900 truncate">
                        {group.groupName || group.groupId}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-400 shrink-0">
                        {group.userCount}人
                      </div>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-zinc-500 truncate">
                      暂无聊天记录
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="px-4 py-6 text-[11px] font-mono text-zinc-400 text-center">暂无群组</div>
        )}
      </>
    );
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white font-sans selection:bg-black selection:text-white animate-fade-in">
      <InteractiveBackground />

      {isMobile ? (
        <div className="relative z-10 w-full h-[100dvh] bg-white">
          <div className="w-full h-full bg-white border-y border-zinc-200 flex flex-col">
            {mobileStage === "list" ? (
              <div className="flex-1 flex min-h-0">
                <div className="w-[56px] bg-white border-r border-zinc-200 flex flex-col items-center py-4 gap-4 shrink-0">
                  <button
                    type="button"
                    className={`relative h-11 w-11 rounded-full border transition-colors flex items-center justify-center ${
                      sidebarTab === 'sessions' ? 'bg-zinc-100 border-black text-black' : 'border-zinc-200 bg-white hover:border-black text-zinc-700'
                    }`}
                    onClick={() => {
                      switchToSessions();
                    }}
                  >
                    <MessageSquare className="w-5 h-5" />
                    {unreadMessageCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-[1.5px] border-white text-[10px] font-bold text-white flex items-center justify-center">
                        {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    className={`relative h-11 w-11 rounded-full border transition-colors flex items-center justify-center ${
                      sidebarTab === 'friends' ? 'bg-zinc-100 border-black text-black' : 'border-zinc-200 bg-white hover:border-black text-zinc-700'
                    }`}
                    onClick={() => {
                      setSidebarTab('friends');
                      tiks.click();
                    }}
                  >
                    <Users className="w-5 h-5" />
                  </button>

                  <div className="w-8 h-[1px] bg-zinc-200 my-2" />

                  <button
                    type="button"
                    className="relative h-11 w-11 rounded-full border border-zinc-200 bg-white hover:border-black transition-colors flex items-center justify-center text-zinc-700"
                    onClick={openNotifications}
                  >
                    <Bell className="w-5 h-5" />
                    {unreadNotificationCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-[1.5px] border-white text-[10px] font-bold text-white flex items-center justify-center">
                        {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    className="h-11 w-11 rounded-full border border-zinc-200 bg-white hover:border-black transition-colors flex items-center justify-center text-zinc-700"
                    onClick={openAddFriend}
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>

                  <div className="flex-1" />

                  <button
                    type="button"
                    className="h-11 w-11 rounded-full border border-zinc-200 bg-white hover:border-black transition-colors flex items-center justify-center text-zinc-700"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                  <div className="px-4 py-4 border-b border-zinc-200 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-xs tracking-widest uppercase text-zinc-800 font-bold">Agent Chat</div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={openCreateGroupModal}
                        className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-full border border-zinc-200 bg-white hover:border-black transition-colors font-mono text-[11px] text-zinc-700"
                      >
                        <Users className="w-4 h-4" />
                        建群
                      </button>
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                          value={sidebarQuery}
                          onChange={(e) => setSidebarQuery(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 bg-white border border-zinc-200 rounded-full text-sm font-mono text-black placeholder-zinc-400 focus:outline-none focus:border-black transition-colors"
                          placeholder={sidebarTab === 'sessions' ? "搜索会话..." : contactListTab === "friends" ? "搜索联系人..." : "搜索群组..."}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-zinc-50">
                    {renderSidebarList(true)}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="h-[64px] px-3 border-b border-zinc-200 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-1 min-w-0">
                    <button
                      type="button"
                      className="h-10 w-10 rounded-full border border-zinc-200 bg-white hover:border-black transition-colors flex items-center justify-center text-zinc-800"
                      onClick={() => setMobileStage("list")}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0 pl-1 flex flex-col justify-center">
                      <div className="font-mono text-[15px] font-black tracking-wide text-zinc-900 truncate leading-tight">
                        {activeChatTitle}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="h-10 px-3 rounded-full border border-zinc-200 bg-white hover:border-black transition-colors inline-flex items-center gap-2 font-mono text-[11px] text-zinc-700"
                  >
                    <Info className="w-4 h-4" />
                    详情
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-5 bg-zinc-50">
                  <div className="space-y-4">
                    {isLoadingHistory && activeMessages.length === 0 ? (
                      <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                        <div className="w-5 h-5 rounded-full border-2 border-zinc-300 border-t-zinc-800 animate-spin" />
                        <span className="text-zinc-400 font-mono text-[11px]">加载聊天记录中...</span>
                      </div>
                    ) : activeMessages.map((m, index) => {
                      const mine = m.role === "me";
                      const displayName = m.senderDisplayName || (mine ? meDisplayName : peerDisplayName);
                      const photo = m.senderPhoto ?? (mine ? mePhoto : peerPhoto);
                      const photoSrc = buildPhotoSrc(photo);
                      const showTime = shouldShowMessageTime(activeMessages, index);
                      return (
                        <div key={m.id} className="w-full">
                          {showTime ? (
                            <div className="w-full flex justify-center">
                              <div className="px-3 py-1 rounded-full text-[11px] text-zinc-400 font-mono bg-white/70 border border-zinc-200">
                                {getMessageTimeLabel(m)}
                              </div>
                            </div>
                          ) : null}
                          <div className={`${showTime ? "mt-2" : ""} w-full flex ${mine ? "justify-end" : "justify-start"} gap-3`}>
                            {!mine ? (
                              <div className="h-10 w-10 rounded-full bg-zinc-100 border-[2px] border-zinc-900 overflow-hidden flex items-center justify-center shrink-0 shadow-[0_0_0_2px_rgba(255,255,255,1),0_0_0_3px_rgba(0,0,0,0.1)]">
                                {photoSrc ? (
                                  <img src={photoSrc} alt="avatar" className="h-full w-full object-cover" />
                                ) : (
                                  <span className="font-mono text-[13px] font-bold text-zinc-500">
                                    {displayName.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                            ) : null}
                            <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                              <div className="text-[12px] text-zinc-400 font-mono leading-none">
                                {displayName}
                              </div>
                              <div
                                className={`mt-1 relative rounded-lg px-4 py-2.5 text-[15px] leading-relaxed ${
                                  mine
                                    ? "bg-[#07C160] text-white"
                                    : "bg-white text-zinc-900"
                                } ${
                                  mine
                                    ? "before:content-[''] before:absolute before:right-[-4px] before:top-[12px] before:w-2 before:h-2 before:bg-[#07C160] before:rotate-45"
                                    : "before:content-[''] before:absolute before:left-[-4px] before:top-[12px] before:w-2 before:h-2 before:bg-white before:rotate-45"
                                }`}
                              >
                                {m.text}
                              </div>
                            </div>
                            {mine ? (
                              <div className="h-10 w-10 rounded-full bg-zinc-100 border-[2px] border-zinc-900 overflow-hidden flex items-center justify-center shrink-0 shadow-[0_0_0_2px_rgba(255,255,255,1),0_0_0_3px_rgba(0,0,0,0.1)]">
                                {photoSrc ? (
                                  <img src={photoSrc} alt="avatar" className="h-full w-full object-cover" />
                                ) : (
                                  <span className="font-mono text-[13px] font-bold text-zinc-500">
                                    {displayName.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                </div>

                <div className="border-t border-zinc-200 px-3 py-3 bg-white">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-11 w-11 rounded-full border border-zinc-200 bg-white hover:border-black transition-colors flex items-center justify-center text-zinc-700"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <div className="flex-1">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                        className="w-full resize-none bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 font-mono text-[13px] text-black placeholder-zinc-400 focus:outline-none focus:border-black transition-colors h-11 leading-[22px]"
                        placeholder="输入消息..."
                        rows={1}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={send}
                      disabled={!draft.trim()}
                      className="h-11 px-4 rounded-full bg-black text-white font-mono text-[12px] tracking-widest uppercase hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      发送
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 py-10">
          <div className="w-full h-[780px] bg-white rounded-2xl border border-zinc-200 shadow-[0_30px_90px_rgba(0,0,0,0.14)] overflow-hidden flex">
            <div className="w-[64px] bg-white border-r border-zinc-200 flex flex-col items-center py-5 gap-4 shrink-0">
              <button
                type="button"
                className={`relative h-11 w-11 rounded-full border transition-colors flex items-center justify-center ${
                  sidebarTab === 'sessions' ? 'bg-zinc-100 border-black text-black' : 'border-zinc-200 bg-white hover:border-black text-zinc-700'
                }`}
                onClick={() => {
                  switchToSessions();
                }}
              >
                <MessageSquare className="w-5 h-5" />
                {unreadMessageCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-[1.5px] border-white text-[10px] font-bold text-white flex items-center justify-center">
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`relative h-11 w-11 rounded-full border transition-colors flex items-center justify-center ${
                  sidebarTab === 'friends' ? 'bg-zinc-100 border-black text-black' : 'border-zinc-200 bg-white hover:border-black text-zinc-700'
                }`}
                onClick={() => {
                  setSidebarTab('friends');
                  tiks.click();
                }}
              >
                <Users className="w-5 h-5" />
              </button>

              <div className="w-8 h-[1px] bg-zinc-200 my-2" />

              <button
                type="button"
                className="relative h-11 w-11 rounded-full border border-zinc-200 bg-white hover:border-black transition-colors flex items-center justify-center text-zinc-700"
                onClick={openNotifications}
              >
                <Bell className="w-5 h-5" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-[1.5px] border-white text-[10px] font-bold text-white flex items-center justify-center">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                className="h-11 w-11 rounded-full border border-zinc-200 bg-white hover:border-black transition-colors flex items-center justify-center text-zinc-700"
                onClick={openAddFriend}
              >
                <UserPlus className="w-5 h-5" />
              </button>

              <div className="flex-1" />

              <button
                type="button"
                className="h-11 w-11 rounded-full border border-zinc-200 bg-white hover:border-black transition-colors flex items-center justify-center text-zinc-700"
                onClick={handleLogout}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            <div className="w-[300px] bg-zinc-50 border-r border-zinc-200 flex flex-col">
              <div className="px-4 py-4 border-b border-zinc-200">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs tracking-widest uppercase text-zinc-800 font-bold">Agent Chat</div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openCreateGroupModal}
                    className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-full border border-zinc-200 bg-white hover:border-black transition-colors font-mono text-[11px] text-zinc-700"
                  >
                    <Users className="w-4 h-4" />
                    建群
                  </button>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      value={sidebarQuery}
                      onChange={(e) => setSidebarQuery(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-white border border-zinc-200 rounded-full text-sm font-mono text-black placeholder-zinc-400 focus:outline-none focus:border-black transition-colors"
                      placeholder={sidebarTab === 'sessions' ? "搜索会话..." : contactListTab === "friends" ? "搜索联系人..." : "搜索群组..."}
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {renderSidebarList(false)}
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-white">
              {sidebarTab === 'friends' ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50/50">
                  <div className="w-24 h-24 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-4 text-zinc-300">
                    <Users className="w-10 h-10" />
                  </div>
                  <div className="font-mono text-[13px] text-zinc-500 font-bold tracking-widest uppercase">
                    {contactListTab === "friends" ? "选择联系人发起聊天" : "选择群组进入会话"}
                  </div>
                </div>
              ) : (
                <>
                  <div className="h-[64px] px-6 border-b border-zinc-200 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-mono text-[16px] font-black tracking-wide text-zinc-900 truncate leading-tight">
                        {activeChatTitle}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-9 px-3 rounded-full border border-zinc-200 bg-white hover:border-black transition-colors inline-flex items-center gap-2 font-mono text-[11px] text-zinc-700"
                      >
                        <Info className="w-4 h-4" />
                        详情
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-6 bg-zinc-50">
                    <div className="space-y-4">
                      {isLoadingHistory && activeMessages.length === 0 ? (
                        <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                          <div className="w-5 h-5 rounded-full border-2 border-zinc-300 border-t-zinc-800 animate-spin" />
                          <span className="text-zinc-400 font-mono text-[11px]">加载聊天记录中...</span>
                        </div>
                      ) : activeMessages.map((m, index) => {
                        const mine = m.role === "me";
                        const displayName = m.senderDisplayName || (mine ? meDisplayName : peerDisplayName);
                        const photo = m.senderPhoto ?? (mine ? mePhoto : peerPhoto);
                        const photoSrc = buildPhotoSrc(photo);
                        const showTime = shouldShowMessageTime(activeMessages, index);
                        return (
                          <div key={m.id} className="w-full">
                            {showTime ? (
                              <div className="w-full flex justify-center">
                                <div className="px-3 py-1 rounded-full text-[11px] text-zinc-400 font-mono bg-white/70 border border-zinc-200">
                                  {getMessageTimeLabel(m)}
                                </div>
                              </div>
                            ) : null}
                            <div className={`${showTime ? "mt-2" : ""} w-full flex ${mine ? "justify-end" : "justify-start"} gap-3`}>
                              {!mine ? (
                                <div className="h-10 w-10 rounded-full bg-zinc-100 border-[2px] border-zinc-900 overflow-hidden flex items-center justify-center shrink-0 shadow-[0_0_0_2px_rgba(255,255,255,1),0_0_0_3px_rgba(0,0,0,0.1)]">
                                  {photoSrc ? (
                                    <img src={photoSrc} alt="avatar" className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="font-mono text-[13px] font-bold text-zinc-500">
                                      {displayName.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              ) : null}
                              <div className={`max-w-[70%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                                <div className="text-[12px] text-zinc-400 font-mono leading-none">
                                  {displayName}
                                </div>
                                <div
                                  className={`mt-1 relative rounded-lg px-4 py-2.5 text-[15px] leading-relaxed ${
                                    mine
                                      ? "bg-[#07C160] text-white"
                                      : "bg-white text-zinc-900"
                                  } ${
                                    mine
                                      ? "before:content-[''] before:absolute before:right-[-4px] before:top-[12px] before:w-2 before:h-2 before:bg-[#07C160] before:rotate-45"
                                      : "before:content-[''] before:absolute before:left-[-4px] before:top-[12px] before:w-2 before:h-2 before:bg-white before:rotate-45"
                                  }`}
                                >
                                  {m.text}
                                </div>
                              </div>
                              {mine ? (
                                <div className="h-10 w-10 rounded-full bg-zinc-100 border-[2px] border-zinc-900 overflow-hidden flex items-center justify-center shrink-0 shadow-[0_0_0_2px_rgba(255,255,255,1),0_0_0_3px_rgba(0,0,0,0.1)]">
                                  {photoSrc ? (
                                    <img src={photoSrc} alt="avatar" className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="font-mono text-[13px] font-bold text-zinc-500">
                                      {displayName.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={bottomRef} />
                    </div>
                  </div>

                  <div className="border-t border-zinc-200 bg-white flex flex-col h-[180px]">
                    {/* 工具栏 */}
                    <div className="flex items-center px-4 py-2 gap-4 text-zinc-500">
                      <button type="button" className="hover:text-zinc-800 transition-colors p-1 rounded-md hover:bg-zinc-100">
                        <Smile className="w-5 h-5" />
                      </button>
                      <button type="button" className="hover:text-zinc-800 transition-colors p-1 rounded-md hover:bg-zinc-100">
                        <Folder className="w-5 h-5" />
                      </button>
                      <button type="button" className="hover:text-zinc-800 transition-colors p-1 rounded-md hover:bg-zinc-100">
                        <ImageIcon className="w-5 h-5" />
                      </button>
                    </div>

                    {/* 输入区 */}
                    <div className="flex-1 flex flex-col px-4 pb-4">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    className="flex-1 w-full resize-none bg-transparent font-mono text-[14px] text-black placeholder-zinc-400 focus:outline-none transition-colors leading-relaxed"
                    placeholder="输入消息...（Enter 发送，Shift+Enter 换行）"
                  />
                  <div className="flex justify-end mt-2 h-9">
                    {draft.trim() && (
                      <button
                        type="button"
                        onClick={send}
                        className="h-9 px-6 rounded bg-[#07C160] text-white font-mono text-[13px] hover:bg-[#06AD56] active:bg-[#05964B] transition-all flex items-center justify-center shadow-sm"
                      >
                        发送
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

            <div className="hidden lg:flex w-[320px] bg-zinc-50 border-l border-zinc-200 flex-col">
              <div className="px-5 py-4 border-b border-zinc-200">
                <div className="font-mono text-xs font-bold tracking-widest uppercase text-zinc-800">会话信息</div>
                <div className="mt-2 font-mono text-[11px] text-zinc-500">把复杂留给系统，把清醒留给自己。</div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div className="bg-white border border-zinc-200 rounded-xl p-4">
                  <div className="font-mono text-[12px] font-bold text-zinc-900 mb-3">PROFILE</div>
                  <div className="space-y-3">
                    {userInfo && (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-zinc-100 border-2 border-zinc-900 overflow-hidden flex items-center justify-center shrink-0 shadow-[0_0_0_2px_rgba(255,255,255,1),0_0_0_3px_rgba(0,0,0,0.1)]">
                            {userInfo.photo ? (
                              <img 
                                src={userInfo.photo.startsWith('http') ? userInfo.photo : `${import.meta.env.VITE_API_BASE_URL || ''}${userInfo.photo.startsWith('/') ? '' : '/'}${userInfo.photo}`} 
                                alt="avatar" 
                                className="h-full w-full object-cover" 
                              />
                            ) : (
                              <span className="font-mono text-[16px] font-bold text-zinc-400">
                                {(userInfo.userName || userInfo.mobile || "?").charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-[12px] font-bold text-zinc-900 truncate" title={userInfo.userName || userInfo.mobile}>
                              {userInfo.userName || userInfo.mobile || "未命名"}
                            </div>
                            {userInfo.mobile && (
                              <div className="font-mono text-[10px] text-zinc-500 truncate mt-0.5">
                                {userInfo.mobile}
                              </div>
                            )}
                            <div className="font-mono text-[10px] text-zinc-500 truncate mt-0.5" title={userInfo.signature || "暂无签名"}>
                              {userInfo.signature || "暂无签名"}
                            </div>
                          </div>
                        </div>
                        <div className="my-3 border-t border-dashed border-zinc-200"></div>
                      </>
                    )}
                        <div className="flex items-center justify-between font-mono text-[11px] text-zinc-600 mt-2">
                      <span>状态</span>
                      <span className="inline-flex items-center gap-2 text-zinc-900">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isWsConnected
                              ? "bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse"
                              : "bg-zinc-300"
                          }`}
                        />
                        <span className="font-mono text-[11px]">
                          {isWsConnected ? "ONLINE" : "OFFLINE"}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px] text-zinc-600 mt-2">
                      <span>会话</span>
                      <span className="text-zinc-900">--</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-xl p-4">
                  <div className="font-mono text-[12px] font-bold text-zinc-900">SHORTCUTS</div>
                  <div className="mt-2 space-y-2 font-mono text-[11px] text-zinc-600">
                    <div className="flex items-center justify-between">
                      <span>发送</span>
                      <span className="text-zinc-900">Enter</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>换行</span>
                      <span className="text-zinc-900">Shift+Enter</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-xl p-4">
                  <div className="font-mono text-[12px] font-bold text-zinc-900 mb-3 flex items-center justify-between">
                    <span>WS HEARTBEAT</span>
                    <span className={`text-[10px] ${isWsConnected ? 'text-[#07C160]' : 'text-zinc-400'}`}>
                      {isWsConnected ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                  </div>
                  <div className="h-[80px] bg-[#0a0a0a] rounded-lg relative overflow-hidden flex items-center p-2 border-[2px] border-zinc-800 shadow-inner">
                    <style>{`
                        @keyframes ekg-scroll {
                          0% { transform: translateX(0); }
                          100% { transform: translateX(-50%); }
                        }
                        .pixel-mask {
                          mask-image: repeating-linear-gradient(to bottom, black 0px, black 2px, transparent 2px, transparent 3px);
                          -webkit-mask-image: repeating-linear-gradient(to bottom, black 0px, black 2px, transparent 2px, transparent 3px);
                        }
                      `}</style>
                    <div className="absolute inset-0 opacity-20" style={{
                      backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
                      backgroundSize: '4px 4px'
                    }}></div>
                    <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-[#07C160]/20 -translate-y-1/2"></div>
                    <div
                      className="h-full relative z-10 flex items-center"
                      style={{
                        width: 'max-content',
                        animation: isWsConnected ? 'ekg-scroll 4s linear infinite' : 'none'
                      }}
                    >
                      <svg width="400" height="80" viewBox="0 0 400 80" preserveAspectRatio="none" className="overflow-visible">
                        <polyline
                          points="0,40 30,40 40,20 50,60 60,30 70,50 80,40 100,40 130,40 140,20 150,60 160,30 170,50 180,40 200,40 230,40 240,20 250,60 260,30 270,50 280,40 300,40 330,40 340,20 350,60 360,30 370,50 380,40 400,40"
                          fill="none"
                          stroke={isWsConnected ? '#07C160' : '#52525b'}
                          strokeWidth="2"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                          className="pixel-mask transition-all duration-500"
                          style={{
                            transformOrigin: 'center',
                            transform: isWsConnected ? 'scaleY(1)' : 'scaleY(0)'
                          }}
                        />
                        {!isWsConnected && (
                          <line
                            x1="0" y1="40" x2="400" y2="40"
                            stroke="#52525b"
                            strokeWidth="2"
                            className="pixel-mask"
                          />
                        )}
                      </svg>
                      <svg width="400" height="80" viewBox="0 0 400 80" preserveAspectRatio="none" className="overflow-visible">
                        <polyline
                          points="0,40 30,40 40,20 50,60 60,30 70,50 80,40 100,40 130,40 140,20 150,60 160,30 170,50 180,40 200,40 230,40 240,20 250,60 260,30 270,50 280,40 300,40 330,40 340,20 350,60 360,30 370,50 380,40 400,40"
                          fill="none"
                          stroke={isWsConnected ? '#07C160' : '#52525b'}
                          strokeWidth="2"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                          className="pixel-mask transition-all duration-500"
                          style={{
                            transformOrigin: 'center',
                            transform: isWsConnected ? 'scaleY(1)' : 'scaleY(0)'
                          }}
                        />
                        {!isWsConnected && (
                          <line
                            x1="0" y1="40" x2="400" y2="40"
                            stroke="#52525b"
                            strokeWidth="2"
                            className="pixel-mask"
                          />
                        )}
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-zinc-200 font-mono text-[10px] text-zinc-400 tracking-widest uppercase">
                AgentChat UI
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddFriendOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="bg-white w-full max-w-[420px] rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col border border-zinc-200/50 relative animate-in zoom-in-95 duration-300">
            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between shrink-0">
              <div className="font-mono text-[13px] font-bold tracking-widest uppercase text-zinc-900">添加好友</div>
              <button
                type="button"
                onClick={() => {
                  setIsAddFriendOpen(false);
                  setFriendQuery("");
                  setSearchResult(null);
                }}
                className="h-8 w-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <div className="p-6 pt-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  value={friendQuery}
                  onChange={(e) => setFriendQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-white border border-zinc-200 rounded-full text-sm font-mono text-black placeholder-zinc-400 focus:outline-none focus:border-black transition-colors"
                  placeholder="输入手机号搜索"
                />
              </div>

              <div className="mt-5">
                {!friendQuery.trim() ? (
                  <div className="py-8 text-center text-zinc-400 font-mono text-[11px] tracking-widest uppercase">
                    输入手机号开始搜索
                  </div>
                ) : isSearchingUser ? (
                  <div className="py-8 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-zinc-300 border-t-zinc-800 animate-spin" />
                    <span className="text-zinc-400 font-mono text-[11px]">搜索中...</span>
                  </div>
                ) : searchResult ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserForDetails(searchResult);
                      setIsAddFriendOpen(false);
                    }}
                    className="w-full text-left p-4 bg-zinc-50/50 rounded-2xl border border-zinc-100 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-zinc-100 border-2 border-zinc-900 overflow-hidden flex items-center justify-center shrink-0 shadow-[0_0_0_2px_rgba(255,255,255,1),0_0_0_3px_rgba(0,0,0,0.1)]">
                        {searchResult.photo ? (
                          <img
                            src={searchResult.photo.startsWith("http") ? searchResult.photo : `${import.meta.env.VITE_API_BASE_URL || ""}${searchResult.photo.startsWith("/") ? "" : "/"}${searchResult.photo}`}
                            alt="avatar"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="font-mono text-[16px] font-bold text-zinc-400">
                            {(searchResult.userName || searchResult.mobile || "?").charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[12px] font-bold text-zinc-900 truncate flex items-center gap-2">
                          <span>{searchResult.userName || "未命名"}</span>
                          <span className="font-mono text-[10px] text-zinc-400 font-normal px-1.5 py-0.5 bg-zinc-100 rounded">{searchResult.mobile}</span>
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-zinc-500 truncate">
                          {searchResult.signature || "暂无签名"}
                        </div>
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="py-8 text-center text-zinc-400 font-mono text-[11px] tracking-widest uppercase">
                    未找到匹配用户
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isCreateGroupOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="bg-white w-full max-w-[460px] max-h-[82vh] rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col border border-zinc-200/50 relative animate-in zoom-in-95 duration-300">
            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between shrink-0">
              <div>
                <div className="font-mono text-[13px] font-bold tracking-widest uppercase text-zinc-900">创建群组</div>
                <div className="mt-1 font-mono text-[10px] text-zinc-400">输入群名并选择多个好友</div>
              </div>
              <button
                type="button"
                onClick={closeCreateGroupModal}
                disabled={isCreatingGroup}
                className="h-8 w-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <div className="mb-2 font-mono text-[10px] text-zinc-400 tracking-widest uppercase">群名称</div>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  disabled={isCreatingGroup}
                  maxLength={30}
                  className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-mono text-black placeholder-zinc-400 focus:outline-none focus:border-black transition-colors disabled:opacity-50"
                  placeholder="请输入群名称"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-mono text-[10px] text-zinc-400 tracking-widest uppercase">群成员</div>
                  <div className="font-mono text-[10px] text-zinc-500">
                    已选 {selectedGroupUserIds.length} 人
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    value={groupMemberQuery}
                    onChange={(e) => setGroupMemberQuery(e.target.value)}
                    disabled={isCreatingGroup}
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-zinc-200 rounded-full text-sm font-mono text-black placeholder-zinc-400 focus:outline-none focus:border-black transition-colors disabled:opacity-50"
                    placeholder="搜索好友昵称或手机号"
                  />
                </div>
              </div>

              <div className="min-h-[280px] max-h-[360px] overflow-y-auto rounded-2xl border border-zinc-100 bg-zinc-50/50 p-2">
                {isLoadingGroupFriends ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-zinc-300 border-t-zinc-800 animate-spin" />
                    <span className="text-zinc-400 font-mono text-[11px]">加载好友中...</span>
                  </div>
                ) : groupFriends.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 font-mono text-[11px] tracking-widest uppercase">
                    暂无可选好友
                  </div>
                ) : filteredGroupFriends.length > 0 ? (
                  <div className="space-y-2">
                    {filteredGroupFriends.map((friend) => {
                      const selected = selectedGroupUserIds.includes(friend.userId);
                      return (
                        <button
                          key={friend.userId}
                          type="button"
                          onClick={() => toggleGroupMember(friend.userId)}
                          disabled={isCreatingGroup}
                          className={`w-full text-left p-3 rounded-2xl border transition-colors flex items-center gap-3 ${
                            selected ? "border-black bg-white" : "border-zinc-100 bg-white hover:border-zinc-300"
                          } disabled:opacity-50`}
                        >
                          <div className="h-10 w-10 rounded-full bg-zinc-100 border-[2px] border-zinc-900 overflow-hidden flex items-center justify-center shrink-0 shadow-[0_0_0_2px_rgba(255,255,255,1),0_0_0_3px_rgba(0,0,0,0.1)]">
                            {friend.photo ? (
                              <img
                                src={friend.photo.startsWith("http") ? friend.photo : `${import.meta.env.VITE_API_BASE_URL || ""}${friend.photo.startsWith("/") ? "" : "/"}${friend.photo}`}
                                alt="avatar"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="font-mono text-[16px] font-bold text-zinc-400">
                                {(friend.userName || friend.mobile || "?").charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-[12px] font-bold text-zinc-900 truncate">
                              {friend.userName || friend.mobile || "未命名"}
                            </div>
                            <div className="mt-1 font-mono text-[10px] text-zinc-500 truncate">
                              {friend.mobile || friend.signature || "暂无信息"}
                            </div>
                          </div>
                          <div className={`h-5 w-5 rounded-md border flex items-center justify-center ${
                            selected ? "border-black bg-black text-white" : "border-zinc-300 bg-white text-transparent"
                          }`}>
                            ✓
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-zinc-400 font-mono text-[11px] tracking-widest uppercase">
                    没有匹配的好友
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-6 pt-1 shrink-0">
              <button
                type="button"
                disabled={isCreatingGroup || isLoadingGroupFriends}
                onClick={handleCreateGroup}
                className="w-full h-12 bg-black text-white font-mono text-[13px] tracking-widest uppercase rounded-2xl hover:bg-zinc-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingGroup ? (
                  <div className="w-4 h-4 rounded-full border-2 border-zinc-500 border-t-white animate-spin" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
                {isCreatingGroup ? "创建中..." : "创建群组"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedUserForDetails && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="bg-white w-full max-w-[320px] rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col border border-zinc-200/50 relative animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setSelectedUserForDetails(null)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            
            <div className="pt-10 pb-6 px-6 flex flex-col items-center">
              <div className="h-20 w-20 rounded-full bg-zinc-100 border-[3px] border-zinc-900 overflow-hidden flex items-center justify-center shrink-0 shadow-[0_0_0_3px_rgba(255,255,255,1),0_0_0_4px_rgba(0,0,0,0.1)] mb-4">
                {selectedUserForDetails.photo ? (
                  <img
                    src={selectedUserForDetails.photo.startsWith('http') ? selectedUserForDetails.photo : `${import.meta.env.VITE_API_BASE_URL || ''}${selectedUserForDetails.photo.startsWith('/') ? '' : '/'}${selectedUserForDetails.photo}`}
                    alt="avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-mono text-[32px] font-bold text-zinc-400">
                    {(selectedUserForDetails.userName || selectedUserForDetails.mobile || "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              
              <div className="font-mono text-lg font-bold text-zinc-900 text-center mb-1">
                {selectedUserForDetails.userName || "未命名"}
              </div>
              <div className="font-mono text-xs text-zinc-500 text-center px-2 py-1 bg-zinc-100 rounded-full mb-4">
                {selectedUserForDetails.mobile}
              </div>
              
              <div className="w-full space-y-4 text-left border-t border-zinc-100 pt-4 mt-2">
                <div>
                  <div className="font-mono text-[10px] text-zinc-400 uppercase tracking-widest mb-1">个性签名</div>
                  <div className="font-mono text-[13px] text-zinc-800">
                    {selectedUserForDetails.signature || "暂无签名"}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 pb-6 pt-2">
              <button
                type="button"
                disabled={isApplying}
                onClick={async () => {
                  setIsApplying(true);
                  try {
                    const res = await applyAddFriend(selectedUserForDetails.userId);
                    if (res.data) {
                      showToast("success", "好友申请已发送！");
                      setSelectedUserForDetails(null);
                    } else {
                      showToast("error", res.msg || "申请失败，请重试");
                    }
                  } catch (err: any) {
                    showToast("error", err?.response?.data?.msg || err?.message || "请求出错，请稍后再试");
                  } finally {
                    setIsApplying(false);
                  }
                }}
                className="w-full h-12 bg-black text-white font-mono text-[13px] tracking-widest uppercase rounded-2xl hover:bg-zinc-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplying ? (
                  <div className="w-4 h-4 rounded-full border-2 border-zinc-500 border-t-white animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
                )}
                {isApplying ? "发送中..." : "申请添加好友"}
              </button>
            </div>
          </div>
        </div>
      )}
      {isNotificationOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="bg-white w-full max-w-[380px] max-h-[80vh] rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.15)] flex flex-col border border-zinc-200/50 relative animate-in zoom-in-95 duration-300">
            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between shrink-0">
              <div className="font-mono text-[13px] font-bold tracking-widest uppercase text-zinc-900">通知列表</div>
              <button 
                onClick={() => setIsNotificationOpen(false)}
                className="h-8 w-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {isLoadingApplies ? (
                <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-zinc-300 border-t-zinc-800 animate-spin" />
                  <span className="text-zinc-400 font-mono text-[11px]">加载中...</span>
                </div>
              ) : friendApplies.length > 0 ? (
                <div className="space-y-2">
                  {friendApplies.map((apply) => {
                    const date = new Date(apply.applyTime);
                    const timeStr = `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
                    return (
                      <div key={apply.applyId} className="p-4 bg-zinc-50/50 rounded-2xl border border-zinc-100 flex gap-3">
                        <div className="h-10 w-10 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden flex items-center justify-center shrink-0">
                          {apply.applyUser.photo ? (
                            <img
                              src={apply.applyUser.photo.startsWith('http') ? apply.applyUser.photo : `${import.meta.env.VITE_API_BASE_URL || ''}${apply.applyUser.photo.startsWith('/') ? '' : '/'}${apply.applyUser.photo}`}
                              alt="avatar"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="font-mono text-[16px] font-bold text-zinc-400">
                              {(apply.applyUser.userName || apply.applyUser.mobile || "?").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-mono text-[12px] font-bold text-zinc-900 truncate mr-2">
                              {apply.applyUser.userName || apply.applyUser.mobile}
                            </span>
                            <span className="font-mono text-[10px] text-zinc-400 shrink-0">
                              {timeStr}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-zinc-500 mb-3 truncate">
                            请求添加你为好友
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={processingApplyId === apply.applyId}
                              onClick={() => handleApplyAction(apply.applyId, 'pass')}
                              className="flex-1 h-8 bg-black text-white font-mono text-[11px] tracking-widest uppercase rounded-xl hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {processingApplyId === apply.applyId ? "处理中" : "同意"}
                            </button>
                            <button
                              type="button"
                              disabled={processingApplyId === apply.applyId}
                              onClick={() => handleApplyAction(apply.applyId, 'refuse')}
                              className="flex-1 h-8 bg-zinc-200 text-zinc-700 font-mono text-[11px] tracking-widest uppercase rounded-xl hover:bg-zinc-300 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {processingApplyId === apply.applyId ? "..." : "拒绝"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-16 text-center text-zinc-400 font-mono text-[11px] tracking-widest uppercase">
                  暂无新通知
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 top-12 -translate-x-1/2 z-[200] px-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <button
            type="button"
            onClick={() => setToast(null)}
            className="max-w-[92vw] rounded-2xl bg-white border-2 border-zinc-900 shadow-[0_16px_60px_rgba(0,0,0,0.25)] px-4 py-3 flex items-center gap-3 text-left"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                toast.variant === "error" ? "bg-zinc-500" : "bg-black"
              }`}
            />
            <span className="font-mono text-[12px] text-zinc-900">{toast.message}</span>
          </button>
        </div>
      )}
    </div>
  );
}
