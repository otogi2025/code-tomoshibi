/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { decodeBase64 } from '../../../../base/common/buffer.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { getIconRegistry, registerIcon } from '../../../../platform/theme/common/iconRegistry.js';

/**
 * Code-Tomoshibi ships its own icon font rather than overriding codicon glyphs from CSS.
 *
 * The glyphs are the ones approved for the UI shell.
 * They were converted from stroked SVG to filled outlines and packed with fantasticon on the
 * same em metrics codicon.ttf uses (ascent === unitsPerEm, descent 0), so a Tomoshibi icon
 * sits on the text baseline exactly the way a codicon does and needs no CSS correction.
 *
 * Two deliberate choices worth keeping:
 *
 * - The font travels as base64 inside this file instead of as a file under `media/`, so no
 *   build step has to learn to copy a new binary asset into `out/`.
 * - It reaches the icon registry as a `blob:` URL, not a `data:` URL. The web workbench is
 *   served with `font-src 'self' blob:` (see vs/server/node/webClientServer.ts), so a `data:`
 *   font face would be dropped by the Content-Security-Policy without any visible error.
 */
const TOMOSHIBI_ICON_FONT_ID = 'tomoshibi';

const TOMOSHIBI_ICON_FONT_WOFF2_BASE64 = [
	'd09GMgABAAAAAAfEAAsAAAAADxAAAAd1AAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHFQGYACDNgqQeIxpATYCJAMcCxAABCAFhCIH',
	'gSEbKwyjom5RTlyyfxzkZswLp32Kr3Tf7AyYSPsiVCr7CL7f+27PrenF9aKjojOoWlWEYtAoLMEiNUIhsU+of+9+WiDVDlhFmCE6',
	'IIU+cMlPA5eXXMn4CT09OTk1OaE3/7jt/24Xnp9hEAvtcY6R55sxFKOH+aKMatAGbcKoV13wK+LnjyV3AEcBwM/t3lWGlY2mUTob',
	'jyJbC2h4ADik4R7idMw0VJ2KkrLfnyIw4cKVxt3N02ut/8Ap1ja0qOlBmB0P1vBa76RSSiBS1tCoR+YX9UmV9K1xET/d6sc/l4GS',
	'1Ezd4snXa1X7GWJo+T9elughi2DrhIqMk4lp4m256bmmDyeuaCJP0toJCziGNhrZtUGnLbI1JBUgH355jRJNQcPzcGMIc4zCkITS',
	'4gxCIC6gUIEDbcZBTOy6fsQMVtTSX/JmTbXfCCdFtc90uyNEkJNEbGON47yITaswOzLIFoeEDg2ueYlbRgWhxS3VfD2lN6oBBQES',
	'ekq/YOQhSPYlLcHXbnERgm4lqRMYdlBYS4HjtHXm3PYFaMeoM1ds9gryscSgwjVnyLqBaUWeLui4+ZLGNQBtuXnO6ozXsrV8Plg6',
	'5nYuQD1G7XG5YHTQIzmbcyDbDXE6zDmWDaG7A3WjWN6urQJg3Wy003Gn5UFaAQCm6p8g9E1FcMBQjmVXcGp78dmFnJ/MycoxYFkq',
	'HUkiSmrhAEXx1Vt37rXUjFN5zoUaUM7vJ1UL32unpaIfzO1zUn+o/03l6pX8LSR3PWdVTraWIFBMhdeIBxqQhal0WxgoMvD5W7uW',
	'a7SAl4rjuH8viRmy0k3qkCqPRZSVJR0a8mIZz0mtMF1LXmkXvzinrAyhgWXX6wDHppZqhPFMUPo9VTyk6WhHJiCiWPQUcsQT2Sv7',
	'ZcLZl55H6cVXr7z2uZ2zr2g0hh3wOGJ0WLHfHq1DiF97DlALpA5o1wg/igDkfkPg7qxdTlpi1yO3Q3bb6NXwq1k3426HnjfYb/c7',
	'EXXB6KXZi+OAmHPS7qH22FAI+bh7RcmylQDoqfYsFVaxz+lNWc9MTfH3HLBB9AicCeY0Q6fDMETJDeYK804+IEENZqoiZ2RQDiAC',
	'zKYf28plJX4rc/4fsjf6x4m1BT43boj8SY45dB/KUUpNOXWZkrZWZIdeJEacs1umpebS6R/c0Z074mJb/5WiPiaKT7OH3KE5h/QX',
	'3bjhczr8+PG5YjfYzYMpfiUo8w+Dvvc6N4oRu723w1vgveM9NwjauQLhX0IBt0Ps/l+vtzkwO1Hqmx6zHaWEliIKTbiVUFrPmLAO',
	'Dhj872boxyaf2B3lUq9oV+4MGBKS6HRSDME6fMAbd5PJxsTeW3lFhSfvhvBfu3FUIbg5Ef7jp1Jubq6Nrbei4PeJEB7XAoORzT8y',
	'G19u27U3CONO8a/7N8sHgCQ2XCpLl7HI0AISiuKTE5Bu/Yk9doSMAqdYV7FLhrPPB1ObNljfm3rKZfFxwlXNoSoOxfGd84dhgMn4',
	'//Ll/50K2ApjZh05v4GfA2hEFMmy3lDLIDgG5kfV3jLIgzL6l5/HRratF2NuI3m0N503Ek56nKTn5wAY2L5OjLkP59HX6LzhCNL9',
	'lqAg33vfd6GhNc4TFgrsP95ydb44GO7ahVzY7xuTpzfz9PduHK91/bokWs6YM/JoScBlwixeTuAtzxRcfABChGLUufhdz6JjcyWu',
	'Eibv+4D1oo9bCHQH1++nvW3tgOWL1mP7Hjo9bO4DzNGzRxnQ1xy76zsl00xREVg7GYu+1xfDlHzWHc+TS9Inu4y8ezoDw7h0Cc9Y',
	'OZn6yYnx8dUmToCe0fh5SpZF+/2KlLQgT2rY6IhSJrDwZYJt1nawjo3ddvKr9rDe2WNTe1JuycSbR917eO7xJVc6fDV2mbZZx0AY',
	'3M0pyskAeUGFnN0wzGKatgDUz/nb14nW8EwJnGmyyEEIu0/tCCT7/+yQ45G43GePd4m5HFg3JSRM+WjYSUFTE72l7iEJLSCulgok',
	'wnChRCBV4/GNyIu1ghz7/dvWi/grUP9Z1k1hUxPQiDKekSVoagRAA8EWWj4bcQtHRoBuoFwwCaa4fauwrM8RJvb5w4JeGWxToN/E',
	'2b+SzUDL+7+HbrEI/7XX2OQ/iWW+734pdrgbQg+PSRwZhduT/fnPwX+5SElFk+5U3X8e9nuoMIFeRpRlzm93ljBOziTpxkPIvmQO',
	'akrDen81aau/GXfaP+HY0QaTFnFNUTqyLCDoT2b86M8WfNSUhs/+asV3f7Pgr3/CU/+3m7QXgYQBS2WFfQYz8jzHJ7zd3iEXi5Ht',
	'bu2kv+MWImROoJiYsTI2e0Sa6YyB3WAk8B5ZyjgESVsVUTrb3tZ562xJDDWCgjm8qFiies+AMeJxuaxCKvAO5GP1LBQxu7bsUGpu',
	'RZE2nCNAGYSZXViMGXsIDRozRbmhibnpjhDBI+BdlPIDQ0DuTFuqBoHkzDZOpqmmLbIT9hEU+cBUVKf3SJGjRI0WPcbMsbvKzVHy',
	'yNVKYqVNG7iBftbSiAR1wK/IDIXmd0uinC0eNpLeJoE8q1oNAAA=',
].join('');

function createIconFontLocation(): URI {
	const blob = new Blob([decodeBase64(TOMOSHIBI_ICON_FONT_WOFF2_BASE64).buffer as Uint8Array<ArrayBuffer>], { type: 'font/woff2' });
	return URI.parse(URL.createObjectURL(blob));
}

const tomoshibiIconFont = getIconRegistry().registerIconFont(TOMOSHIBI_ICON_FONT_ID, {
	src: [{ location: createIconFontLocation(), format: 'woff2' }]
});

function registerTomoshibiIcon(id: string, fontCharacter: string, description: string): ThemeIcon {
	return registerIcon(id, { fontCharacter, font: { id: TOMOSHIBI_ICON_FONT_ID, definition: tomoshibiIconFont } }, description);
}

export const tomoshibiLatestIcon = registerTomoshibiIcon('tomoshibi-latest', '\\f101',
	localize('tomoshibi.icon.latest', "Scroll the terminal back to its latest output."));

export const tomoshibiUploadIcon = registerTomoshibiIcon('tomoshibi-upload', '\\f102',
	localize('tomoshibi.icon.upload', "Upload a file and insert its path into the terminal."));

export const tomoshibiLatencyIcon = registerTomoshibiIcon('tomoshibi-latency', '\\f104',
	localize('tomoshibi.icon.latency', "Round trip latency to the server."));

export const tomoshibiClipboardIcon = registerTomoshibiIcon('tomoshibi-clipboard', '\\f105',
	localize('tomoshibi.icon.clipboard', "Clipboard history."));

export const tomoshibiNoteIcon = registerTomoshibiIcon('tomoshibi-note', '\\f106',
	localize('tomoshibi.icon.note', "Scratch notes."));
