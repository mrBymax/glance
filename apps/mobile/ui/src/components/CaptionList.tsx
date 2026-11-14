import { Heading } from '@astryxdesign/core/Heading';
import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { useUi } from '../bridge/BridgeContext';

const SHOWN_CAPTIONS = 4;

/**
 * The last spoken lines as text, the newest last.
 * The Astryx Text type has no lang prop, so a span inside it names the language of the line for a screen reader.
 */
export function CaptionList() {
  const { state, strings } = useUi();
  const captions = state.captions.slice(-SHOWN_CAPTIONS);
  return (
    <VStack as="section" gap={2}>
      <Heading level={2}>{strings.captions}</Heading>
      {captions.length === 0 ? <Text>{strings.noCaptions}</Text> : (
        <List>
          {captions.map((caption) => (
            <ListItem key={caption.id} label={<Text><span lang={caption.lang}>{caption.text}</span></Text>} />
          ))}
        </List>
      )}
    </VStack>
  );
}
