import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Divider } from '@astryxdesign/core/Divider';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import type { CartItem } from '@glance/shared';
import { Minus, ShoppingBasket } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useUi } from '../bridge/BridgeContext';
import { eur, itemCount } from '../text/format';

/**
 * One line of the cart or of the receipt: the name in full, then the pack size, the quantity, and the unit price.
 * `action` sits at the end of the second line, so that a long name never pushes it out of the screen.
 */
export function LedgerLine(props: { item: CartItem; action?: ReactNode }) {
  const { item, action } = props;
  const { strings } = useUi();
  return (
    <VStack gap={1}>
      <Text weight="medium" className="glance-wrap">{item.name}</Text>
      <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
        <Text type="supporting" className="glance-ledger-meta">{strings.cartLine(item.packSize, item.qty, eur(item.unitPriceCents))}</Text>
        {action}
      </HStack>
    </VStack>
  );
}

/** The cart lines and the total, as the server sent them. The page adds no prices. */
export function CartList() {
  const { state, strings, send } = useUi();
  const { cart, budget } = state;
  const headingId = useId();
  const isEmpty = cart.items.length === 0;
  return (
    <VStack as="section" aria-labelledby={headingId} gap={3}>
      <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
        <Heading level={2} id={headingId}>{strings.cart}</Heading>
        {isEmpty ? null : <Text type="supporting" weight="medium">{strings.items(itemCount(cart))}</Text>}
      </HStack>
      <Card className={isEmpty ? 'glance-card' : 'glance-card glance-card--list'}>
        {isEmpty ? (
          <HStack gap={3} vAlign="center">
            <Icon icon={ShoppingBasket} color="secondary" />
            <Text color="secondary">{strings.cartEmpty}</Text>
          </HStack>
        ) : (
          <VStack gap={3}>
            <List hasDividers>
              {cart.items.map((item) => (
                <ListItem
                  key={item.productId}
                  label={(
                    <LedgerLine
                      item={item}
                      action={(
                        <Button
                          label={strings.removeLabel(item.name)}
                          icon={<Icon icon={Minus} />}
                          onClick={() => send({ t: 'cart.edit', productId: item.productId, qty: item.qty - 1 })}
                        >
                          {strings.remove}
                        </Button>
                      )}
                    />
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
            <Divider />
            <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap" paddingInline={2}>
              <Text type="large" weight="bold">{strings.total}</Text>
              <Text className="glance-amount glance-amount--total">{eur(cart.totalCents)}</Text>
            </HStack>
          </VStack>
        )}
      </Card>
    </VStack>
  );
}
