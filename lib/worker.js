;(function() {
  if(typeof __worker_js_name === 'undefined') {
    __worker_js_name = 'root'
  }
  
  var StubbedBlobBuilder = function() { this.data = [] } 
    , StubbedURL = {}

  function FakeWebWorker(data) {
    var global = (function() { var F = function(){}; F.prototype = this; return new F })() 
    var import_script = function(name) {
      // grab the script synchronously.
      var xhr = new XMLHttpRequest
      xhr.open('GET', name, false)
      xhr.send(null)
      try {
        (new Function('window', xhr.responseText))(global)
      } catch(err) {}
    }

    var set = {}
      , obj = {}
    set.onmessage = function(){}

    obj.recv = function(data) {
      if(this.onmessage)
        this.onmessage({data:data})
    }
    var postMessage = function(data) {
      setTimeout(function() { set.onmessage({data:data}) }, 0)
    }
    var recvmsg = function(data) {
      obj.recv(data)  
    }

    global.postMessage = recvmsg
    global.importScripts = import_script
    global.__hnd__ = set
    global.toString = function() { return 'GLOBAL' }

    var fn = new Function('global', 'with(global) { '+data.replace('onmessage = ', '__hnd__.onmessage = ')+'}')(global)
    obj.postMessage = postMessage
    return obj 
  }

  StubbedBlobBuilder.prototype.append = function(data) {
    this.data.push(data)
  }

  StubbedBlobBuilder.prototype.getBlob = function() {
    return this.data.join('')
  }

  StubbedURL.path = null
  StubbedURL.keyword = null

  if(typeof __worker_xhr_creation !== 'undefined') {
    StubbedURL.path = __worker_xhr_creation.path
    StubbedURL.keyword = __worker_xhr_creation.keyword
  }

  StubbedURL.fallbackXHR = function(file) {
    var xhr = new XMLHttpRequest()

    xhr.open('POST', __location__ + StubbedURL.path, false)
    xhr.send(encodeURIComponent(StubbedURL.keyword)+'='+encodeURIComponent(file))

    var loc = JSON.parse(xhr.responseText).location
    loc = loc.charAt(0) === '/' ? loc.slice(1) : loc

    return __location__+loc
  }

  StubbedURL.fallbackLocalStorage = function(file, ready) {
    if(this.__worker_url_responder) {
      postMessage({channel:'askurl', data:file})
      __worker_url_responder.on(file, ready)
    } else {
      return; //ready()
    }
  }

  StubbedURL.createObjectURL = function(file, ready) {
    var url = this.fallbackLocalStorage(file)
    if(url) return url

    url = this.fallbackXHR(file)
    if(url) return url

    return file
  }

  var BlobBuilder = this.BlobBuilder || this.MozBlobBuilder || this.WebKitBlobBuilder || StubbedBlobBuilder
    , URL = this.URL || this.webkitURL || StubbedURL
    , has_webworker = !!this.Worker
    , WebWorker = this.Worker

  if(has_webworker) {
    if(URL === StubbedURL) {
      if(!this.__location__) {
        // uh oh. we've got an issue: safari and IE9 don't
        // support creating blob urls for web workers.
        // let's see if we can get away with dynamically creating them on the server (GAG)
      } else {
        // no webworker support. flying by the seat of our pants!
        StubbedURL.createObjectURL = function(x) { return x }
        WebWorker = FakeWebWorker
        URL = StubbedURL
        BlobBuilder = StubbedBlobBuilder
      }

    } else {
    }
  } else {
    // no webworker support. flying by the seat of our pants!
    StubbedURL.createObjectURL = function(x) { return x }
    WebWorker = FakeWebWorker
    URL = StubbedURL
    BlobBuilder = StubbedBlobBuilder
  }


  if(typeof __location__ === 'undefined') {
    __location__ = document.location+''
  }

  var worker = function(fn) {
    var str = fn.toString()
      , inject = []
      , async = false
      , available = []
      , ret = function() {
          var args = [].slice.call(arguments)
            , webworker = available.length > 0 ? available.shift() : create_webworker()

          webworker.worker.postMessage({channel:'invoke', data:args})
          return {
            'on':function(what, fn) { webworker.on(what, fn); return this }
          } 
        }

      ret.async = function() {
        async = true
        return ret 
      }

      ret.inject = function(item) {
        if(item instanceof Function) {
          inject.push(item+'')
        } else {
          inject.push('importScripts("'+__location__+item+'");')
        }
        return ret
      }

      function create_webworker () {
        var bb = new BlobBuilder
          , blob
          , url

        bb.append('__worker_js_name = "'+available.length+'";\n')
        bb.append('__worker_xhr_creation = '+JSON.stringify({path:StubbedURL.path, keyword:StubbedURL.keyword})+';\n')
        bb.append('console = {log:function() { postMessage({channel:"log", data:[].slice.call(arguments)}) },'+
                             'error:function() { postMessage({channel:"error", data:[].slice.call(arguments)}) }};\n')
        bb.append('\n__location__ = \''+__location__+'\';\n')
        for(var i = 0, len = inject.length; i < len; ++i)
          bb.append(inject[i]+'\n')

        bb.append('\nvar __target__ = '+fn+';\n')
        bb.append('onmessage = '+(async ? 
        function(msg) {
          // async version
          if(msg.data.channel === 'invoke') {
            var ready = function() {
              postMessage({channel:'output', mode:'splat', data:[].slice.call(arguments)})
            }

            __target__.apply(this, msg.data.data.concat([ready]))
          } else if(msg.data.channel === 'respondurl') {
            __worker_url_responder.emit(msg.data.file, msg.data.url)
          }
        } :      
        function(msg) {
          // sync version
          if(msg.data.channel === 'invoke') {
            postMessage({channel:'output', data:__target__.apply(this, msg.data.data)})
          } else if(msg.data.channel === 'respondurl') {
            __worker_url_responder.emit(msg.data.file, msg.data.url)
          }
        })+';\n')

        blob = bb.getBlob('text/javascript')

        url = URL.createObjectURL(blob)

        ret.inject = function() { throw new Error('Cannot inject scripts into a worker that has already been called!') }

        var webworker = new WebWorker(url)
          , ee = {
              worker: webworker
            , listen_error:null
            , listen_data:null
            , on:   function(what, fn) {
                this['listen_'+what] = fn
              }
            , emit: function(what) {
                (this['listen_'+what] || function(){}).apply(this, [].slice.call(arguments, 1))
                this.listen_error = this.listen_data = null
                available.push(ee)
              }
            }
        webworker.onmessage = function(ev) {
          if(ev.data.channel === 'output') {
            if(ev.data.mode === 'splat') 
              ee.emit.apply(ee, ['data'].concat(ev.data.data))
            else  
              ee.emit('data', ev.data.data)
          }
          else if(ev.data.channel === 'log')
            console.log(ev.data.data.length === 1 ? ev.data.data[0] : ev.data.data)
          else if(ev.data.channel === 'error')
            console.error(ev.data.data.length === 1 ? ev.data.data[0] : ev.data.data)
          else if(!ev.data.channel) {
            console.error('NO CHANNEL ON '+ev.data)
          } 
        }
        webworker.onerror = function(ev) { ee.emit('error', ev.data) }
        return ee
      }

      return ret
  }

  // this is our fallback...
  worker.setXHRCreation = function(path, keyword) {
    StubbedURL.path = path.charAt(0) === '/' ? path.slice(1) : path
    StubbedURL.keyword = keyword
  }


  if(typeof define === 'function' && define.amd && define.amd.worker) {
    define('worker', [], function() { return worker; })
  } else {
    this.worker = worker
  }
})()
