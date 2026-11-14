import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import type { CurrentPrompt } from '@glance/shared';
import { useRef, useState } from 'react';
import { useUi } from '../bridge/BridgeContext';
import { eur, warningText } from '../text/format';

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
    <Card>
      <VStack gap={3}>
        <Heading level={2}>{prompt.product.name}</Heading>
        <Text>{prompt.product.packSize}</Text>
        <Text type="display-1">{eur(prompt.product.priceCents)}</Text>
        {inCart ? <Text>{strings.inCart(prompt.qtyInCart)}</Text> : null}
        {prompt.warnings.map((warning) => {
          const text = warningText(warning, strings);
          return <Banner key={text} status="warning" title={text} />;
        })}
        <Button
          label={inCart ? strings.addAnother : strings.add}
          variant="primary"
          size="lg"
          width="100%"
          isDisabled={isAnswered}
          onClick={() => answer('yes')}
        />
        <Button
          label={inCart ? strings.removeOne : strings.skip}
          size="lg"
          width="100%"
          isDisabled={isAnswered}
          onClick={() => answer('no')}
        />
      </VStack>
    </Card>
  );
}
