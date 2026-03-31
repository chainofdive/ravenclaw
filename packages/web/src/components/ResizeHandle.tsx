import { useCallback, useRef } from 'react';

interface Props {
  side: 'left' | 'right';
  onResize: (delta: number) => void;
}

export function ResizeHandle({ side, onResize }: Props) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientX - lastX.current;
      lastX.current = ev.clientX;
      // For right-side panel, dragging left = wider (negative delta = positive width)
      onResize(side === 'right' ? -delta : delta);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [onResize, side]);

  return (
    <div
      onMouseDown={onMouseDown}
      className={`absolute top-0 bottom-0 w-1.5 cursor-col-resize z-10 group ${
        side === 'right' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'
      }`}
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-transparent group-hover:bg-teal-400 transition-colors" />
    </div>
  );
}
