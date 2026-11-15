import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { List, ListItem } from '@astryxdesign/core/List';
import { ScrollableArea } from '@astryxdesign/core/ScrollableArea';
import { Text } from '@astryxdesign/core/Text';
import { Theme } from '@astryxdesign/core/theme';
import { VStack } from '@astryxdesign/core/VStack';
import { Captions, Repeat } from 'lucide-react';
import { useId, useLayoutEffect, useRef } from 'react';
import { defaultThemeSlug, themes } from '../astryx-themes';
import { useUi } from '../bridge/BridgeContext';

const SHOWN_CAPTIONS = 4;
/** The window keeps this height for each number of lines, so that a new caption moves no other content. */
const WINDOW_HEIGHT = '10rem';

/**
 * The last spoken lines as text, the newest last, in a dark window like subtitles.
 * The polite live region of useSpokenText speaks each new line, so this list is no live region.
 * The Astryx Text type has no lang prop, so a span inside it names the language of the line for a screen reader.
 */
export function CaptionList() {
  const { state, strings, send } = useUi();
  const captions = state.captions.slice(-SHOWN_CAPTIONS);
  const headingId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const newestId = captions.at(-1)?.id;

  // The window shows its end, where the newest line is, also when a line grows after the fonts load.
  // The page itself does not scroll.
  useLayoutEffect(() => {
    const content = listRef.current;
    const viewport = content?.closest<HTMLElement>('.astryx-scrollable-area');
    if (!content || !viewport) return undefined;
    const toEnd = () => { viewport.scrollTop = viewport.scrollHeight; };
    toEnd();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(toEnd);
    observer.observe(content);
    return () => observer.disconnect();
  }, [newestId]);

  return (
    <Theme theme={themes[defaultThemeSlug]} mode="dark">
      <VStack as="section" aria-labelledby={headingId} className="glance-captions" gap={3}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <HStack gap={2} vAlign="center">
            <Icon icon={Captions} color="secondary" />
            <Heading level={2} id={headingId}>{strings.captions}</Heading>
          </HStack>
          {captions.length > 0 ? (
            <Button label={strings.repeatLabel} icon={<Icon icon={Repeat} />} onClick={() => send({ t: 'intent', kind: 'repeat' })}>
              {strings.repeat}
            </Button>
          ) : null}
        </HStack>
        <ScrollableArea label={strings.captions} height={WINDOW_HEIGHT} paddingBlockEnd={2}>
          <VStack ref={listRef}>
            {captions.length === 0 ? <Text color="secondary">{strings.noCaptions}</Text> : (
              <List>
                {captions.map((caption) => (
                  <ListItem
                    key={caption.id}
                    label={(
                      <Text className={caption.id === newestId ? 'glance-caption glance-caption--newest' : 'glance-caption'} color="inherit">
                        <span lang={caption.lang}>{caption.text}</span>
                      </Text>
                    )}
                  />
                ))}
              </List>
            )}
          </VStack>
        </ScrollableArea>
      </VStack>
    </Theme>
  );
}
