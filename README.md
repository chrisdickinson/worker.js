Workers.js
==========

A polyfill API for working with web workers in the browser (and hopefully, eventually in Node as well.)

A quick API intro
----------

````javascript

var fibonacci = worker(function fib(x) {
    if(x < 2) return 1
    return fib(x-1) + fib(x-2)
})

fibonacci(11)
    .on('data', function(result) { console.log('fib(11) is '+result) })

````

Or, a contrived example:

````javascript

var get_server_data = worker(function(what, ready) {
    $.getJSON(what, ready)
}).inject('jquery.js').async()

get_server_data('/some/file.json')
    .on('data', function(data) { console.log('look at my data') })

````

What does it do?
----------

It strives to implement the best of Chrome and Firefox's support in a single, unified API, and to trim down
the boilerplate needed to get started with web workers. 

The first major goal is to implement local workers. Most introductions to web workers have you creating them 
like so:

````javascript
var worker = new Worker('some/file/on/the/server.js')
worker.onmessage = function(ev) {
    // do something with ev.data
}

worker.postMessage({some:data})
````

This assumes that you'll have an instance of your worker script available on the server, which is a fairly
inflexible way to work with workers.

Chrome and Firefox support the creation of workers using `BlobBuilder` and `URL.createObjectURL`, which means
that your script can construct and run a worker locally, without any input from the server. Doing so looks a little
messy, though.

The second goal -- reducing boilerplate -- means that when possible I've filled in the blanks: there's no `onmessage` /
`postMessage` bits, no checking for availability, it automatically creates new workers as needed (or reuses idle workers),
and finally it makes `console.log` and `console.error` available from inside workers.

Caveats
-------

* If webworkers are wholly not supported, it will create a fake webworker that runs on the current event loop.

* If creating local webworkers is not supported, it will create a fake web worker by default, *however* it can be configured
to automatically send the appropriate information to your server to utilize the native web workers.

* It's possible (though inadvisable at the moment) to nest workers using this API. Workers created by workers will end up as
either FakeWorkers or have to hit your server repeatedly to generate the appropriate object URLs (Firefox does not support
local worker creation inside another worker, while Webkit does not support worker creation inside workers at all).

API
---

### worker(fn) -> returns CallableWorker

Note that the function passed to `worker` does not close over local scope. 

### CallableWorker#inject(fn | str) -> CallableWorker

This will make the contents of `fn` or the contents of the script located at `str` available inside the worker context.
Once the `CallableWorker` has been called once, subsequent calls to `inject` will fail.

### CallableWorker#async() -> CallableWorker

This will automatically pass in a `ready` function to the worker function. When the worker is finished, just call
`ready` with the arguments you'd like to have emitted to your `data` listener.

````javascript
thing = worker(function(ready) {
    ready('hat', 1, {})
}).async()

thing().on('data', function(string, number, object) {
    // string = 'hat'
    // number = 1
    // object = {}
})
````

### CallableWorker(args...) -> Promise

CallableWorkers are -- amazingly -- callable like normal functions. It maps the arguments from your call to the worker function
you provided (appending a callback function automatically if the worker is async):

Sync example: 

````javascript
worker1 = worker(function(string, number, object) {
    // string = 'gary busey'
    // number = 3
    // object = {}
    return 'hat party' 
})

var promise = worker1('gary busey', 3, {})

promise.on('data', function(result) { /* result = 'hat party' */ })
````

Async example:

````javascript
worker2 = worker(function(string, number, object, ready) {
    // string = 'cat', number = 2, object = {}
    ready('reddit', 'facebook')
})

var promise = worker2('cat', 2, {})

promise.on('data', function(aggregator_site, social_network) {
    // aggregator_site = 'reddit'
    // social_network = 'facebook'
})

````

### Promise#on('data' | 'error', fn)

As above, the promise returned by calling a worker will accept listeners on either `data` or `error`.

### worker.setXHRCreation(path_str, keyword_str) -> undefined

When the XHRCreation params are set, browsers that could not ordinarily create local web workers are provided with the ability
to upload the resultant function data to the server. The server is expected to respond with a JSON blob in the following format:

````javascript
{
    "location":"/unique/path/to/js"
}
````

`worker.js` will then use that URI to grab the data from the server. An example implementation for the server is included in `lib/serve.js`.

License
-------
MIT.
 

