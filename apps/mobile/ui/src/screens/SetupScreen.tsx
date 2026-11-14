import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { List, ListItem } from '@astryxdesign/core/List';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Step, Stepper } from '@astryxdesign/core/Stepper';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import type { NativeState, PageToNative } from '@glance/shared';
import { Camera, Check, Glasses, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useUi } from '../bridge/BridgeContext';
import { Mark } from '../components/Mark';
import { StateBanner } from '../components/StateBanner';
import { setupStepOf } from '../state/selectors';
import type { Strings } from '../text/strings';

/** The Play Store page of the Meta AI app, from the DAT docs (dat/display-overview, Requirements). */
export const META_AI_STORE_URL = 'https://play.google.com/store/apps/details?id=com.facebook.stella';

/**
 * The content of one step. `warning` says why the last try failed, `lead` says what the step is for,
 * and `steps` are the taps of the jump to Meta AI, in their order. `waiting` replaces the button while Meta AI is open.
 */
type StepBody = { warning?: string; lead?: string; steps?: string[]; waiting?: string; button: ReactNode };

const GLYPHS: readonly [LucideIcon, LucideIcon, LucideIcon] = [Glasses, Camera, Check];

function linkBody(native: NativeState, strings: Strings, send: (message: PageToNative) => void): StepBody {
  const register = (label: string) => (
    <Button label={label} variant="primary" size="lg" width="100%" onClick={() => send({ t: 'setup.register' })} />
  );
  if (!native.metaAiInstalled) {
    return {
      lead: strings.metaAiMissing,
      button: <Button label={strings.getMetaAi} variant="primary" size="lg" width="100%" href={META_AI_STORE_URL} />,
    };
  }
  if (native.network === 'offline') return { warning: strings.noInternet, button: register(strings.tryAgain) };
  if (native.registration === 'registering') return { waiting: strings.linking, button: null };
  return { steps: [strings.linkOpens, strings.linkConfirm, strings.linkReturn], button: register(strings.stepLink) };
}

function bodyOf(step: 0 | 1 | 2, native: NativeState, strings: Strings, send: (message: PageToNative) => void): StepBody {
  if (step === 0) return linkBody(native, strings, send);
  if (step === 1) {
    return {
      warning: native.cameraPermission === 'denied' ? strings.cameraDenied : undefined,
      lead: strings.cameraWhy,
      steps: [strings.cameraOpens, strings.cameraChoose, strings.linkReturn],
      button: <Button label={strings.stepCamera} variant="primary" size="lg" width="100%" onClick={() => send({ t: 'setup.requestCamera' })} />,
    };
  }
  return {
    lead: strings.readyText,
    button: <Button label={strings.start} variant="primary" size="lg" width="100%" onClick={() => send({ t: 'session.start' })} />,
  };
}

/**
 * The three setup steps: link the glasses, allow the camera, start. Only the current step shows its text and its button.
 * The text and the button sit in a card below the list of steps, not inside the step. A vertical step indents its content,
 * and at a large font size the label of the button did not fit into the rest of a 360 px screen.
 */
export function SetupScreen() {
  const { state, strings, send } = useUi();
  const { native } = state;
  if (!native) return null;
  const step = setupStepOf(native);
  const body = bodyOf(step, native, strings, send);
  const labels = [strings.stepLink, strings.stepCamera, strings.stepReady];
  return (
    <VStack as="main" className="glance-page" paddingBlock={4} gap={6}>
      <StateBanner />
      <HStack gap={3} vAlign="center">
        <Mark icon={Glasses} />
        <Heading level={1}>{strings.setupTitle}</Heading>
      </HStack>
      <Stepper orientation="vertical" label={strings.setupSteps} activeStep={step}>
        {labels.map((label, index) => (
          <Step key={label} step={index} label={label} />
        ))}
      </Stepper>
      <Card className="glance-card" elevation="low">
        <VStack as="section" gap={4}>
          <HStack gap={3} vAlign="center">
            <Mark icon={GLYPHS[step]} tone={step === 2 ? 'success' : 'muted'} />
            <Heading level={2}>{labels[step]}</Heading>
          </HStack>
          {body.warning ? <Banner status="warning" title={body.warning} /> : null}
          {body.lead ? <Text size="lg" className="glance-wrap">{body.lead}</Text> : null}
          {body.steps ? (
            <List listStyle="decimal">
              {body.steps.map((text) => <ListItem key={text} label={<Text className="glance-wrap">{text}</Text>} />)}
            </List>
          ) : null}
          {body.waiting ? <Spinner size="lg" label={body.waiting} /> : null}
          {body.button}
        </VStack>
      </Card>
    </VStack>
  );
}
