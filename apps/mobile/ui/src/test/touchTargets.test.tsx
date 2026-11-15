import { Button } from '@astryxdesign/core/Button';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Switch } from '@astryxdesign/core/Switch';
import { expect, it } from 'vitest';
import { renderWithTheme } from './render';
import { uncoveredTouchTargets } from './touchTargets';

const noop = () => {};

it('accepts the controls that a 48 px rule covers', () => {
  const { container } = renderWithTheme(<>
    <Button label="Add" />
    <RadioList label="Voice detail" value="a" onChange={noop}>
      <RadioListItem value="a" label="A" /><RadioListItem value="b" label="B" />
    </RadioList>
    <CheckboxList label="Feedback" density="spacious" value={[]} onChange={noop}>
      <CheckboxListItem value="haptics" label="Haptics" />
    </CheckboxList>
    <NumberInput label="Budget" value={20} onChange={noop} hasClear />
  </>);
  expect(uncoveredTouchTargets(container)).toEqual([]);
});
// A segmented control of each size is below 48 px at a phone width: the app uses radio rows.
it('reports each control that no rule covers', () => {
  const { container } = renderWithTheme(<>
    <button type="button">Raw</button>
    <SegmentedControl label="Voice detail" size="lg" value="a" onChange={noop}>
      <SegmentedControlItem value="a" label="A" /><SegmentedControlItem value="b" label="B" />
    </SegmentedControl>
    <Switch label="Haptics" value onChange={noop} />
    <CheckboxList label="Feedback" value={[]} onChange={noop}>
      <CheckboxListItem value="x" label="X" />
    </CheckboxList>
  </>);
  expect(uncoveredTouchTargets(container)).toEqual(['button "Raw"', 'radio "A"', 'radio "B"', 'switch "Haptics"', 'checkbox "X"']);
});
