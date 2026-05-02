import React, { useEffect, useRef } from "react";

export function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    const mouse = { x: -1000, y: -1000 };
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    class Particle {
      ox: number; // 原始X坐标
      oy: number; // 原始Y坐标
      x: number;
      y: number;
      baseRadius: number;

      constructor(x: number, y: number) {
        this.ox = x;
        this.oy = y;
        this.x = x;
        this.y = y;
        this.baseRadius = 1.5; // 黑色波点的基础大小
      }

      update() {
        // 波浪翻滚效果 (Rolling wave)
        // 通过正弦和余弦函数交叠，产生类似水面翻滚的错觉
        const waveX = Math.sin(this.ox * 0.005 + time * 0.02) * 30;
        const waveY = Math.cos(this.oy * 0.005 + time * 0.015) * 30;
        const waveZ = Math.sin((this.ox + this.oy) * 0.008 + time * 0.025) * 20; // 模拟深度感

        this.x = this.ox + waveX;
        this.y = this.oy + waveY + waveZ;

        // 鼠标排斥逻辑 (Mouse repulsion)
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 200; // 鼠标影响范围

        // 尺寸根据波浪高度(waveY + waveZ)微调，产生立体起伏感
        let currentRadius = this.baseRadius + (waveY + waveZ + 50) * 0.015; 

        if (distance < maxDistance) {
          const force = (maxDistance - distance) / maxDistance;
          // 使用平方缓动，使排斥像水波荡开一样平滑
          const easeForce = force * force * (3 - 2 * force); 
          
          this.x -= (dx / distance) * easeForce * 50;
          this.y -= (dy / distance) * easeForce * 50;
          currentRadius += easeForce * 2; // 靠近鼠标时波点轻微放大
        }

        if (!ctx) return;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0.5, currentRadius), 0, Math.PI * 2);
        ctx.fillStyle = "#000000"; // 纯黑色波点
        ctx.fill();
      }
    }

    const initParticles = () => {
      particles = [];
      const spacing = 35; // 决定波点的密度
      // 循环时留出画布外部余量，防止波浪拉扯时边缘出现空白
      for (let x = -100; x < canvas.width + 100; x += spacing) {
        for (let y = -100; y < canvas.height + 100; y += spacing) {
          // 交错排布（Hexagonal Grid），让波点阵列更自然，不会形成死板的方块
          const offsetX = (Math.round(y / spacing) % 2 === 0) ? 0 : spacing / 2;
          particles.push(new Particle(x + offsetX, y));
        }
      }
    };

    const drawBackground = () => {
      // 纯白色背景
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const animate = () => {
      time++;
      drawBackground();
      particles.forEach((p) => p.update());
      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
    window.addEventListener("mouseout", () => {
      mouse.x = -1000;
      mouse.y = -1000;
    });

    resize();
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}
