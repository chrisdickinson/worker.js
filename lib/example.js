worker.setXHRCreation('/xhrworker/', 'fn')

var async_fib = worker(function fib(x) {
  if(x === 0) return 1
  if(x === 1) return 1
  return fib(x - 1) + fib(x - 2) 
})


for(var i = 0, len = 10; i < len; ++i) { 
  async_fib(i+10).on('data', function(data) {
    console.log('got data', data, this.x+10)
  })
}

var subworkers = worker(function fib(x, ready) {
  if(x < 2) return ready(1)

  var subworker = worker(fib).inject('worker.js').async()
    , result = []

  subworker(x-1).on('data', function(data) {
    result.push(data)
    if(result.length > 1) {
      return ready(result[0] + result[1])
    }
  })
  subworker(x-2).on('data', function(data) {
    result.push(data)
    if(result.length > 1) {
      return ready(result[0] + result[1])
    }
  })
}).inject('worker.js').async()



for(var i = 0, len = 10; i < len; ++i) { 
  subworkers(i).on('data', function(data) {
    console.log('got data round 2', data, this.x+10)
  })
}

