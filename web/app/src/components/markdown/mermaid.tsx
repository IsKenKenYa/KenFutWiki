// components/MermaidDiagram.jsx
'use client'; // 必须在客户端组件中使用

import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { useTranslations } from 'next-intl';
import { sanitizeMermaidSvg } from '../markdown2/sanitizeMermaidSvg';

const MERMAID_CONFIG = {
  startOnLoad: false,
  theme: 'default' as const,
  securityLevel: 'strict' as const,
  fontFamily: 'inherit',
  suppressErrorRendering: true,
};

const MermaidDiagram = ({ chart }: { chart: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMermaidInitialized = useRef(false);
  const t = useTranslations('markdown');

  useEffect(() => {
    if (!containerRef.current || !chart) return;

    // 初始化 Mermaid
    if (!isMermaidInitialized.current) {
      mermaid.initialize(MERMAID_CONFIG);
      isMermaidInitialized.current = true;
    }

    // 清理容器
    containerRef.current.innerHTML = '';

    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, chart);
        const safeSvg = sanitizeMermaidSvg(svg);
        if (safeSvg && containerRef.current) {
          containerRef.current.innerHTML = safeSvg;
        }
      } catch (error: any) {
        // 渲染失败时显示纯文本提示（textContent 避免 error.message 注入 HTML）
        if (containerRef.current) {
          const container = containerRef.current;
          container.textContent = '';
          const tip = document.createElement('div');
          tip.textContent = `${t('mermaidError')}: ${error?.message ?? ''}`;
          container.appendChild(tip);
        }
      }
    };
    renderDiagram();
  }, [chart, t]);

  return <div ref={containerRef} className='mermaid-container' />;
};

export default MermaidDiagram;
