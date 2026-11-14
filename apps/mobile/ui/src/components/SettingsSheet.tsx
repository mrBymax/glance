import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { BottomSheet } from '@astryxdesign/core/BottomSheet';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { Heading } from '@astryxdesign/core/Heading';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { EU_ALLERGENS, LANGS, type Profile } from '@glance/shared';
import { useState } from 'react';
import { useUi } from '../bridge/BridgeContext';
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

/** One preference with 2 to 5 values. The control has no visible label of its own, so a text line names it. */
function Choice(props: { label: string; value: string; options: readonly Option[]; onChange(value: string): void }) {
  return (
    <VStack gap={2}>
      <Text weight="semibold">{props.label}</Text>
      <SegmentedControl label={props.label} size="lg" layout="fill" value={props.value} onChange={props.onChange}>
        {props.options.map(([value, label]) => <SegmentedControlItem key={value} value={value} label={label} />)}
      </SegmentedControl>
    </VStack>
  );
}

export function SettingsSheet(props: { isOpen: boolean; onClose(): void }) {
  const { isOpen, onClose } = props;
  const { state, strings, send, dispatch, setProfile } = useUi();
  const { profile } = state;
  const [isDeleteOpen, setDeleteOpen] = useState(false);

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
      <BottomSheet isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} label={strings.settings} height="tall">
        <VStack gap={5}>
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
          <VStack gap={2}>
            <Choice
              label={strings.speechSpeed}
              value={String(nearestRate(profile.speechRate))}
              options={SPEECH_RATES.map((rate): Option => [String(rate), strings.rate(rate)])}
              onChange={(value) => {
                const speechRate = SPEECH_RATES.find((rate) => String(rate) === value);
                if (speechRate !== undefined) setProfile({ speechRate });
              }}
            />
            <Button label={strings.playSample} size="lg" width="100%" onClick={() => send({ t: 'intent', kind: 'help' })} />
          </VStack>
          <CheckboxList
            label={strings.inputAndFeedback}
            density="spacious"
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
          <CheckboxList
            label={strings.allergens}
            density="spacious"
            value={profile.allergens}
            // The patch holds the full list, in the order of the EU list.
            onChange={(values) => setProfile({ allergens: EU_ALLERGENS.filter((key) => values.includes(key)) })}
          >
            {EU_ALLERGENS.map((key) => <CheckboxListItem key={key} value={key} label={strings.allergenNames[key]} />)}
          </CheckboxList>
          <CheckboxList
            label={strings.diet}
            density="spacious"
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
          <Choice
            label={strings.language}
            value={profile.lang}
            options={LANGS.map((lang): Option => [lang, LANGUAGE_NAMES[lang]])}
            onChange={(value) => {
              const lang = LANGS.find((key) => key === value);
              if (lang) setProfile({ lang });
            }}
          />
          <VStack gap={3}>
            <Heading level={2}>{strings.privacyTitle}</Heading>
            <Text>{strings.privacyText}</Text>
            <Button label={strings.deleteData} variant="destructive" size="lg" width="100%" onClick={() => setDeleteOpen(true)} />
          </VStack>
          <VStack gap={3}>
            <Text>{strings.productData}</Text>
            <Button label={strings.productDataLinkLabel} size="lg" width="100%" href={OPEN_FOOD_FACTS_URL}>
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
