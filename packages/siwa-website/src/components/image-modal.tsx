"use client";

import { useState, useEffect, useRef } from "react";

interface ImageModalProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}

export function ImageModal({
  src,
  alt,
  className = "",
  width,
  height,
}: ImageModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPinchDistance = useRef<number | null>(null);

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;
  const ZOOM_STEP = 0.2;

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleClose = () => {
    resetZoom();
    setIsOpen(false);
  };

  const handleZoom = (delta: number, centerX?: number, centerY?: number) => {
    setScale((prevScale) => {
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prevScale + delta));
      
      if (centerX !== undefined && centerY !== undefined && imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        const imageCenterX = rect.left + rect.width / 2;
        const imageCenterY = rect.top + rect.height / 2;
        
        const scaleChange = newScale / prevScale;
        const newX = centerX - (centerX - imageCenterX) * scaleChange;
        const newY = centerY - (centerY - imageCenterY) * scaleChange;
        
        setPosition({ x: newX - imageCenterX, y: newY - imageCenterY });
      }
      
      return newScale;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isOpen) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    handleZoom(delta, e.clientX, e.clientY);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      lastPinchDistance.current = distance;
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDistance.current !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const delta = (distance - lastPinchDistance.current) * 0.01;
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      handleZoom(delta, centerX, centerY);
      lastPinchDistance.current = distance;
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    lastPinchDistance.current = null;
    setIsDragging(false);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      resetZoom();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
    }
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`${className} cursor-pointer hover:opacity-90 transition-opacity`}
        width={width}
        height={height}
        onClick={() => setIsOpen(true)}
      />
      {isOpen && (
        <div
          ref={containerRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={(e) => {
            if (e.target === containerRef.current) {
              handleClose();
            }
          }}
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <button
            className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-2"
            onClick={handleClose}
            aria-label="Close image"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="flex flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={src}
              alt={alt}
              className="max-w-full max-h-[calc(100vh-120px)] object-contain select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
                transition: isDragging ? "none" : "transform 0.1s ease-out",
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (scale === 1) {
                  handleClose();
                }
              }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              draggable={false}
            />

            <div className="flex gap-2 z-10">
              <button
                className="text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => handleZoom(ZOOM_STEP)}
                aria-label="Zoom in"
                disabled={scale >= MAX_SCALE}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
              <button
                className="text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => handleZoom(-ZOOM_STEP)}
                aria-label="Zoom out"
                disabled={scale <= MIN_SCALE}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
              {scale > 1 && (
                <button
                  className="text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-2"
                  onClick={resetZoom}
                  aria-label="Reset zoom"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M3 21v-5h5" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
