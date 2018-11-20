var request = require('request');

request.get({
  url: 'http://localhost:8002/federation',
  qs: {
    q: 'tunde_adebayo*ava.org',
    type: 'name'
  }
}, function(error, response, body) {
  console.log(error,body);
});
