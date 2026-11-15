import { AspectRatio } from '@astryxdesign/core/AspectRatio';
import { Heading } from '@astryxdesign/core/Heading';
import { Link } from '@astryxdesign/core/Link';
import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import type { ReactNode } from 'react';
import { LINKS, TEAM, landingCopy, type Claim, type Links, type TeamMember } from '../content/landing';
import { NUMBERS, formatMeasured, type Numbers } from '../content/numbers';
import { PROBE, type Probe } from '../content/probe';

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <VStack as="section" gap={2}>
      <Heading level={2}>{heading}</Heading>
      {children}
    </VStack>
  );
}

function ClaimLine({ claim }: { claim: Claim }) {
  return (
    <Text as="p">
      {claim.text}
      {claim.source?.url ? (
        <>
          {' '}
          <Link href={claim.source.url} isExternalLink hasUnderline type="inherit">{`Source: ${claim.source.name}`}</Link>
        </>
      ) : null}
    </Text>
  );
}

export function Landing({ probe = PROBE, numbers = NUMBERS, links = LINKS, team = TEAM }: {
  probe?: Probe; numbers?: Numbers; links?: Links; team?: TeamMember[];
}) {
  const copy = landingCopy(probe);
  return (
    <VStack as="main" padding={6} gap={4} maxWidth={720} style={{ marginInline: 'auto' }}>
      <VStack as="header" gap={2} hAlign="start">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcSet="/logo-dark.svg" />
          <img src="/logo-light.svg" alt="Glance" width={240} />
        </picture>
        <Text type="label">{copy.brand}</Text>
        <Heading level={1}>{copy.headline}</Heading>
        <Text as="p" type="large">{copy.lead}</Text>
      </VStack>

      <Section heading={copy.headings.story}>
        {copy.story.map((claim) => <ClaimLine key={claim.text} claim={claim} />)}
      </Section>

      <Section heading={copy.headings.video}>
        {links.videoId === null ? (
          <Text as="p">{copy.videoMissing}</Text>
        ) : (
          <>
            <AspectRatio ratio={16 / 9} fit="cover">
              <iframe
                title="Meta Glance demo video"
                src={`https://www.youtube-nocookie.com/embed/${links.videoId}`}
                allowFullScreen
                style={{ border: 0 }}
              />
            </AspectRatio>
            <Text as="p">{copy.videoCaption}</Text>
          </>
        )}
      </Section>

      <Section heading={copy.headings.steps}>
        <List listStyle="decimal">
          {copy.steps.map((step) => (
            <ListItem key={step.title} label={step.title} description={<Text>{step.text}</Text>} />
          ))}
        </List>
        {copy.rules.map((rule) => <Text key={rule} as="p">{rule}</Text>)}
      </Section>

      <Section heading={copy.headings.accessibility}>
        {copy.accessibility.map((claim) => <ClaimLine key={claim.text} claim={claim} />)}
      </Section>

      <Section heading={copy.headings.data}>
        {copy.data.map((claim) => <ClaimLine key={claim.text} claim={claim} />)}
        <Text as="p"><Link href="/privacy" hasUnderline type="inherit">{copy.privacyLink}</Link></Text>
      </Section>

      <Section heading={copy.headings.numbers}>
        <Text as="p">{numbers.context ?? copy.numbersMissing}</Text>
        <List>
          {numbers.items.map((item) => (
            <ListItem
              key={item.id}
              label={<Text weight="semibold">{item.label}</Text>}
              description={(
                <VStack gap={0.5}>
                  <Text>{formatMeasured(item)}</Text>
                  <Text type="supporting">{item.note}</Text>
                </VStack>
              )}
            />
          ))}
        </List>
        <Text as="p">{copy.tradeoff}</Text>
      </Section>

      <Section heading={copy.headings.tryIt}>
        <ClaimLine claim={copy.trySetup} />
        <List listStyle="decimal">
          {copy.trySteps.map((step) => <ListItem key={step} label={<Text>{step}</Text>} />)}
        </List>
        <Text as="p">
          {links.apkUrl === null ? copy.apkMissing : <Link href={links.apkUrl} hasUnderline type="inherit">{copy.apkLabel}</Link>}
        </Text>
        {copy.tryNotes.map((claim) => <ClaimLine key={claim.text} claim={claim} />)}
      </Section>

      <Section heading={copy.headings.team}>
        {team.map((member) => <Text key={member.name} as="p">{`${member.name}, ${member.role}`}</Text>)}
        <ClaimLine claim={copy.event} />
        <Text as="p">{copy.builtWith}</Text>
        <Text as="p">{copy.disclaimer}</Text>
        <Text as="p"><Link href={links.repoUrl} isExternalLink hasUnderline type="inherit">{copy.repoLabel}</Link></Text>
      </Section>
    </VStack>
  );
}
