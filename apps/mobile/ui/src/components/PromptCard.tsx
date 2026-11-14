import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import type { CurrentPrompt } from '@glance/shared';
import { ShoppingCart } from 'lucide-react';
import { useRef, useState } from 'react';
import { useUi } from '../bridge/BridgeContext';
import { eur, warningText } from '../text/format';

/**
 * The card of the product that the voice just named: the name, the pack size, the price, each warning, and the answers.
 * The price is the largest text of the screen, because a shopper needs it first.
 */
export function PromptCard(props: { prompt: Extract<CurrentPrompt, { kind: 'product' }> }) {
  const { prompt } = props;
  const { send, strings } = useUi();
  // A second answer can undo an add on the server, so the card sends one answer for each prompt ID.
  // The ref stops a second tap that arrives before the next render.
  const answeredRef = useRef<string | null>(null);
  const [answered, setAnswered] = useState<string | null>(null);
  const isAnswered = answered === prompt.promptId;
  const inCart = prompt.mode === 'inCart';

  const answer = (kind: 'yes' | 'no') => {
    if (answeredRef.current === prompt.promptId) return;
    answeredRef.current = prompt.promptId;
    setAnswered(prompt.promptId);
    send({ t: 'intent', kind, promptId: prompt.promptId });
  };

  return (
    <Card className="glance-card" elevation="low">
      <VStack gap={4}>
        <VStack gap={1}>
          {inCart ? (
            <HStack gap={1.5} vAlign="center">
              <Icon icon={ShoppingCart} size="sm" color="secondary" />
              <Text type="supporting" weight="medium">{strings.inCart(prompt.qtyInCart)}</Text>
            </HStack>
          ) : null}
          <Heading level={2} className="glance-title">{prompt.product.name}</Heading>
          <Text type="large" color="secondary">{prompt.product.packSize}</Text>
        </VStack>
        <Text className="glance-amount" display="block">{eur(prompt.product.priceCents)}</Text>
        {prompt.warnings.map((warning) => {
          const text = warningText(warning, strings);
          return <Banner key={text} status="warning" title={text} />;
        })}
        <HStack className="glance-pair" gap={2} wrap="wrap">
          <Button
            label={inCart ? strings.addAnother : strings.add}
            variant="primary"
            size="lg"
            isDisabled={isAnswered}
            onClick={() => answer('yes')}
          />
          <Button
            label={inCart ? strings.removeOne : strings.skip}
            size="lg"
            isDisabled={isAnswered}
            onClick={() => answer('no')}
          />
        </HStack>
      </VStack>
    </Card>
  );
}
