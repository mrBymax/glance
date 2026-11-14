/*
 * On the site, nobody uses the HUD with keys: it only plays. The toolkit moves the focus to Add when a product waits,
 * and in a frame that call takes the focus from the page of the site. So no element of this document takes the focus.
 */
HTMLElement.prototype.focus = () => undefined;
SVGElement.prototype.focus = () => undefined;
