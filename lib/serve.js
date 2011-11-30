var http = require('http')
  , paperboy = require('paperboy')
  , urlparse = require('url').parse
  , crypto = require('crypto')
  , map = {}

http.createServer(function(req, resp) {
  var url = urlparse(req.url, true)

  console.log(req.method + ' - ' +url.pathname)

  if(req.method === 'POST' && url.pathname == '/xhrworker/') {
    var parts = []
    req.on('data', parts.push.bind(parts))
    req.on('end', function() {
      var data = parts.join('')
        , parsed = urlparse('/?'+data, true).query 
        , hash = crypto.createHash('md5').update(parsed.fn).digest('hex')

      map['/parts/'+hash] = parsed.fn

      resp.writeHead(200, {'Content-Type':'application/json'})
      resp.end(JSON.stringify({
        'location':'/parts/'+hash 
      }))
    })
  } else if(url.pathname in map) {
    resp.writeHead(200, {'Content-Type':'text/javascript'})
    resp.end(map[url.pathname])
  } else {
    paperboy.deliver(__dirname, req, resp)
  }
}).listen(8000)
