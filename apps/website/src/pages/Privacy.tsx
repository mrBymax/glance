import { Heading } from '@astryxdesign/core/Heading';
import { Link } from '@astryxdesign/core/Link';
import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { LINKS, type Links } from '../content/landing';
import { PRIVACY_FACTS, privacyCopy, type PrivacyFacts } from '../content/privacy';
import { PROBE, type Probe } from '../content/probe';

export function Privacy({ probe = PROBE, facts = PRIVACY_FACTS, links = LINKS }: {
  probe?: Probe; facts?: PrivacyFacts; links?: Links;
}) {
  const copy = privacyCopy(probe, facts, links);
  return (
    <VStack as="main" padding={6} gap={4} maxWidth={720} style={{ marginInline: 'auto' }}>
      <VStack as="header" gap={2}>
        <Heading level={1}>{copy.title}</Heading>
        <Text as="p" type="large">{copy.intro}</Text>
      </VStack>

      {copy.sections.map((section) => (
        <VStack key={section.heading} as="section" gap={2}>
          <Heading level={2}>{section.heading}</Heading>
          {section.lines.map((line) => <Text key={line} as="p">{line}</Text>)}
          {section.list ? (
            <List listStyle="decimal">
              {section.list.map((entry) => <ListItem key={entry} label={<Text>{entry}</Text>} />)}
            </List>
          ) : null}
          {section.after?.map((line) => <Text key={line} as="p">{line}</Text>)}
          {section.link ? (
            <Text as="p">
              <Link href={section.link.href} isExternalLink={section.link.href.startsWith('https:')} hasUnderline type="inherit">
                {section.link.label}
              </Link>
            </Text>
          ) : null}
        </VStack>
      ))}

      <Text as="p" type="supporting">{copy.footer}</Text>
    </VStack>
  );
}
