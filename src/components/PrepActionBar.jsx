import React, { useLayoutEffect, useRef } from 'react';

export default function PrepActionBar({ children, className }) {
  const bar = useRef(null);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const prior = root.style.getPropertyValue('--chaos-prep-action-bar-height');
    const measure = () => root.style.setProperty('--chaos-prep-action-bar-height', `${Math.ceil(bar.current?.getBoundingClientRect().height || 0)}px`);
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (bar.current) observer?.observe(bar.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect(); window.removeEventListener('resize', measure);
      if (prior) root.style.setProperty('--chaos-prep-action-bar-height', prior);
      else root.style.removeProperty('--chaos-prep-action-bar-height');
    };
  }, []);
  return <div ref={bar} data-testid="prep-action-bar" className={className}>{children}</div>;
}
