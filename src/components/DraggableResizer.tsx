import React, { useCallback, useEffect, useRef, useState } from 'react';

interface DraggableResizerProps {
  onResize: (leftWidth: number) => void;
  minLeftWidth?: number;
  minRightWidth?: number;
}

const HANDLE_WIDTH = 10;

function DraggableResizer({
  onResize,
  minLeftWidth = 300,
  minRightWidth = 300
}: DraggableResizerProps) {
  const resizerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const boundsRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });

  const calculateBounds = useCallback(() => {
    if (!resizerRef.current?.parentElement) return;

    const parentWidth = resizerRef.current.parentElement.clientWidth;
    const maxWidth = parentWidth - HANDLE_WIDTH;

    boundsRef.current = {
      left: minLeftWidth,
      right: maxWidth - minRightWidth
    };
  }, [minLeftWidth, minRightWidth]);

  const handleDrag = useCallback((e: MouseEvent) => {
    if (!isDragging || !resizerRef.current?.parentElement) return;

    const parentRect = resizerRef.current.parentElement.getBoundingClientRect();
    let newX = e.clientX - parentRect.left;

    // 限制拖动范围
    const { left, right } = boundsRef.current;
    newX = Math.max(left, Math.min(right, newX));
    onResize(newX);
  }, [isDragging, onResize]);

  const handleMouseDown = () => {
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  useEffect(() => {
    calculateBounds();
    window.addEventListener('resize', calculateBounds);
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('resize', calculateBounds);
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [calculateBounds, handleDrag]);

  return (
    <div
      ref={resizerRef}
      className={`w-3 h-full cursor-col-resize flex items-center justify-center transition-opacity opacity-0 hover:opacity-100 ${
        isDragging ? 'opacity-100' : ''
      }`}
      onMouseDown={handleMouseDown}
    >
      <div className="w-0.5 h-12 bg-gray-300 opacity-20 hover:opacity-40" />
    </div>
  );
}


export default DraggableResizer