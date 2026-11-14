import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import type { LucideIcon } from 'lucide-react';

/**
 * A glyph in a disc: the mark of a screen or a state. It is decorative, because a heading or a text next to it says the same.
 * The tone keeps the role of its color: success for a payment, muted for each other state. The logo marks Glance itself.
 */
export function Mark(props: { icon: LucideIcon; tone?: 'success' | 'muted'; isLarge?: boolean }) {
  const { icon, tone = 'muted', isLarge = false } = props;
  const className = ['glance-mark', `glance-mark--${tone}`, isLarge ? 'glance-mark--lg' : ''].filter(Boolean).join(' ');
  return (
    <HStack className={className} hAlign="center" vAlign="center">
      <Icon icon={icon} size="lg" />
    </HStack>
  );
}
