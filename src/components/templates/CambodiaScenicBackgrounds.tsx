import React from 'react';

export type CambodiaScenicTheme =
  | 'palm'      // Riverside palms, warm dusk sky
  | 'angkor'    // Angkor Wat-style temple towers at sunrise
  | 'grove'     // Denser palm grove, cooler daylight
  | 'bayon'     // Bayon-style carved stone face motif
  | 'guardian'  // A second stone-guardian variant, closer crop
  | 'jungle';   // Ta Prohm-style tree roots over ruins

/**
 * Original, license-free illustrated backgrounds evoking six Cambodian
 * landmarks (not photographs — see conversation for why). Each is a plain
 * SVG painted with gradients + simple shapes, sized to fill its container.
 * If a real photo is later dropped in at /public/backgrounds/{theme}.jpg,
 * TemplateCambodiaScenic will show that on top automatically — these stay
 * as the guaranteed-to-render fallback beneath it.
 */
export const CambodiaScenicBackground: React.FC<{ theme: CambodiaScenicTheme }> = ({ theme }) => {
  switch (theme) {
    case 'angkor':
      return (
        <svg viewBox="0 0 800 1131" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          <defs>
            <linearGradient id="angkorSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f7c873" />
              <stop offset="45%" stopColor="#e8895f" />
              <stop offset="100%" stopColor="#7a4a5c" />
            </linearGradient>
            <linearGradient id="angkorSilhouette" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2b2130" />
              <stop offset="100%" stopColor="#120e16" />
            </linearGradient>
          </defs>
          <rect width="800" height="1131" fill="url(#angkorSky)" />
          <circle cx="400" cy="430" r="150" fill="#fbe3a1" opacity="0.55" />
          {/* Water reflection band */}
          <rect y="760" width="800" height="371" fill="#1a1420" opacity="0.35" />
          {/* Central & side temple towers (stylised Angkor-style prasat silhouettes) */}
          {[
            { x: 400, w: 130, h: 430, top: 320 },
            { x: 190, w: 90, h: 300, top: 450 },
            { x: 610, w: 90, h: 300, top: 450 },
            { x: 60, w: 60, h: 200, top: 550 },
            { x: 740, w: 60, h: 200, top: 550 },
          ].map((t, i) => (
            <g key={i} transform={`translate(${t.x - t.w / 2}, ${t.top})`}>
              <path
                d={`M0,${t.h} L0,${t.h * 0.4} L${t.w * 0.5},0 L${t.w},${t.h * 0.4} L${t.w},${t.h} Z`}
                fill="url(#angkorSilhouette)"
              />
              <rect x={t.w * 0.3} y={t.h * 0.5} width={t.w * 0.4} height={t.h * 0.5} fill="url(#angkorSilhouette)" />
            </g>
          ))}
          {/* Palm accents flanking the base */}
          {[70, 730].map((x, i) => (
            <g key={i} transform={`translate(${x}, 760)`} fill="#150f1a">
              <rect x="-6" width="12" height="130" />
              {[-1, -0.4, 0.2, 0.8].map((a, j) => (
                <ellipse key={j} cx={Math.cos(a) * 40} cy={-40 + Math.sin(a) * 10} rx="55" ry="14" transform={`rotate(${a * 40})`} />
              ))}
            </g>
          ))}
        </svg>
      );

    case 'bayon':
    case 'guardian': {
      const closer = theme === 'guardian';
      return (
        <svg viewBox="0 0 800 1131" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          <defs>
            <linearGradient id={`stoneSky-${theme}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dfe4dc" />
              <stop offset="100%" stopColor="#9aa398" />
            </linearGradient>
            <linearGradient id={`stoneFace-${theme}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8a8577" />
              <stop offset="100%" stopColor="#57544a" />
            </linearGradient>
          </defs>
          <rect width="800" height="1131" fill={`url(#stoneSky-${theme})`} />
          {/* Weathered stone-block texture strip */}
          {Array.from({ length: 10 }).map((_, row) =>
            Array.from({ length: 6 }).map((__, col) => (
              <rect
                key={`${row}-${col}`}
                x={col * 140 - (row % 2 === 0 ? 0 : 60)}
                y={row * 115}
                width="130"
                height="105"
                fill="none"
                stroke="#00000012"
                strokeWidth="2"
              />
            ))
          )}
          {/* Large stylised carved face (Bayon-style serene closed-eye visage) */}
          <g transform={closer ? 'translate(400,620) scale(1.35)' : 'translate(400,560) scale(1)'}>
            <ellipse cx="0" cy="0" rx="230" ry="290" fill={`url(#stoneFace-${theme})`} />
            {/* Headdress */}
            <path d="M-230,-120 Q0,-360 230,-120 L230,-40 Q0,-160 -230,-40 Z" fill="#4d4a41" />
            {/* Serene closed eyes */}
            <path d="M-120,-30 Q-80,-55 -40,-30" stroke="#2c2a24" strokeWidth="9" fill="none" strokeLinecap="round" />
            <path d="M40,-30 Q80,-55 120,-30" stroke="#2c2a24" strokeWidth="9" fill="none" strokeLinecap="round" />
            {/* Wide serene mouth */}
            <path d="M-90,90 Q0,140 90,90" stroke="#2c2a24" strokeWidth="10" fill="none" strokeLinecap="round" />
            {/* Nose */}
            <path d="M0,-10 L-14,60 Q0,75 14,60 Z" fill="#4a473f" />
          </g>
          <rect y="900" width="800" height="231" fill="#00000022" />
        </svg>
      );
    }

    case 'jungle':
      return (
        <svg viewBox="0 0 800 1131" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          <defs>
            <linearGradient id="jungleSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cfe0c2" />
              <stop offset="100%" stopColor="#4f6b47" />
            </linearGradient>
          </defs>
          <rect width="800" height="1131" fill="url(#jungleSky)" />
          {/* Ruined stone wall */}
          <rect y="500" width="800" height="631" fill="#6b6455" opacity="0.9" />
          {Array.from({ length: 8 }).map((_, row) =>
            Array.from({ length: 6 }).map((__, col) => (
              <rect
                key={`${row}-${col}`}
                x={col * 140 - (row % 2 === 0 ? 0 : 60)}
                y={500 + row * 90}
                width="130"
                height="82"
                fill="none"
                stroke="#00000018"
                strokeWidth="2"
              />
            ))
          )}
          {/* Sprawling tree roots (organic bezier shapes) climbing over the wall */}
          <g fill="#3c2c22" opacity="0.92">
            <path d="M120,300 C60,420 260,470 220,620 C190,760 340,820 300,1000 C280,1080 340,1120 400,1131 L360,1131 C300,1050 260,1000 280,900 C300,780 160,720 190,600 C210,500 40,440 120,300 Z" />
            <path d="M620,260 C700,380 520,440 560,600 C590,730 460,800 500,980 C520,1070 460,1120 400,1131 L440,1131 C500,1040 540,1000 520,900 C500,780 640,720 610,600 C590,500 720,420 620,260 Z" />
          </g>
          {/* Canopy silhouette at the very top */}
          <path d="M0,180 Q100,80 200,170 Q300,60 400,160 Q500,50 600,170 Q700,80 800,180 L800,0 L0,0 Z" fill="#2f4a2a" />
        </svg>
      );

    case 'grove':
      return (
        <svg viewBox="0 0 800 1131" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          <defs>
            <linearGradient id="groveSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a9d6d1" />
              <stop offset="100%" stopColor="#dff0d8" />
            </linearGradient>
          </defs>
          <rect width="800" height="1131" fill="url(#groveSky)" />
          <rect y="850" width="800" height="281" fill="#8ba888" opacity="0.5" />
          {[
            [90, 1131, 260],
            [230, 1131, 340],
            [370, 1131, 300],
            [520, 1131, 380],
            [660, 1131, 250],
          ].map(([x, base, h], i) => (
            <g key={i} transform={`translate(${x}, ${base - h})`}>
              <rect x="-7" y={h * 0.15} width="14" height={h * 0.85} fill="#4a5a34" />
              {[-1.1, -0.5, 0.1, 0.7, 1.2].map((a, j) => (
                <ellipse
                  key={j}
                  cx={Math.cos(a) * 60}
                  cy={Math.sin(a) * 16}
                  rx="70"
                  ry="16"
                  fill={j % 2 === 0 ? '#5c7a3e' : '#6f9048'}
                  transform={`rotate(${a * 42})`}
                />
              ))}
            </g>
          ))}
        </svg>
      );

    case 'palm':
    default:
      return (
        <svg viewBox="0 0 800 1131" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          <defs>
            <linearGradient id="palmSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffd9a0" />
              <stop offset="55%" stopColor="#ff9d6c" />
              <stop offset="100%" stopColor="#c96b7d" />
            </linearGradient>
          </defs>
          <rect width="800" height="1131" fill="url(#palmSky)" />
          <circle cx="580" cy="360" r="110" fill="#fff1cf" opacity="0.65" />
          <rect y="820" width="800" height="311" fill="#7a3a4a" opacity="0.4" />
          {[
            [60, 1131, 520, -8],
            [740, 1131, 470, 8],
            [140, 1131, 300, -14],
          ].map(([x, base, h, lean], i) => (
            <g key={i} transform={`translate(${x}, ${base - h}) rotate(${lean})`}>
              <rect x="-9" width="18" height={h} fill="#241017" />
              {[-1.2, -0.6, 0, 0.6, 1.2].map((a, j) => (
                <ellipse
                  key={j}
                  cx={Math.cos(a) * 70}
                  cy={Math.sin(a) * 18}
                  rx="90"
                  ry="18"
                  fill="#2c1a1f"
                  transform={`rotate(${a * 42})`}
                />
              ))}
            </g>
          ))}
        </svg>
      );
  }
};

/** Public path a real photo would need for this theme to auto-replace the illustration. */
export const scenicBackgroundImagePath = (theme: CambodiaScenicTheme): string =>
  `/backgrounds/${theme}.jpg`;
