var http = require('http'),
  httpProxy = require('http-proxy'),
  url = require('url'),
  PROXY_URL_RE = /proxy=([^_]+)_(\d+)/,
  HEAD_BODY_START_RE = /<(head|body)[^>]*>/i,
  ERROR_MSG = "Could not find proxy in url or referer header. Please use " +
    "an url like ...?proxy=<host>_<port>",
  WS_ERROR_MSG = "The request before the websocket request was no proxy-request," +
    "i.e. it did not contain the pattern ...?proxy=<host>_<port> neither in the url nor" +
    " in the referer header",
  UITEST_INSTRUMENT_SCRIPT = '<script type="text/javascript">parent.uitest && parent.uitest.instrument(window);</script>',
  lastProxyConf;

var server = httpProxy.createServer(proxyServerListener, {
    enable: {
      xforward: false // enables X-Forwarded-For
    },
    changeOrigin: true
  });
server.on('upgrade', wsProxyServerListener);
server.listen(8000);

// --------

function proxyServerListener(req, res, proxy) {
  var proxyInReferer = false;
  lastProxyConf = parseProxyUrl(req.url);
  if (!lastProxyConf) {
    lastProxyConf = parseProxyUrl(req.headers.referer);
    proxyInReferer = true;
  }
  if (lastProxyConf) {
    if (isHtmlRequest(req)) {
      if (proxyInReferer) {
        return redirectToUrlWithProxy(lastProxyConf);
      }
      bufferAndProcessWith(processHtml);
    }
    proxy.proxyRequest(req, res, lastProxyConf);
  } else {
    handleError();
  }

  function redirectToUrlWithProxy(proxyConf) {
    var parsedUrl = url.parse(req.url, true);
    parsedUrl.query.proxy = proxyConf.host + '_' + proxyConf.port;
    delete parsedUrl.search;
    res.writeHead(302, {
      Location: url.format(parsedUrl)
    });
    res.write('');
    res.end();
  }

  function bufferAndProcessWith(processorCallback) {
    var _write = res.write,
      _end = res.end,
      _writeHead = res.writeHead,
      writeHeadArgs,
      buffer = '';

    res.write = function(data) {
      buffer += data.toString();
    };
    res.writeHead = function(statusCode) {
      writeHeadArgs = Array.prototype.slice.call(arguments);
    };
    res.end = function() {
      buffer = processorCallback(buffer);
      res.setHeader('Content-Length', buffer.length);
      if (writeHeadArgs) {
        _writeHead.apply(res, writeHeadArgs);
      }
      _write.call(res, buffer);
      _end.call(this);
    };
  }

  function handleError() {
    res.writeHead(404);
    res.write(ERROR_MSG);
    res.end();
  }
}

function parseProxyUrl(url) {
  if (!url) {
    return;
  }
  var match = url.match(PROXY_URL_RE);
  if (match) {
    return {
      host: match[1],
      port: +match[2]
    };
  }
}

function isHtmlRequest(req) {
  var accept = req.headers.accept;
  return (accept && accept.indexOf("text/html") !== -1);
}

function processHtml(htmlPrefix) {
  var replaced;

  return htmlPrefix.replace(HEAD_BODY_START_RE, function(match) {
    if (replaced) {
      return match;
    }
    replaced = true;
    return match + UITEST_INSTRUMENT_SCRIPT;
  });
}

function wsProxyServerListener(req, socket, head) {
  // Note: Websockets do not specify a referer in their requests,
  // So we guess that this request was from the same window as the last request...
  if (lastProxyConf) {
    server.proxy.proxyWebSocketRequest(req, socket, head, lastProxyConf);
  } else {
    // TODO how to cancel the upgrade request??
    socket.destroy();
  }
}