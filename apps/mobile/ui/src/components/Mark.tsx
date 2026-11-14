import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import type { LucideIcon } from 'lucide-react';

/**
 * A glyph in a disc: the mark of a screen or a state. It is decorative, because a heading or a text next to it says the same.
 * The tone keeps the role of its color: accent for Glance, success for a payment, muted for a waiting state.
 */
export function Mark(props: { icon: LucideIcon; tone?: 'accent' | 'success' | 'muted'; isLarge?: boolean }) {
  const { icon, tone = 'accent', isLarge = false } = props;
  const className = ['glance-mark', `glance-mark--${tone}`, isLarge ? 'glance-mark--lg' : ''].filter(Boolean).join(' ');
  return (
    <HStack className={className} hAlign="center" vAlign="center">
      <Icon icon={icon} size="lg" />
    </HStack>
  );
}
