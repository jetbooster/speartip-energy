import { keyframes } from '@emotion/react';
import Box from '@mui/material/Box';

export type FlowAxis = 'horizontal' | 'vertical';

interface FlowArrowProps {
  // Positive flow points right (horizontal) or up (vertical); negative points the other way.
  axis: FlowAxis;
  kw: number;
  // Flips which way the arrow points for a given sign of kw.
  inverted?: boolean;
  left: string;
  top: string;
  active?: boolean;
}

// Dims the arrow when the screen is idle, to mimic the backlight at minimum.
const INACTIVE_FILTER = 'brightness(40%)';

const FLOW_GREEN = '#2ecc40';
const FLOW_RED = '#ff4136';
const FLOW_EPSILON = 0.005;

// Everything is sized in em from this base, which scales with the smaller viewport dimension.
// Reaches 16px (the desktop look) at 1300px and is clamped so phones stay readable.
const BASE_FONT_SIZE = 'clamp(10px, calc(min(100vw, 100vh) * 0.0123), 16px)';

// Matches the old 100px drawing size at the 16px base.
const DRAWN_SIZE_EM = 6.25;
// Coordinate space for the chevrons; the SVG scales to DRAWN_SIZE_EM.
const SIZE = 100;
// Ordered from the back of the arrow to the front, so each lights up in turn and
// the cycle appears to travel along the direction of flow.
const CHEVRON_OFFSETS = [-25, 0, 25];
const CHEVRON_ARM = 13;
const CHEVRON_SPREAD = 20;
const FRAME_MS = 500;
const CYCLE_MS = FRAME_MS * CHEVRON_OFFSETS.length;

// Each chevron is lit for one FRAME_MS slot of the cycle, peaking halfway through it.
const fade = keyframes`
  0% { opacity: 0.2; }
  16.7% { opacity: 1; }
  33.3% { opacity: 0.2; }
  100% { opacity: 0.2; }
`;

const formatKw = (kw: number) => (Math.abs(kw) < 1
  ? `${Math.round(Math.abs(kw) * 1000)} W`
  : `${Math.abs(kw).toFixed(1)} kW`);

export default function FlowArrow({ axis, kw, inverted = false, left, top, active = false }: FlowArrowProps) {
  // Green when the arrow points in its forward direction (right or up), red when it points back.
  const sign = (kw > 0 ? 1 : -1) * (inverted ? -1 : 1);
  const [ux, uy] = axis === 'horizontal' ? [sign, 0] : [0, -sign];
  const [px, py] = [-uy, ux];
  const colour = sign > 0 ? FLOW_GREEN : FLOW_RED;
  const centre = SIZE / 2;

  if (Math.abs(kw) < FLOW_EPSILON) {
    return null;
  }

  const chevronPoints = (offset: number) => {
    const tipX = centre + ux * (offset + CHEVRON_ARM);
    const tipY = centre + uy * (offset + CHEVRON_ARM);
    const backX = centre + ux * (offset - CHEVRON_ARM);
    const backY = centre + uy * (offset - CHEVRON_ARM);
    return [
      [backX + px * CHEVRON_SPREAD, backY + py * CHEVRON_SPREAD],
      [tipX, tipY],
      [backX - px * CHEVRON_SPREAD, backY - py * CHEVRON_SPREAD],
    ].map(([x, y]) => `${x},${y}`).join(' ');
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        left,
        top,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.125em',
        fontSize: BASE_FONT_SIZE,
        pointerEvents: 'none',
        zIndex: 1,
        color: colour,
        filter: active ? undefined : INACTIVE_FILTER,
      }}
    >

      <Box
        component="svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        sx={{ width: `${DRAWN_SIZE_EM}em`, height: `${DRAWN_SIZE_EM}em`, overflow: 'visible' }}
      >
        {CHEVRON_OFFSETS.map((offset, i) => (
          <Box
            component="polyline"
            key={offset}
            points={chevronPoints(offset)}
            fill="none"
            stroke={colour}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            sx={{
              opacity: 0.2,
              animation: `${fade} ${CYCLE_MS}ms ease-in-out ${i * FRAME_MS}ms infinite`,
            }}
          />
        ))}
      </Box>
      <Box
        component="span"
        sx={{ fontWeight: 600, fontSize: '1.5em', whiteSpace: 'nowrap', order: axis === 'vertical' ? 2 : 0 }}
      >
        {formatKw(kw)}
      </Box>
    </Box>
  );
}
