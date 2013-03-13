#uitest-proxy

## Description
Proxy for running uitest.js cross domain and without modifying the html pages

## Features

* serve multiple backend hosts under the same domain using urls with the pattern: `http://proxy-url:proxy-port/path/to/my/page?proxy=realAppHost:realAppPort
* The proxy itself does not keep state, but instead uses the `referer` attribute.
* Automatically adds the `<script>parent.uitest && parent.uitest.instrument(window)` at the beginning of all html pages.

## License
Copyright (c) 2013 Tobias Bosch  
Licensed under the MIT license.

