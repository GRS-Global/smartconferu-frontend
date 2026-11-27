/* The two "open it from anywhere" calls of the guided tour, kept apart from the tour itself so the pages that only press the buttons don't carry it:
   the tour (a large module) is loaded after the page is shown. A press that comes before it has loaded is kept and played as soon as it listens. */

export const START_EVENT = "conference-tour-start";
export const SETUP_OPEN_EVENT = "conference-setup-open";

let waiting: string | null = null;

/** Sends the event; when nobody handled it (the tour is not loaded yet) it is kept for `playWaiting`. */
function send(name: string): void {
  const e = new Event(name, { cancelable: true });
  window.dispatchEvent(e);
  waiting = e.defaultPrevented ? null : name;
}

/** Starts the tour from anywhere (the sidebar's "Take a tour" button). */
export const startConferenceTour = () => send(START_EVENT);
/** Opens the setup checklist from anywhere (the menu's "Finish setup" card). */
export const openSetupGuide = () => send(SETUP_OPEN_EVENT);

/** Called by the tour once it listens: plays a press that came before. */
export function playWaiting(): void {
  const name = waiting;
  waiting = null;
  if (name) window.dispatchEvent(new Event(name));
}
