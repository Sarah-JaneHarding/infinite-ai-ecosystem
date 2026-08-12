// @infinite-ai/design-system — Design tokens, components and the infinity mark.
// Stage 14: full implementation.

export { COLORS, SPECTRUM, FONTS, SPACE, RADIUS, MOTION, CARD_GRADIENT } from './tokens';
export { InfinityMark } from './components/InfinityMark';
export { Button } from './components/Button';
export { Card, ModularCard } from './components/Card';
export { Badge } from './components/Badge';
export { StatusPill } from './components/StatusPill';

export type { InfinityMarkProps } from './components/InfinityMark';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button';
export type { CardProps, ModularCardProps, CardHue } from './components/Card';
export type { BadgeProps, BadgeVariant } from './components/Badge';
export type { StatusPillProps, PillStatus } from './components/StatusPill';

export const PACKAGE_NAME = '@infinite-ai/design-system' as const;
