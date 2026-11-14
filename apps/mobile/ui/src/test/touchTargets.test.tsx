import { Button } from '@astryxdesign/core/Button';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Switch } from '@astryxdesign/core/Switch';
import { expect, it } from 'vitest';
import { renderWithTheme } from './render';
import { uncoveredTouchTargets } from './touchTargets';

const noop = () => {};

it('accepts the controls that a 48 px rule covers', () => {
  const { container } = renderWithTheme(<>
    <Button label="Add" />
    <SegmentedControl label="Voice detail" size="lg" value="a" onChange={noop}>
      <SegmentedControlItem value="a" label="A" /><SegmentedControlItem value="b" label="B" />
    </SegmentedControl>
    <CheckboxList label="Feedback" density="spacious" value={[]} onChange={noop}>
      <CheckboxListItem value="haptics" label="Haptics" />
    </CheckboxList>
    <NumberInput label="Budget" value={20} onChange={noop} hasClear />
  </>);
  expect(uncoveredTouchTargets(container)).toEqual([]);
});
it('reports each control that no rule covers', () => {
  const { container } = renderWithTheme(<>
    <button type="button">Raw</button>
    <SegmentedControl label="Voice detail" value="a" onChange={noop}>
      <SegmentedControlItem value="a" label="A" /><SegmentedControlItem value="b" label="B" />
    </SegmentedControl>
    <Switch label="Haptics" value onChange={noop} />
    <CheckboxList label="Feedback" value={[]} onChange={noop}>
      <CheckboxListItem value="x" label="X" />
    </CheckboxList>
  </>);
  expect(uncoveredTouchTargets(container)).toEqual(['button "Raw"', 'radio "A"', 'radio "B"', 'switch "Haptics"', 'checkbox "X"']);
});
