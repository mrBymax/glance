import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { BottomSheet } from '@astryxdesign/core/BottomSheet';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { Divider } from '@astryxdesign/core/Divider';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { EU_ALLERGENS, LANGS, type Profile } from '@glance/shared';
import { ExternalLink, Trash2, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { useUi } from '../bridge/BridgeContext';
import { BrowserBridge } from '../bridge/browserBridge';
import { LANGUAGE_NAMES } from '../text/strings';

/** Five steps in place of a slider: the thumb of the Astryx Slider is below 48 px. */
export const SPEECH_RATES = [0.8, 1, 1.2, 1.5, 2] as const;

const DETAILS = ['brief', 'standard', 'detailed'] as const;
const MAIN_YES = ['head', 'touch', 'voice', 'phone', 'key'] as const;
const TOGGLES = ['headGestures', 'haptics'] as const;
const DIETS = ['vegan', 'vegetarian'] as const;
const IN_VIEW = 'inView';

/** The Open Database License asks for this attribution where the data shows. */
export const OPEN_FOOD_FACTS_URL = 'https://openfoodfacts.org';

function nearestRate(rate: number): number {
  return SPEECH_RATES.reduce<number>((best, value) => (Math.abs(value - rate) < Math.abs(best - rate) ? value : best), SPEECH_RATES[0]);
}

type Option = readonly [value: string, label: string];

/**
 * One preference with 2 to 5 values, as one radio row for each value. A row holds a label of each length at a font
 * scale of 200 percent. A segmented control cut "While in view" and "Phone" on a 360 px screen.
 */
function Choice(props: { label: string; value: string; options: readonly Option[]; onChange(value: string): void }) {
  return (
    <RadioList label={props.label} value={props.value} onChange={props.onChange} width="100%">
      {props.options.map(([value, label]) => <RadioListItem key={value} value={value} label={label} />)}
    </RadioList>
  );
}

export function SettingsSheet(props: { isOpen: boolean; onClose(): void }) {
  const { isOpen, onClose } = props;
  const { state, strings, bridge, send, dispatch, setProfile } = useUi();
  const { profile } = state;
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  // A browser page that goes to another address loses its session. The WebView needs no target: the app opens the link outside.
  const outside = bridge instanceof BrowserBridge ? { target: '_blank', rel: 'noopener noreferrer' } : {};

  // A list reports all its values. The patch holds only the key that changed.
  const onSwitches = (keys: readonly ('headGestures' | 'haptics' | 'vegan' | 'vegetarian')[]) => (values: string[]) => {
    for (const key of keys) {
      const isOn = values.includes(key);
      if (isOn !== profile[key]) setProfile({ [key]: isOn });
    }
  };
  const deleteData = () => {
    send({ t: 'data.delete' });
    dispatch({ t: 'local.reset' });
    setDeleteOpen(false);
    onClose();
  };

  const yesLabels: Record<Profile['mainYes'], string> = {
    head: strings.yesHead, touch: strings.yesTouch, voice: strings.yesVoice, phone: strings.yesPhone, key: strings.yesKey,
  };

  return (
    <>
      <BottomSheet isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} label={strings.settings} height="tall" padding={0}>
        <VStack className="glance-sheet" gap={5}>
          <Heading level={2}>{strings.settings}</Heading>
          <Choice
            label={strings.voiceDetail}
            value={profile.detail}
            options={DETAILS.map((detail): Option => [detail, strings[detail]])}
            onChange={(value) => {
              const detail = DETAILS.find((key) => key === value);
              if (detail) setProfile({ detail });
            }}
          />
          <VStack gap={3}>
            <Choice
              label={strings.speechSpeed}
              value={String(nearestRate(profile.speechRate))}
              options={SPEECH_RATES.map((rate): Option => [String(rate), strings.rate(rate)])}
              onChange={(value) => {
                const speechRate = SPEECH_RATES.find((rate) => String(rate) === value);
                if (speechRate !== undefined) setProfile({ speechRate });
              }}
            />
            <Button label={strings.playSample} icon={<Icon icon={Volume2} />} size="lg" width="100%" onClick={() => send({ t: 'intent', kind: 'help' })} />
          </VStack>
          <Divider />
          <CheckboxList
            label={strings.inputAndFeedback}
            density="spacious"
            hasDividers
            value={TOGGLES.filter((key) => profile[key])}
            onChange={onSwitches(TOGGLES)}
          >
            <CheckboxListItem value="headGestures" label={strings.headGestures} />
            <CheckboxListItem value="haptics" label={strings.haptics} />
          </CheckboxList>
          <Choice
            label={strings.gestureMeaning}
            value={profile.yesGesture}
            options={[['nod', strings.nodIsYes], ['shake', strings.shakeIsYes]]}
            onChange={(value) => setProfile({ yesGesture: value === 'shake' ? 'shake' : 'nod' })}
          />
          <Choice
            label={strings.headWindow}
            value={profile.headWindowMs === null ? IN_VIEW : String(profile.headWindowMs)}
            options={[['8000', strings.window8], ['15000', strings.window15], [IN_VIEW, strings.windowInView]]}
            onChange={(value) => setProfile({ headWindowMs: value === IN_VIEW ? null : value === '15000' ? 15000 : 8000 })}
          />
          <Choice
            label={strings.mainYes}
            value={profile.mainYes}
            options={MAIN_YES.map((key): Option => [key, yesLabels[key]])}
            onChange={(value) => {
              const mainYes = MAIN_YES.find((key) => key === value);
              if (mainYes) setProfile({ mainYes });
            }}
          />
          <Divider />
          <CheckboxList
            label={strings.allergens}
            density="spacious"
            hasDividers
            value={profile.allergens}
            // The patch holds the full list, in the order of the EU list.
            onChange={(values) => setProfile({ allergens: EU_ALLERGENS.filter((key) => values.includes(key)) })}
          >
            {EU_ALLERGENS.map((key) => <CheckboxListItem key={key} value={key} label={strings.allergenNames[key]} />)}
          </CheckboxList>
          <CheckboxList
            label={strings.diet}
            density="spacious"
            hasDividers
            value={DIETS.filter((key) => profile[key])}
            onChange={onSwitches(DIETS)}
          >
            <CheckboxListItem value="vegan" label={strings.vegan} />
            <CheckboxListItem value="vegetarian" label={strings.vegetarian} />
          </CheckboxList>
          <NumberInput
            label={strings.budget}
            units="EUR"
            min={1}
            isIntegerOnly
            hasClear
            size="lg"
            width="100%"
            value={profile.budgetCents === null ? null : profile.budgetCents / 100}
            // With hasClear the input reports null for the clear button.
            onChange={(value: number | null) => setProfile({ budgetCents: value === null ? null : Math.round(value * 100) })}
          />
          <Divider />
          <Choice
            label={strings.language}
            value={profile.lang}
            options={LANGS.map((lang): Option => [lang, LANGUAGE_NAMES[lang]])}
            onChange={(value) => {
              const lang = LANGS.find((key) => key === value);
              if (lang) setProfile({ lang });
            }}
          />
          <Divider />
          <VStack gap={3}>
            <Heading level={2}>{strings.privacyTitle}</Heading>
            <Text>{strings.privacyText}</Text>
            <Button label={strings.deleteData} icon={<Icon icon={Trash2} />} variant="destructive" size="lg" width="100%" onClick={() => setDeleteOpen(true)} />
          </VStack>
          <Divider />
          <VStack gap={3}>
            <Text type="supporting">{strings.productData}</Text>
            <Button label={strings.productDataLinkLabel} icon={<Icon icon={ExternalLink} />} size="lg" width="100%" href={OPEN_FOOD_FACTS_URL} {...outside}>
              {/* The full name is cut at a font scale of 200 percent. */}
              {strings.productDataLink}
            </Button>
          </VStack>
        </VStack>
      </BottomSheet>
      <AlertDialog
        isOpen={isDeleteOpen}
        onOpenChange={setDeleteOpen}
        title={strings.deleteTitle}
        description={strings.deleteText}
        actionLabel={strings.deleteConfirm}
        cancelLabel={strings.deleteCancel}
        onAction={deleteData}
      />
    </>
  );
}
