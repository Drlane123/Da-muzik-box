'use client';

import { memo, useEffect, useRef } from 'react';

const BOOT_CUBE_VIDEO_WEBM = '/splash/boot-cube-spin.webm';
const BOOT_CUBE_VIDEO_MP4 = '/splash/boot-cube-spin.mp4';

/** Centered spinning cube — transparent WebM, gold box only. */
export const MuzikBootBackdropVideo = memo(function MuzikBootBackdropVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  return (
    <video
      ref={videoRef}
      className="muzik-boot-cube-video"
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden
      tabIndex={-1}
    >
      <source src={BOOT_CUBE_VIDEO_WEBM} type="video/webm" />
      <source src={BOOT_CUBE_VIDEO_MP4} type="video/mp4" />
    </video>
  );
});
