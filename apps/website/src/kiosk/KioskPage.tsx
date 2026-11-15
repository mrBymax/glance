import type { KioskEvent } from '@glance/shared';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { createKiosk, kioskEventsUrl } from '../lib/api';
import { replay, subscribeSse, type EventSourceLike } from '../lib/events';
import { idleEvent, kioskFlags, parseKioskEvent } from './kioskModel';
import { KIOSK_RUN, KIOSK_SPOT_RUN } from './kioskRun';
import { KioskView, type KioskLink } from './KioskView';

const isReplay = (search: string) => new URLSearchParams(search).get('replay') === '1';
const runOf = (search: string) => (kioskFlags(search).spotCheck ? KIOSK_SPOT_RUN : KIOSK_RUN);

/**
 * Registers a kiosk with the flags of the address, shows its code, and follows its event stream.
 * With the flag `replay` it makes no network call and plays KIOSK_RUN in a loop. With `spot` also, it plays KIOSK_SPOT_RUN.
 */
export function KioskPage(props: {
  fetchFn?: typeof fetch;
  createEventSource?: (url: string) => EventSourceLike;
  retryMs?: number;
}) {
  const { fetchFn, createEventSource, retryMs = 3000 } = props;
  const { search } = useLocation();
  const [event, setEvent] = useState<KioskEvent | null>(() => (isReplay(search) ? runOf(search)[0]?.event ?? null : null));
  const [link, setLink] = useState<KioskLink>(() => (isReplay(search) ? 'open' : 'registering'));

  useEffect(() => {
    if (isReplay(search)) return replay(runOf(search), setEvent, true);

    const request = kioskFlags(search);
    let isMounted = true;
    let hasKiosk = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let closeStream = () => {};

    const registerLater = () => {
      // The old code stays on the screen until a new kiosk exists.
      setLink(hasKiosk ? 'lost' : 'unreachable');
      retryTimer = setTimeout(() => void register(), retryMs);
    };

    const register = async () => {
      let created;
      try {
        created = await createKiosk(request, fetchFn);
      } catch {
        if (isMounted) registerLater();
        return;
      }
      if (!isMounted) return;
      hasKiosk = true;
      setEvent(idleEvent(request, created));
      setLink('open');
      closeStream = subscribeSse(kioskEventsUrl(created.kioskId, created.token), parseKioskEvent, {
        onEvent: setEvent,
        onStatus: (status) => {
          if (status !== 'closed') {
            setLink(status);
            return;
          }
          // The server refused the stream: it does not know the kiosk, for example after a restart.
          // The browser does not open that stream again, so the page registers a new kiosk.
          closeStream();
          registerLater();
        },
      }, createEventSource);
    };

    void register();
    return () => {
      isMounted = false;
      clearTimeout(retryTimer);
      closeStream();
    };
  }, [search, fetchFn, createEventSource, retryMs]);

  return <KioskView event={event} link={link} />;
}
