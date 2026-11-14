import { Heading } from '@astryxdesign/core/Heading';
import { VStack } from '@astryxdesign/core/VStack';

export function NotFound() {
  return (
    <VStack as="main" padding={6} gap={4}>
      <Heading level={1}>Page not found</Heading>
    </VStack>
  );
}
