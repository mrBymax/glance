import { Banner } from '@astryxdesign/core/Banner';
import { BottomSheet } from '@astryxdesign/core/BottomSheet';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import type { CurrentPrompt, Receipt } from '@glance/shared';
import { useRef, useState } from 'react';
import { useUi } from '../bridge/BridgeContext';
import { eur } from '../text/format';

type PayPrompt = Extract<CurrentPrompt, { kind: 'pay' }>;
type Answer = { promptId: string; kind: 'yes' | 'no' };

/** Returns the time of the payment in the form of the language. Text that is no time shows as it is. */
function paidTime(paidAt: string, lang: string): string {
  const time = new Date(paidAt);
  if (Number.isNaN(time.getTime())) return paidAt;
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(time);
}

function PayView(props: { prompt: PayPrompt; answer: Answer | null; onAnswer(kind: 'yes' | 'no'): void }) {
  const { prompt, answer, onAnswer } = props;
  const { state, strings } = useUi();
  const given = answer?.promptId === prompt.promptId ? answer.kind : null;
  return (
    <VStack gap={3}>
      <Heading level={2}>{strings.payee(prompt.kiosk.name, prompt.kiosk.store)}</Heading>
      <Text>{strings.items(prompt.itemCount)}</Text>
      <Text type="display-1">{eur(prompt.totalCents)}</Text>
      {prompt.needsBiometric ? <Banner status="info" title={strings.fingerprint} /> : null}
      {state.error ? <Banner status="warning" title={state.error.message} /> : null}
      <Button
        label={prompt.needsBiometric ? strings.payFingerprint : strings.pay}
        variant="primary"
        size="lg"
        width="100%"
        isLoading={given === 'yes'}
        onClick={() => onAnswer('yes')}
      >
        {/* The full name is cut at a font scale of 200 percent. The banner above states the fingerprint. */}
        {strings.pay}
      </Button>
      <Button label={strings.cancel} size="lg" width="100%" isDisabled={given !== null} onClick={() => onAnswer('no')} />
    </VStack>
  );
}

function ReceiptView(props: { receipt: Receipt; onDone(): void }) {
  const { receipt, onDone } = props;
  const { state, strings } = useUi();
  return (
    <VStack gap={3}>
      <Heading level={2}>{strings.paid}</Heading>
      <Text type="display-1">{eur(receipt.totalCents)}</Text>
      <Text>{strings.payee(receipt.kiosk.name, receipt.kiosk.store)}</Text>
      <List hasDividers>
        {receipt.items.map((item) => (
          <ListItem
            key={item.productId}
            label={<Text>{item.name}</Text>}
            description={<Text type="supporting">{strings.cartLine(item.packSize, item.qty, eur(item.unitPriceCents))}</Text>}
          />
        ))}
      </List>
      <Text>{strings.order(receipt.orderId)}</Text>
      <Text>{paidTime(receipt.paidAt, state.profile.lang)}</Text>
      <Text weight="semibold">{strings.demoPayment}</Text>
      <Button label={strings.done} variant="primary" size="lg" width="100%" onClick={onDone} />
    </VStack>
  );
}

/**
 * The pay prompt, and after the payment the receipt.
 * The server sends no event when a payment starts, so the sheet keeps the answer to each prompt ID by itself.
 */
export function CheckoutSheet() {
  const { state, strings, send, dispatch } = useUi();
  // The ref stops a second tap that arrives before the next render.
  const answerRef = useRef<Answer | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);

  const prompt = state.prompt?.kind === 'pay' ? state.prompt : null;
  const receipt = state.checkout === 'paid' ? state.receipt : null;
  // After Cancel the sheet closes at once. The pay prompt stays in the state until the server ends the checkout.
  const isCancelled = prompt !== null && answer?.promptId === prompt.promptId && answer.kind === 'no';
  const isOpen = receipt !== null || (prompt !== null && !isCancelled);

  const onAnswer = (kind: 'yes' | 'no') => {
    if (!prompt || answerRef.current?.promptId === prompt.promptId) return;
    const next = { promptId: prompt.promptId, kind };
    answerRef.current = next;
    setAnswer(next);
    send({ t: 'intent', kind, promptId: prompt.promptId });
  };
  const onDone = () => dispatch({ t: 'local.reset' });
  // A dismissed pay view counts as Cancel. A dismissed receipt counts as Done.
  const onOpenChange = (open: boolean) => {
    if (open) return;
    if (receipt) onDone();
    else onAnswer('no');
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      label={receipt ? strings.receipt : strings.checkout}
      purpose="form"
      height="hug"
    >
      {receipt ? <ReceiptView receipt={receipt} onDone={onDone} /> : null}
      {!receipt && prompt ? <PayView prompt={prompt} answer={answer} onAnswer={onAnswer} /> : null}
    </BottomSheet>
  );
}
