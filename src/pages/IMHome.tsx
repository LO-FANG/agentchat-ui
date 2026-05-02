import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { InteractiveBackground } from "@/components/ui/InteractiveBackground";
import { ScanLine, MessageSquare, RefreshCw } from "lucide-react";
import { registerUser, getCaptchaImage, loginUser, getSlideVerification, getSlideVerificationImage, validateSlideVerification } from "@/api/auth";

export default function IMHome() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [printPhase, setPrintPhase] = useState<"idle" | "out" | "in">("in");
  const [ticketViewportTop, setTicketViewportTop] = useState<number | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [redirectProgressOn, setRedirectProgressOn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const redirectTimerRef = React.useRef<number | null>(null);
  
  // 表单状态
  const [account, setAccount] = useState("");
  const [mobile, setMobile] = useState(""); // 新增手机号状态
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validCode, setValidCode] = useState("");
  const [loading, setLoading] = useState(false);

  // 固定随机生成的编号和条形码 (使用 useMemo 避免每次输入时重新渲染导致闪烁)
  const ticketNumber = React.useMemo(() => Math.floor(Math.random() * 1000000000), [isLogin]);
  const barcodeWidths = React.useMemo(() => [...Array(40)].map(() => Math.random() * 4 + 1 + 'px'), [isLogin]);
  
  // 图片验证码状态
  const [captchaUrl, setCaptchaUrl] = useState("");

  const [slideOpen, setSlideOpen] = useState(false);
  const [slideId, setSlideId] = useState("");
  const [slideX, setSlideX] = useState(0);
  const [slideY, setSlideY] = useState(0);
  const [slideImageUrl, setSlideImageUrl] = useState("");
  const [slideImageMeta, setSlideImageMeta] = useState<{ w: number; h: number } | null>(null);
  const [slideOffset, setSlideOffset] = useState(0);
  const [slideHint, setSlideHint] = useState("");
  const [slideVerifying, setSlideVerifying] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<{ mobile: string; password: string } | null>(null);

  const slideDragRef = React.useRef<{ startX: number; startOffset: number } | null>(null);
  const slideEndRef = React.useRef(false);

  // 反馈状态
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const captchaUrlRef = React.useRef("");
  const slideImageUrlRef = React.useRef("");
  const dispenserRef = React.useRef<HTMLDivElement | null>(null);
  const slotRef = React.useRef<HTMLDivElement | null>(null);

  const slideImageWidth = 320;
  const slideImageHeight = 200;
  const slideHandleWidth = 56;
  const slideMaxOffset = slideImageWidth - slideHandleWidth;
  const ticketViewportHeight = 760;
  const puzzlePath = "M20 20H40Q45 20 45 15Q45 5 55 5Q65 5 65 15Q65 20 70 20H80V40Q80 45 85 45Q95 45 95 55Q95 65 85 65Q80 65 80 70V80H60Q55 80 55 85Q55 95 45 95Q35 95 35 85Q35 80 30 80H20V20Z";

  const showLoginError = (msg: string) => {
    setSuccess("");
    setError(msg);
  };

  const showLoginSuccess = (msg: string) => {
    setError("");
    setSuccess(msg);
  };

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  };

  const isCredentialErrorMessage = (msg: string) => {
    const t = (msg || "").replace(/\s+/g, "");
    const l = t.toLowerCase();
    return (
      t.includes("用户名或密码错误") ||
      t.includes("账号或密码错误") ||
      t.includes("账户或密码错误") ||
      t.includes("密码验证失败") ||
      t.includes("用户不存在") ||
      t.includes("账号不存在") ||
      t.includes("账户不存在") ||
      t.includes("手机号不存在") ||
      (t.includes("用户名") && t.includes("错误")) ||
      (t.includes("账号") && t.includes("错误")) ||
      (t.includes("账户") && t.includes("错误")) ||
      l.includes("badcredentials") ||
      l.includes("invalidcredentials") ||
      l.includes("unauthorized")
    );
  };

  const isCaptchaErrorMessage = (msg: string) => {
    const t = (msg || "").replace(/\s+/g, "");
    return t.includes("验证码") || t.includes("滑动") || t.includes("拼图");
  };

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!redirecting) return;
    setRedirectProgressOn(false);
    const raf = window.requestAnimationFrame(() => setRedirectProgressOn(true));
    return () => window.cancelAnimationFrame(raf);
  }, [redirecting]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const refreshCaptcha = async () => {
    try {
      const url = await getCaptchaImage();
      setCaptchaUrl((prevUrl) => {
        // 清理旧的 Blob URL 以避免内存泄漏
        if (prevUrl) {
          URL.revokeObjectURL(prevUrl);
        }
        return url;
      });
    } catch (err) {
      console.error("获取验证码失败", err);
    }
  };

  // 当切换到注册页面时，自动刷新一次验证码
  useEffect(() => {
    if (!isLogin) {
      refreshCaptcha();
    }
  }, [isLogin]);

  useEffect(() => {
    captchaUrlRef.current = captchaUrl;
  }, [captchaUrl]);

  useEffect(() => {
    slideImageUrlRef.current = slideImageUrl;
  }, [slideImageUrl]);

  useEffect(() => {
    return () => {
      if (captchaUrlRef.current) URL.revokeObjectURL(captchaUrlRef.current);
      if (slideImageUrlRef.current) URL.revokeObjectURL(slideImageUrlRef.current);
    };
  }, []);

  React.useLayoutEffect(() => {
    const update = () => {
      if (!dispenserRef.current || !slotRef.current) return;
      const rootRect = dispenserRef.current.getBoundingClientRect();
      const slotRect = slotRef.current.getBoundingClientRect();
      setTicketViewportTop(slotRect.bottom - rootRect.top);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (printPhase !== "in") return;
    const t = window.setTimeout(() => setPrintPhase("idle"), 1500);
    return () => window.clearTimeout(t);
  }, [printPhase]);

  const toggleMode = () => {
    if (loading) return;
    if (redirecting) return;
    if (printPhase !== "idle") return;
    setError("");
    setSuccess("");
    setPrintPhase("out");
    window.setTimeout(() => {
      setIsLogin((prev) => !prev);
      // 切换模式时清空表单
      setAccount("");
      setMobile("");
      setPassword("");
      setConfirmPassword("");
      setValidCode("");
      window.requestAnimationFrame(() => setPrintPhase("in"));
    }, 600);
  };

  const loadSlideVerification = async () => {
    setSlideHint("");
    setSlideOffset(0);
    setSlideVerifying(false);
    setSlideImageMeta(null);
    try {
      const res = await getSlideVerification();
      const data = res.data;
      setSlideId(data.id);
      setSlideX(data.x);
      setSlideY(data.y);
      const url = await getSlideVerificationImage(data.image);
      setSlideImageUrl((prevUrl) => {
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        return url;
      });
      setSlideOpen(true);
    } catch (err: unknown) {
      showLoginError(getErrorMessage(err, "获取滑动验证失败，请稍后重试"));
    }
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setSlideId("");
    setSlideX(0);
    setSlideY(0);
    setSlideOffset(0);
    setSlideHint("");
    setSlideVerifying(false);
    setPendingLogin(null);
    setSlideImageUrl((prevUrl) => {
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      return "";
    });
  };

  const buildAccessToken = (id: string, distance: number) => `${id}${distance}`;

  const refreshSlideVerification = async (hint: string) => {
    setSlideOffset(0);
    setSlideVerifying(false);
    setSlideHint(hint);
    await loadSlideVerification();
    setSlideHint(hint);
  };

  const verifySlideAndLogin = async () => {
    if (!pendingLogin) return;
    if (!slideId) return;

    const scaleX = slideImageMeta ? slideImageWidth / slideImageMeta.w : 1;
    const distanceServer = Math.round(slideOffset / scaleX);

    setSlideVerifying(true);
    setSlideHint("验证中...");

    try {
      const accessToken = buildAccessToken(slideId, distanceServer);
      const verifyRes = await validateSlideVerification(accessToken);
      if (!verifyRes.data) {
        const hint = verifyRes.msg && verifyRes.msg !== "success" ? verifyRes.msg : "验证码校验失败";
        await refreshSlideVerification(hint);
        return;
      }
      await loginUser({ mobile: pendingLogin.mobile, password: pendingLogin.password, slideCode: accessToken });
      closeSlide();
      showLoginSuccess("登录成功！");
      setRedirecting(true);
      setPrintPhase("out");
      redirectTimerRef.current = window.setTimeout(() => {
        navigate("/chat", { replace: true });
      }, 1000);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "验证失败，请重试");
      if (isCredentialErrorMessage(msg)) {
        closeSlide();
        showLoginError(msg);
        return;
      }
      if (isCaptchaErrorMessage(msg)) {
        await refreshSlideVerification(msg);
        return;
      }
      setSlideHint(msg);
      showLoginError(msg);
      await refreshSlideVerification(msg);
    }
  };

  const endSlideDrag = async () => {
    if (slideEndRef.current) return;
    slideEndRef.current = true;
    slideDragRef.current = null;
    if (!pendingLogin || !slideId) {
      setSlideHint("加载中...");
      return;
    }
    await verifySlideAndLogin();
  };

  const onSlidePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (slideVerifying) return;
    if (!pendingLogin || !slideId) {
      setSlideHint("加载中...");
      return;
    }
    slideEndRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    slideDragRef.current = { startX: e.clientX, startOffset: slideOffset };
  };

  const onSlidePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (slideVerifying) return;
    if (!slideDragRef.current) return;
    const delta = e.clientX - slideDragRef.current.startX;
    const next = Math.max(0, Math.min(slideMaxOffset, slideDragRef.current.startOffset + delta));
    setSlideOffset(next);
  };

  const onSlidePointerUp = async () => {
    await endSlideDrag();
  };

  const onSlidePointerCancel = async () => {
    await endSlideDrag();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isLogin) {
      // 注册逻辑校验
      if (!account || !mobile || !password || !confirmPassword || !validCode) {
        setError("请填写完整注册信息");
        return;
      }
      // 简单的手机号格式校验 (可选)
      if (!/^1[3-9]\d{9}$/.test(mobile)) {
        setError("手机号格式不正确");
        return;
      }
      if (password !== confirmPassword) {
        setError("两次输入的密码不一致");
        return;
      }
      if (password.length < 6) {
        setError("密码长度不能小于6位");
        return;
      }
      
      try {
        setLoading(true);
        // 发送真实的后端注册请求，字段名严格对齐后端 UserRegistryInfoRequest 实体类
        await registerUser({ 
          username: account, 
          mobile: mobile,
          password: password, 
          picCheckCode: validCode 
        });
        
        setSuccess("注册成功，请登录！");
        setTimeout(() => {
          toggleMode();
        }, 1500);
      } catch (err: unknown) {
        setError(getErrorMessage(err, "注册失败，请稍后重试"));
        // 注册失败时通常需要刷新验证码
        refreshCaptcha();
        setValidCode("");
      } finally {
        setLoading(false);
      }
      
    } else {
      if (!mobile || !password) {
        showLoginError("请填写手机号和密码");
        return;
      }
      if (!/^1[3-9]\d{9}$/.test(mobile)) {
        showLoginError("手机号格式不正确");
        return;
      }
      try {
        setLoading(true);
        setPendingLogin({ mobile, password });
        await loadSlideVerification();
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full overflow-y-auto bg-white flex flex-col items-center justify-start pt-10 pb-10 lg:pt-16 lg:pb-16 font-sans selection:bg-black selection:text-white">
      {/* 注入自定义关键帧，避免依赖 Tailwind 重启编译，确保动画逻辑强制生效 */}
      <style>{`
        @keyframes physical-print {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(0); }
        }
        @keyframes physical-withdraw {
          0% { transform: translateY(0); }
          100% { transform: translateY(-100%); }
        }
        .animate-physical-print {
          animation: physical-print 1.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .animate-physical-withdraw {
          animation: physical-withdraw 0.6s cubic-bezier(0.7, 0, 0.84, 0) both;
        }
      `}</style>

      {/* 背景：白色底 + 黑色波点波浪 */}
      <InteractiveBackground />

      <div
        ref={dispenserRef}
        className={`relative flex flex-col items-center will-change-[transform,opacity,filter] transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          redirecting ? "opacity-0 scale-[0.985] blur-[2px]" : "opacity-100 scale-100 blur-0"
        }`}
      >
        {/* 取票器机身 (Dispenser Body) - 设置较低的 z-index */}
        <div className="w-[calc(100vw-2rem)] max-w-[420px] bg-zinc-900 rounded-t-3xl rounded-b-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 border-b-8 border-zinc-950 relative z-10 flex flex-col items-center">
          <div className="flex justify-between items-center w-full mb-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-zinc-500" />
              <span className="text-xs font-mono text-zinc-500 font-bold tracking-widest uppercase">Agent Chat</span>
            </div>
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
              <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-green-500 shadow-[0_0_8px_#22c55e]'} animate-pulse`}></div>
            </div>
          </div>
          
          {/* 出票口 (The Slot) */}
          <div ref={slotRef} className="w-full h-4 bg-black rounded-full shadow-inner relative overflow-hidden mt-2 border border-zinc-800">
            <div className="absolute inset-x-0 top-0 h-1 bg-zinc-900 opacity-50"></div>
          </div>
        </div>

        {ticketViewportTop !== null && (
          <div
            className={`absolute left-1/2 -translate-x-1/2 z-20 filter drop-shadow-2xl [clip-path:inset(0_-100vw_-200vh_-100vw)] ${
              isMobile ? "w-[86%] max-w-[360px]" : "w-[360px]"
            }`}
            style={isMobile ? { top: ticketViewportTop - 6 } : { top: ticketViewportTop - 6, height: ticketViewportHeight }}
          >
            <div
              className={`relative bg-white pt-10 lg:pt-12 pb-8 px-6 sm:px-8 lg:px-10 origin-top will-change-[transform] ${printPhase === "out" ? "animate-physical-withdraw" : printPhase === "in" ? "animate-physical-print" : ""}`}
            >
            <div className="text-center font-mono mb-4 border-b-2 border-dashed border-zinc-300 pb-4">
              <ScanLine className="w-8 h-8 mx-auto mb-3 text-black" />
              <h2 className="text-2xl font-bold tracking-widest text-black">
                {isLogin ? "登录凭证" : "注册新证"}
              </h2>
              <p className="text-[10px] text-zinc-500 mt-2 font-mono uppercase tracking-widest">
                编号: {ticketNumber}
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="text-[10px] text-red-500 font-mono font-bold text-center animate-fade-in border border-red-200 bg-red-50 py-1 px-2">
                  ERROR: {error}
                </div>
              )}
              {success && (
                <div className="text-[10px] text-green-600 font-mono font-bold text-center animate-fade-in border border-green-200 bg-green-50 py-1 px-2">
                  SUCCESS: {success}
                </div>
              )}
              
              {isLogin ? (
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                    手机号 / MOBILE
                  </label>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    disabled={loading}
                    className="w-full bg-transparent border-b-2 border-zinc-200 py-2 font-mono text-sm text-black placeholder-zinc-300 focus:outline-none focus:border-black transition-colors disabled:opacity-50"
                    placeholder="输入手机号..."
                    maxLength={11}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                    账号 / ACCOUNT
                  </label>
                  <input 
                    type="text" 
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    disabled={loading}
                    className="w-full bg-transparent border-b-2 border-zinc-200 py-2 font-mono text-sm text-black placeholder-zinc-300 focus:outline-none focus:border-black transition-colors disabled:opacity-50"
                    placeholder="输入账号..."
                  />
                </div>
              )}

              {/* 仅注册模式显示的手机号输入框 */}
              {!isLogin && (
                <div className="space-y-1 animate-fade-in">
                  <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                    手机号 / MOBILE
                  </label>
                  <input 
                    type="tel" 
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    disabled={loading}
                    className="w-full bg-transparent border-b-2 border-zinc-200 py-2 font-mono text-sm text-black placeholder-zinc-300 focus:outline-none focus:border-black transition-colors disabled:opacity-50"
                    placeholder="输入手机号..."
                    maxLength={11}
                  />
                </div>
              )}
              
              <div className="space-y-1">
                <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                  密码 / PASSWORD
                </label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-transparent border-b-2 border-zinc-200 py-2 font-mono text-sm text-black placeholder-zinc-300 focus:outline-none focus:border-black transition-colors disabled:opacity-50"
                  placeholder="••••••••"
                />
              </div>
              
              {!isLogin && (
                <div className="space-y-1 animate-fade-in">
                  <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                    确认密码 / CONFIRM
                  </label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className="w-full bg-transparent border-b-2 border-zinc-200 py-2 font-mono text-sm text-black placeholder-zinc-300 focus:outline-none focus:border-black transition-colors disabled:opacity-50"
                    placeholder="••••••••"
                  />
                </div>
              )}

              {/* 注册页面的图形验证码 */}
              {!isLogin && (
                <div className="space-y-1 animate-fade-in">
                  <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                    验证码 / CAPTCHA
                  </label>
                  <div className="flex items-end gap-3">
                    <input 
                      type="text" 
                      value={validCode}
                      onChange={(e) => setValidCode(e.target.value)}
                      disabled={loading}
                      className="flex-1 bg-transparent border-b-2 border-zinc-200 py-2 font-mono text-sm text-black placeholder-zinc-300 focus:outline-none focus:border-black transition-colors disabled:opacity-50"
                      placeholder="输入验证码"
                      maxLength={6}
                    />
                    <div 
                      className="flex-shrink-0 cursor-pointer group border border-zinc-200 p-1 hover:border-black transition-colors"
                      onClick={refreshCaptcha}
                      title="点击刷新验证码"
                    >
                      <div className="relative w-[90px] h-[20px] bg-zinc-100 flex items-center justify-center overflow-hidden">
                        {captchaUrl && (
                          <img 
                            src={captchaUrl} 
                            alt="captcha" 
                            className="w-full h-full object-cover relative z-10"
                            onLoad={(e) => {
                              e.currentTarget.style.display = 'block';
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center text-zinc-400 z-0">
                          <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="relative overflow-hidden w-full py-3.5 mt-4 bg-black text-white font-mono text-sm font-bold tracking-widest uppercase hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? "处 理 中..." : (isLogin ? "确 认 提 取" : "生 成 凭 证")}
                {loading && <div className="absolute bottom-0 left-0 h-1 bg-zinc-400 animate-pulse w-full"></div>}
              </button>
            </form>

            <div className="mt-6 text-center pt-4 border-t-2 border-dashed border-zinc-300">
              <p className="text-[11px] font-mono text-zinc-500">
                {isLogin ? "未获取凭证?" : "已有凭证?"}
                <button 
                  type="button"
                  onClick={toggleMode}
                  disabled={loading || printPhase !== "idle"}
                  className="ml-2 text-black font-bold hover:underline underline-offset-4 decoration-2 disabled:opacity-50 disabled:hover:no-underline"
                >
                  {isLogin ? "重新生成" : "立即使用"}
                </button>
              </p>
            </div>

            {/* 条形码 Mock (Barcode) - 降低高度以节省空间 */}
            <div className="mt-6 flex justify-center items-center gap-[2px] h-6 opacity-80">
              {barcodeWidths.map((width, i) => (
                <div key={i} className="bg-black h-full" style={{ width }}></div>
              ))}
            </div>
            <div 
              className="absolute top-full left-0 w-full h-3"
              style={{
                backgroundImage: 'radial-gradient(circle at 50% 100%, transparent 5px, white 5.5px)',
                backgroundSize: '16px 12px',
                backgroundRepeat: 'repeat-x',
              }}
            />
          </div>
          </div>
        )}
        <div className={isMobile ? "h-[860px]" : "hidden lg:block h-[760px]"} />
      </div>

      {slideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-[380px] bg-white rounded-lg shadow-[0_30px_80px_rgba(0,0,0,0.35)] border border-zinc-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
              <div className="text-xs font-mono font-bold text-zinc-800 tracking-widest uppercase">请完成安全验证</div>
              <button
                type="button"
                className="text-zinc-500 hover:text-black transition-colors font-mono text-lg leading-none"
                onClick={closeSlide}
                disabled={slideVerifying}
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="w-full flex justify-center">
                <div className="relative w-full max-w-[320px] h-[200px] bg-zinc-100 border border-zinc-200 rounded overflow-hidden">
                  {slideImageUrl ? (
                    <>
                      <img
                        src={slideImageUrl}
                        alt="slide"
                        className="w-full h-full object-cover"
                        onLoad={(e) => {
                          setSlideImageMeta({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
                        }}
                      />
                      {(() => {
                        const scaleX = slideImageMeta ? slideImageWidth / slideImageMeta.w : 1;
                        const scaleY = slideImageMeta ? slideImageHeight / slideImageMeta.h : 1;
                        const holeLeft = Math.round(slideX * scaleX);
                        const holeTop = Math.round(slideY * scaleY);
                        const clampedHoleLeft = Math.max(0, Math.min(slideImageWidth - slideHandleWidth, holeLeft));
                        const clampedHoleTop = Math.max(0, Math.min(slideImageHeight - slideHandleWidth, holeTop));
                        const blockTop = clampedHoleTop;
                        return (
                          <>
                            <div
                              className="absolute pointer-events-none"
                              style={{
                                width: `${slideHandleWidth}px`,
                                height: `${slideHandleWidth}px`,
                                left: `${clampedHoleLeft}px`,
                                top: `${clampedHoleTop}px`,
                              }}
                            >
                              <svg viewBox="0 0 100 100" className="w-full h-full">
                                <path
                                  d={puzzlePath}
                                  fill="rgba(0,0,0,0.15)"
                                  stroke="rgba(255,255,255,0.9)"
                                  strokeWidth="3"
                                  strokeDasharray="4 3"
                                />
                              </svg>
                            </div>
                            <div
                              className="absolute pointer-events-none"
                              style={{
                                width: `${slideHandleWidth}px`,
                                height: `${slideHandleWidth}px`,
                                left: `${Math.round(slideOffset)}px`,
                                top: `${blockTop}px`,
                                transform: "translateZ(0)",
                                filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.25))",
                              }}
                            >
                              <svg viewBox="0 0 100 100" className="w-full h-full">
                                <path
                                  d={puzzlePath}
                                  fill="rgba(255,255,255,0.35)"
                                  stroke="rgba(255,255,255,0.75)"
                                  strokeWidth="2"
                                />
                              </svg>
                            </div>
                            <div
                              className="absolute left-3 top-3 px-2 py-1 rounded bg-black/55 text-white text-[10px] font-mono tracking-widest pointer-events-none"
                            >
                              拖动下方滑块对齐方块
                            </div>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-mono text-zinc-500">加载中...</div>
                  )}
                </div>
              </div>

              <div className="w-full flex justify-center">
                <div className="w-full max-w-[320px]">
                  <div className="relative h-12 bg-zinc-100 border border-zinc-200 rounded-full overflow-hidden select-none">
                    <div className="absolute inset-y-0 left-0 bg-black/10 rounded-full" style={{ width: `${slideOffset + slideHandleWidth}px` }} />
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 h-[44px] w-[56px] rounded-full ${
                        slideVerifying ? "cursor-not-allowed opacity-80" : "cursor-grab active:cursor-grabbing"
                      } touch-none`}
                      style={{ left: `${slideOffset}px` }}
                      onPointerDown={onSlidePointerDown}
                      onPointerMove={onSlidePointerMove}
                      onPointerUp={onSlidePointerUp}
                      onPointerCancel={onSlidePointerCancel}
                      onLostPointerCapture={onSlidePointerCancel}
                    >
                      <div className="relative w-full h-full rounded-full transition-transform duration-75 active:translate-y-[2px]">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-zinc-200 via-zinc-100 to-zinc-300 shadow-[inset_0_2px_0_rgba(255,255,255,0.9),inset_0_-10px_18px_rgba(0,0,0,0.25),0_14px_22px_rgba(0,0,0,0.35)] active:shadow-[inset_0_2px_0_rgba(255,255,255,0.6),inset_0_-8px_12px_rgba(0,0,0,0.35),0_6px_10px_rgba(0,0,0,0.35)] border border-black/10" />
                        <div className="absolute inset-[6px] rounded-full bg-gradient-to-b from-zinc-50 to-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" />
                        <div className="absolute left-2 right-2 top-1.5 h-2 rounded-full bg-white/70 blur-[0.2px]" />
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse" />
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-[11px] font-mono text-zinc-500 tracking-widest">
                        {slideHint || (slideId ? "按住滑块拖动完成拼图" : "加载中...")}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <button
                      type="button"
                      className="text-[11px] font-mono text-zinc-500 hover:text-black transition-colors"
                      onClick={loadSlideVerification}
                      disabled={slideVerifying}
                    >
                      刷新
                    </button>
                    <div className="text-[10px] font-mono text-zinc-400 tracking-widest">
                      ID: {slideId ? slideId.slice(0, 8) : "--------"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {redirecting && (
        <div className="fixed inset-0 z-[60] bg-white/85 backdrop-blur-[3px] animate-fade-in flex items-center justify-center">
          <div className="w-[360px] bg-white border border-zinc-200 rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.18)] px-8 py-7">
            <div className="font-mono text-[11px] text-zinc-500 tracking-widest uppercase">Login Accepted</div>
            <div className="mt-2 font-mono text-sm font-bold tracking-widest text-zinc-900">正在进入聊天...</div>
            <div className="mt-5 h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full w-full bg-black origin-left transition-transform duration-[1000ms] ease-out ${
                  redirectProgressOn ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
