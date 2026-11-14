import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { Step, Stepper } from '@astryxdesign/core/Stepper';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import type { NativeState, PageToNative } from '@glance/shared';
import type { ReactNode } from 'react';
import { useUi } from '../bridge/BridgeContext';
import { StateBanner } from '../components/StateBanner';
import { setupStepOf } from '../state/selectors';
import type { Strings } from '../text/strings';

/** The Play Store page of the Meta AI app, from the DAT docs (dat/display-overview, Requirements). */
export const META_AI_STORE_URL = 'https://play.google.com/store/apps/details?id=com.facebook.stella';

type StepBody = { texts: string[]; button: ReactNode };

function linkBody(native: NativeState, strings: Strings, send: (message: PageToNative) => void): StepBody {
  const register = (label: string) => (
    <Button label={label} variant="primary" size="lg" width="100%" onClick={() => send({ t: 'setup.register' })} />
  );
  if (!native.metaAiInstalled) {
    return {
      texts: [strings.metaAiMissing],
      button: <Button label={strings.getMetaAi} variant="primary" size="lg" width="100%" href={META_AI_STORE_URL} />,
    };
  }
  if (native.network === 'offline') return { texts: [strings.noInternet], button: register(strings.tryAgain) };
  if (native.registration === 'registering') return { texts: [strings.linking], button: null };
  return { texts: [strings.linkOpens, strings.linkConfirm, strings.linkReturn], button: register(strings.stepLink) };
}

function bodyOf(step: 0 | 1 | 2, native: NativeState, strings: Strings, send: (message: PageToNative) => void): StepBody {
  if (step === 0) return linkBody(native, strings, send);
  if (step === 1) {
    const denied = native.cameraPermission === 'denied' ? [strings.cameraDenied] : [];
    return {
      texts: [...denied, strings.cameraWhy, strings.cameraOpens, strings.cameraChoose, strings.linkReturn],
      button: <Button label={strings.stepCamera} variant="primary" size="lg" width="100%" onClick={() => send({ t: 'setup.requestCamera' })} />,
    };
  }
  return {
    texts: [strings.readyText],
    button: <Button label={strings.start} variant="primary" size="lg" width="100%" onClick={() => send({ t: 'session.start' })} />,
  };
}

/** The three setup steps: link the glasses, allow the camera, start. Only the current step shows its text and its button. */
export function SetupScreen() {
  const { state, strings, send } = useUi();
  const { native } = state;
  if (!native) return null;
  const step = setupStepOf(native);
  const body = bodyOf(step, native, strings, send);
  const content = (
    <VStack gap={3}>
      {body.texts.map((text) => <Text key={text}>{text}</Text>)}
      {body.button}
    </VStack>
  );
  const labels = [strings.stepLink, strings.stepCamera, strings.stepReady];
  return (
    <VStack as="main" padding={4} gap={4}>
      <StateBanner />
      <Heading level={1}>{strings.setupTitle}</Heading>
      <Stepper orientation="vertical" label={strings.setupSteps} activeStep={step}>
        {labels.map((label, index) => (
          <Step key={label} step={index} label={label}>{index === step ? content : null}</Step>
        ))}
      </Stepper>
    </VStack>
  );
}
