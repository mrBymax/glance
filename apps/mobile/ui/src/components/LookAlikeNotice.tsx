import { Banner } from '@astryxdesign/core/Banner';
import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import type { ProductRef } from '@glance/shared';
import { useStrings } from '../bridge/BridgeContext';

/**
 * The message for products that look alike. It names each candidate and shows no price,
 * because the voice never guesses a price.
 */
export function LookAlikeNotice(props: { candidates: ProductRef[] }) {
  const strings = useStrings();
  return (
    <Banner status="info" collapsible={false} title={strings.lookAlikeTitle} description={strings.lookAlikeText}>
      <List header={<Text weight="semibold">{strings.lookAlikeList}</Text>} listStyle="disc">
        {props.candidates.map((item) => (
          <ListItem key={item.id} label={<Text>{strings.candidate(item.name, item.packSize)}</Text>} />
        ))}
      </List>
    </Banner>
  );
}
