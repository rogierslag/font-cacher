# Font cacher

With the advancements of HTTP2 it can be beneficial to route all assets, including fonts, through ones domain.
This saves additional roundtrips to establish new connections to the font hosting.

This project aims to include just that, by allowing to an internal service which simply proxies (and caches) [Google Fonts](https://fonts.google.com/).

The system is configured using environment variables

| Key | Description |
|---|---|
| MAX_CSS_ENTRIES | The maximum number of CSS entries to cache. _Default 10000._ |
| MAX_FONT_ENTRIES | The maximum number of font entries to cache. _Default 1000._ |
| PUBLIC_URL | The maximum number of CSS entries to cache. _Default `http://localhost:3000/font/`._ |


