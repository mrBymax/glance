import './mirror.css';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { parseServerEvent, type ServerEvent } from '@glance/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { ApiError, getLatestSession, getSession, sessionEventsUrl } from '../lib/api';
import { replay, subscribeSse, type EventSourceLike } from '../lib/events';
import { eur } from '../lib/format';
import { ClipQueue, playWithAudioElement, type PlayClip } from './clipQueue';
import { fromSnapshot, initialMirrorState, LATEST_POLL_MS, mirrorFlags, mirrorReduce, type MirrorState } from './mirrorModel';
import { MIRROR_RUN } from './mirrorRun';

/**
 * `open`: the stream is up. `lost`: a session is on the screen, and its stream is down.
 * `waiting`: the page follows the phone, and the phone has no session.
 */
type MirrorLink = 'connecting' | 'open' | 'lost' | 'waiting';

type SessionRef = { sessionId: string; token: string };

const isReplay = (search: string) => new URLSearchParams(search).get('replay') === '1';

// The newest line is the first one, so that it stays on the screen when the older lines need more room than the screen has.
function Captions(props: { state: MirrorState }) {
  const captions = [...props.state.captions].reverse();
  if (captions.length === 0) return <Text>Each line that the voice speaks shows here.</Text>;
  return (
    <List edge="flush">
      {captions.map((caption, index) => {
        const isCurrent = index === 0;
        return (
          <ListItem
            key={caption.id}
            label={(
              // The Astryx Text type has no lang prop, so the span names the language of the line.
              <Text color={isCurrent ? 'primary' : 'secondary'}>
                <span lang={caption.lang} className={isCurrent ? 'mirror-caption-current' : 'mirror-caption-old'}>{caption.text}</span>
              </Text>
            )}
          />
        );
      })}
    </List>
  );
}

// The total is the total of the server. The page never adds prices.
function CartPanel(props: { state: MirrorState }) {
  const { cart } = props.state;
  return (
    <VStack as="section" gap={3} className="mirror-cart">
      <Heading level={2}>Cart</Heading>
      {cart.items.length === 0 ? <Text className="mirror-cart-line">The cart is empty.</Text> : (
        <>
          <List hasDividers edge="flush">
            {cart.items.map((item) => (
              <ListItem
                key={item.productId}
                label={<Text className="mirror-cart-line">{item.name}</Text>}
                description={(
                  <Text className="mirror-cart-detail" color="secondary">
                    {`${item.packSize}, ${item.qty} x ${eur(item.unitPriceCents)}`}
                  </Text>
                )}
              />
            ))}
          </List>
          <HStack gap={3} hAlign="between" wrap="wrap">
            <Text className="mirror-cart-line" weight="semibold">Total</Text>
            <Text className="mirror-cart-line" weight="semibold">{eur(cart.totalCents)}</Text>
          </HStack>
        </>
      )}
    </VStack>
  );
}

/**
 * Shows what the glasses say: the captions, the clip of each new caption, and the cart of one session.
 * The page starts on a button, because a browser blocks sound before a tap.
 * With the flag `replay` it makes no network call and plays MIRROR_RUN.
 */
export function MirrorPage(props: {
  fetchFn?: typeof fetch;
  createEventSource?: (url: string) => EventSourceLike;
  playClip?: PlayClip;
  latestPollMs?: number;
  retryMs?: number;
}) {
  const { fetchFn, createEventSource, playClip = playWithAudioElement, latestPollMs = LATEST_POLL_MS, retryMs = 3000 } = props;
  const { search } = useLocation();
  const target = useMemo(() => mirrorFlags(search), [search]);
  const replays = isReplay(search);
  const [isStarted, setStarted] = useState(false);
  const [isMuted, setMuted] = useState(false);
  const [state, setState] = useState(initialMirrorState);
  const [link, setLink] = useState<MirrorLink>('connecting');
  const queueRef = useRef<ClipQueue | null>(null);

  useEffect(() => {
    if (!isStarted) return undefined;
    const queue = new ClipQueue(playClip);
    queueRef.current = queue;
    let isMounted = true;
    // The clip of one caption plays one time, also when the server sends the caption again.
    const played = new Set<string>();

    const onEvent = (event: ServerEvent) => {
      setState((old) => mirrorReduce(old, event));
      if (event.type !== 'caption' || event.url === null) return;
      const clip = `${event.id} ${event.url}`;
      if (played.has(clip)) return;
      played.add(clip);
      queue.enqueue(new URL(event.url, location.origin).href);
    };

    if (replays) {
      const stopRun = replay(MIRROR_RUN, onEvent);
      return () => {
        stopRun();
        queue.stop();
      };
    }
    if (!target) return undefined;

    let current: SessionRef | null = null;
    let closeStream = () => {};
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let snapshotTimer: ReturnType<typeof setTimeout> | undefined;

    const loadSnapshot = async (session: SessionRef) => {
      clearTimeout(snapshotTimer);
      let snapshot;
      try {
        snapshot = await getSession(session.sessionId, session.token, fetchFn);
      } catch (error) {
        // A proxy or a server that restarts can fail one call, so the page asks again.
        // A status of 4xx means that the server refuses this session, and one more call does not change that.
        const isRefused = error instanceof ApiError && error.status >= 400 && error.status < 500;
        if (isMounted && current === session && !isRefused) snapshotTimer = setTimeout(() => void loadSnapshot(session), retryMs);
        return;
      }
      if (isMounted && current === session) setState(fromSnapshot(snapshot));
    };

    const leaveSession = () => {
      clearTimeout(retryTimer);
      clearTimeout(snapshotTimer);
      closeStream();
      closeStream = () => {};
      current = null;
    };

    const openSession = (session: SessionRef) => {
      leaveSession();
      current = session;
      // The stream opens before the snapshot, so that no event is lost between the two.
      closeStream = subscribeSse(sessionEventsUrl(session.sessionId, session.token), parseServerEvent, {
        onEvent,
        onStatus: (status) => {
          if (status === 'open') {
            setLink('open');
            void loadSnapshot(session);
            return;
          }
          setLink('lost');
          if (status !== 'closed') return;
          // The server refused the stream, and the browser does not open it again.
          // With the flag latest, the next answer of the demo path opens a stream. If not, the page tries the same session again.
          if ('latestKey' in target) leaveSession();
          else retryTimer = setTimeout(() => openSession(session), retryMs);
        },
      }, createEventSource);
    };

    if ('sessionId' in target) {
      openSession(target);
      return () => {
        isMounted = false;
        leaveSession();
        queue.stop();
      };
    }

    let isAsking = false;
    const follow = async () => {
      if (isAsking) return;
      isAsking = true;
      let latest;
      try {
        latest = await getLatestSession(target.latestKey, fetchFn);
      } catch {
        latest = null;
      } finally {
        isAsking = false;
      }
      if (!isMounted) return;
      if (!latest) {
        // A session that is on the screen stays there, so that the viewers can read its last lines.
        if (!current) setLink('waiting');
        return;
      }
      if (current?.sessionId === latest.sessionId) return;
      queue.stop();
      setState(initialMirrorState);
      setLink('connecting');
      openSession(latest);
    };
    void follow();
    const poll = setInterval(() => void follow(), latestPollMs);
    return () => {
      isMounted = false;
      clearInterval(poll);
      leaveSession();
      queue.stop();
    };
  }, [isStarted, replays, target, fetchFn, createEventSource, playClip, latestPollMs, retryMs]);

  const toggleMuted = () => {
    queueRef.current?.setMuted(!isMuted);
    setMuted(!isMuted);
  };

  const canStart = replays || target !== null;
  // The recorded run has no stream, so it has no link text.
  const shownLink = replays ? 'open' : link;
  return (
    <HStack as="main" className="mirror" padding={6} gap={8} wrap="wrap">
      <VStack gap={4} className="mirror-voice">
        <Heading level={1}>Mirror</Heading>
        <Text>Demo mirror. It shows what the glasses say.</Text>
        {!canStart ? <Text>Add ?latest=, or ?s= and ?t=, to the address.</Text> : null}
        {canStart && !isStarted ? (
          <HStack><Button label="Start mirror" variant="primary" size="lg" onClick={() => setStarted(true)} /></HStack>
        ) : null}
        {isStarted ? (
          <>
            <HStack><Button label={isMuted ? 'Unmute' : 'Mute'} size="lg" onClick={toggleMuted} /></HStack>
            {shownLink === 'lost' ? <Text weight="semibold">Connection lost. Reconnecting.</Text> : null}
            {shownLink === 'waiting' ? <Text weight="semibold">Waiting for a session on the phone.</Text> : null}
            <Captions state={state} />
          </>
        ) : null}
      </VStack>
      {isStarted ? <CartPanel state={state} /> : null}
    </HStack>
  );
}
