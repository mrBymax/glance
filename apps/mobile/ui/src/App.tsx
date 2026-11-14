import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { VStack } from '@astryxdesign/core/VStack';

export function App() {
  return (
    <VStack as="main" padding={4} gap={4}>
      <Heading level={1}>Glance</Heading>
      <Button label="Add" variant="primary" />
    </VStack>
  );
}
