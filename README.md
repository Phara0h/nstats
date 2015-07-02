# Nstats
A fast and compact way to get all your network and process stats for your node application. Websocket and express compatible!

## Installation

```bash
$ npm install nstats
```
## Quick Start

```javascript
// ws is a websocket server (ws.js)
var stats = require('nstats')(ws.clients);

//use it with express
app.use(stats.express);

//display the stats!
console.log(stats.data); // non-stringifyed
console.log(stats.toJson()) // stringifyed
```

##Properties

####`stats.data`
The `stats.data` object is a JavaScript object containing all the stats.

```js
{
  uptime: 0,
  totalMemory: 0,
  totalOnlineUsers: 0,
  avgWriteKBs: 0,
  avgReadKBs: 0,
  avgPacketsSecond: 0,
  bytesWritten: 0,
  totalBytesWritten: 0,
  totalMBytesWritten: 0,
  bytesRead: 0,
  totalBytesRead: 0,
  totalMBytesRead: 0,
  writeKBS: 0,
  readKBS: 0,
  totalPackets: 0
}
```
feel free to add your own stats you want to keep track off too!

```js
stats.data['foo'] = "some dank stat";
```

---

####`stats.interval`
A time in milliseconds on when the stats will refresh and calculate.

```js
stats.interval = 5000; // default is 1 second
```
Set this to 0 if you do not want it to loop.

##Methods####
`stats.addWeb()`

A method to add network usage for http requests not done with express.

```js
http.get("http://google.com", function(res) {
    res.on('end', function() {
      stats.addWeb(res);
    });
});
```
Since its not express, it does not know about it.

---
`stats.calc()`

A method to allow you to manually trigger when the stats are computed.

optional call back can be passed to let you know its done.

```js
stats.calc(function(){
  //its done!
  console.log(stats.data);
});
```
---
