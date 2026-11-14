import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { useUi } from '../bridge/BridgeContext';
import { eur } from '../text/format';

/** The cart lines and the total, as the server sent them. The page adds no prices. */
export function CartList() {
  const { state, strings, send } = useUi();
  const { cart, budget } = state;
  return (
    <VStack as="section" gap={2}>
      <Heading level={2}>{strings.cart}</Heading>
      {cart.items.length === 0 ? <Text>{strings.cartEmpty}</Text> : (
        <>
          <List hasDividers>
            {cart.items.map((item) => (
              <ListItem
                key={item.productId}
                label={<Text>{item.name}</Text>}
                description={<Text type="supporting">{strings.cartLine(item.packSize, item.qty, eur(item.unitPriceCents))}</Text>}
                endContent={(
                  <Button label={strings.removeLabel(item.name)} onClick={() => send({ t: 'cart.edit', productId: item.productId, qty: item.qty - 1 })}>
                    {strings.remove}
                  </Button>
                )}
              />
            ))}
          </List>
          {budget ? (
            <Banner
              status="warning"
              title={strings.budgetOver}
              description={strings.budgetDetail(eur(cart.totalCents), eur(budget.budgetCents))}
            />
          ) : null}
          <HStack gap={3} hAlign="between" wrap="wrap">
            <Text weight="semibold">{strings.total}</Text>
            <Text weight="semibold">{eur(cart.totalCents)}</Text>
          </HStack>
        </>
      )}
    </VStack>
  );
}
