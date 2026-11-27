import type { BarElementSlots } from '@mui/x-charts/BarChart';
import { animated, type SpringValue, to } from '@react-spring/web';
import type { ComponentProps, ComponentType } from 'react';

// Space left between stacked pieces, in px. Each piece gives up half of it at each end, so a stack is drawn
// slightly shorter than its value. It's 2px against a chart a few hundred px tall, so the readings barely move.
const GAP = 2;
// SVG shrinks this to fit, so short pieces still come out as round-ended pills.
const RADIUS = 5;

type BarProps = ComponentProps<NonNullable<BarElementSlots['bar']>>;

type Animated = SpringValue<number> | number;

// x-charts types `style` as CSS, but what it passes is the bar's animated geometry.
interface BarGeometry {
  x: Animated;
  y: Animated;
  width: Animated;
  height: Animated;
}

// react-spring's SVG typings reject x/y/width/height with React 19's types, though they work at runtime.
const AnimatedRect = animated('rect') as unknown as ComponentType<Record<string, unknown>>;

// Stand-in for x-charts' bar, for stacked charts: every piece has all four corners rounded and a small gap from
// its neighbours, rather than one rounded top for the whole stack.
export default function GappedBar({ ownerState, style, ...rest }: BarProps) {
  const { x, y, width, height } = style as unknown as BarGeometry;
  return (
    <AnimatedRect
      {...rest}
      x={x}
      width={width}
      y={to([y, height], (top: number, h: number) => top + Math.min(GAP / 2, h / 2))}
      height={to([height], (h: number) => Math.max(h - GAP, 0))}
      rx={RADIUS}
      fill={ownerState.color}
    />
  );
}
