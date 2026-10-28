'use client';

import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Fab, Zoom } from '@mui/material';
import { useEffect, useState } from 'react';

interface ScrollToTopFabProps {
  /** Use "window" on pages without a dedicated scrolling element. */
  scrollContainerId?: string;
  threshold?: number;
}

const ScrollToTopFab = ({
  scrollContainerId = 'scroll-container',
  threshold = 300,
}: ScrollToTopFabProps) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const element =
      scrollContainerId === 'window'
        ? null
        : document.getElementById(scrollContainerId);
    const target = element || window;
    const update = () =>
      setShow((element ? element.scrollTop : window.scrollY) > threshold);
    update();
    target.addEventListener('scroll', update, { passive: true });
    return () => target.removeEventListener('scroll', update);
  }, [scrollContainerId, threshold]);
  const scrollToTop = () => {
    const element =
      scrollContainerId === 'window'
        ? null
        : document.getElementById(scrollContainerId);
    (element || window).scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <Zoom in={show}>
      <Fab
        size='small'
        aria-label='返回顶部'
        onClick={scrollToTop}
        sx={{
          position: 'fixed',
          bottom: 20,
          right: 16,
          zIndex: 10000,
          bgcolor: 'background.paper3',
          color: 'text.primary',
          '&:hover': { bgcolor: 'background.paper2' },
        }}
      >
        <KeyboardArrowUpIcon sx={{ fontSize: 24 }} />
      </Fab>
    </Zoom>
  );
};
export default ScrollToTopFab;
