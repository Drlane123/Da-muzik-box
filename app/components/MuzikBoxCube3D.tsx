'use client';

import { memo } from 'react';

const HALF = 150;
const CORNERS = [
  [1, 1, 1],
  [1, 1, -1],
  [1, -1, 1],
  [1, -1, -1],
  [-1, 1, 1],
  [-1, 1, -1],
  [-1, -1, 1],
  [-1, -1, -1],
] as const;

function FaceTexture({ face }: { face: 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom' }) {
  return <div className={`muzik-boot-face-tex muzik-boot-face-tex--${face}`} />;
}

const CubeCorners = memo(function CubeCorners() {
  return (
    <>
      {CORNERS.map(([x, y, z], i) => (
        <span
          key={i}
          className="muzik-boot-cube-corner"
          style={{
            ['--cx' as string]: `${x * HALF}px`,
            ['--cy' as string]: `${y * HALF}px`,
            ['--cz' as string]: `${z * HALF}px`,
          }}
        />
      ))}
    </>
  );
});

/** Gold speaker cube — rotates in dark space on the boot splash. */
export const MuzikBoxCube3D = memo(function MuzikBoxCube3D() {
  return (
    <div className="muzik-boot-scene">
      <div className="muzik-boot-cube-spin">
        <div className="muzik-boot-cube">
          <CubeCorners />
          <div className="muzik-boot-face muzik-boot-face--front">
            <FaceTexture face="front" />
          </div>
          <div className="muzik-boot-face muzik-boot-face--back">
            <FaceTexture face="back" />
          </div>
          <div className="muzik-boot-face muzik-boot-face--right">
            <FaceTexture face="right" />
          </div>
          <div className="muzik-boot-face muzik-boot-face--left">
            <FaceTexture face="left" />
          </div>
          <div className="muzik-boot-face muzik-boot-face--top">
            <FaceTexture face="top" />
          </div>
          <div className="muzik-boot-face muzik-boot-face--bottom">
            <FaceTexture face="bottom" />
          </div>
        </div>
      </div>
    </div>
  );
});
