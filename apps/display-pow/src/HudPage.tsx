import { useEffect, useState } from 'react';
import { Button, ButtonRail, Page, Panel, ScrollView, TextColor, TextStyle, TextView, Toast } from '@wearables-ui-toolkit/mrbd';
import { liveUrls, openLive, parseRecording, playRecording, postIntent, readFeedParams } from './feed';
import { INITIAL_HUD_STATE, hudFromSnapshot, hudView, mockAnswer, reduceHud } from './hudState';
import type { HudState } from './hudState';
import mainTake from './recordings/mainTake.json';

// The page reads its mode one time. A change of the query string loads the page again.
const feed = readFeedParams(window.location.search);
const urls = feed.mode === 'live' ? liveUrls(feed.apiBase, feed.sessionId, feed.token) : null;
const captionLabel = urls === null ? 'CAPTION, RECORDED' : 'CAPTION';

export function HudPage() {
  const [state, setState] = useState<HudState>(INITIAL_HUD_STATE);

  useEffect(() => {
    if (urls !== null) {
      return openLive(urls, {
        onSnapshot: (snapshot) => setState(hudFromSnapshot(snapshot)),
        onEvent: (event) => setState((current) => reduceHud(current, event)),
      });
    }
    return playRecording(parseRecording(mainTake), {
      onEvent: (event) => setState((current) => reduceHud(current, event)),
      onRestart: () => setState(INITIAL_HUD_STATE),
    });
  }, []);

  const answer = (kind: 'yes' | 'no') => {
    const pending = state.pending;
    if (pending === null) return;
    if (urls === null) {
      // The recorded mode has no server, so mockAnswer gives the events of the answer.
      setState((current) => mockAnswer(current, kind).reduce(reduceHud, current));
      return;
    }
    void postIntent(urls.intents, { kind, source: 'hud', promptId: pending.promptId }).then((sent) => {
      if (!sent) Toast.show('Not sent. Try again.');
    });
  };

  const view = hudView(state);
  return (
    <Page headerText="Glance" headerMetadata={view.cameraLabel} enableSystemBarInset={false}>
      <div className="action-page-shell">
        <ScrollView insetForHeader tabIndex={0} ariaLabel="Glance status">
          <Panel width="100%">
            <div className="content-inset">
              <div className="fact-group">
                <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>PRODUCT</TextView>
                <TextView as="h2" textStyle={TextStyle.BODY2_EMPHASIZED}>{view.title}</TextView>
                {view.price && <TextView as="p" textStyle={TextStyle.BODY2_EMPHASIZED}>{view.price}</TextView>}
                {view.warnings.map((line) => <TextView key={line} as="p" textStyle={TextStyle.BODY2}>{line}</TextView>)}
                <TextView as="p" textStyle={TextStyle.BODY2}>{view.prompt}</TextView>
              </div>
              <div className="fact-group">
                <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>TOTAL</TextView>
                <TextView as="p" textStyle={TextStyle.META1}>{view.total}</TextView>
              </div>
              <div className="fact-group">
                <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>{captionLabel}</TextView>
                {view.caption && <TextView as="p" textStyle={TextStyle.META1}>{view.caption}</TextView>}
              </div>
            </div>
          </Panel>
        </ScrollView>
        {/* The dock exists only while a product is pending. The runtime audit of the toolkit rejects a dock with no enabled action. */}
        {view.canAnswer && (
          <div className="action-dock">
            <ButtonRail>
              <Button title={view.yesTitle} onClick={() => answer('yes')} />
              <Button title={view.noTitle} onClick={() => answer('no')} />
            </ButtonRail>
          </div>
        )}
      </div>
    </Page>
  );
}
