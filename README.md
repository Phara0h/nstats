# Nstats
A fast and compact way to get all your network and process stats for your node application. Websocket, http/s, express and prometheus compatible!

## Installation

```bash
$ npm install nstats
```
## Quick Start

```javascript
// ws is a websocket server (ws.js) and httpServer is an http or https node server.
var stats = require('nstats')(ws, httpServer);

//use it with express
app.use(stats.express());

//display the stats!
console.log(stats.data); // non-stringifyed
console.log(stats.toJson()) // stringifyed
console.log(stats.toPrometheus()) //  prometheus format
```
## Example

```js
const express = require('express');
const nstats = require('nstats');
const WebSocket = require('ws');
const app = express();
const server = require('http').createServer(app);
const port = 3042;
const wss = new WebSocket.Server({ server });

var stats = require('nstats')(wss, server);
stats.interval = 500;
stats.serverName = "TestServer";

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
      ws.send(message);
  });
});

app.use(stats.express());

app.get('/', (req, res) => res.send());
app.get('/metrics', (req, res) => res.send(stats.toPrometheus()));
app.get('/stats', (req, res) => {
  res.type('json')
  stats.calc(()=>res.send(stats.toJson()));
});

server.listen(port, () => console.log(`Example app listening on port ${port}!`));

```
##Properties

####`stats.data`
The `stats.data` object is a JavaScript object containing all the stats.

```js
{
    "uptime": 209.653,
    "totalMemory": "29.17",
    "activeSockets": 2,
    "responseOverhead": {
        "avg": 0.5810644392156861,
        "highest": 5.175994,
        "lowest": 0.260562,
        "total": 148.17143199999995
    },
    "avgWriteKBs": "3.26",
    "avgReadKBs": "0.28",
    "avgPacketsSecond": "1.22",
    "totalBytesWritten": 700381,
    "totalMBytesWritten": 0.67,
    "totalBytesRead": 60813,
    "totalMBytesRead": 0.06,
    "writeKBS": "0.00",
    "readKBS": "0.00",
    "packetsSecond": "0.00",
    "totalPackets": 255,
    "http": {
        "GET": {
            "200": 255
        }
    }
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

####`stats.serverName`
name that will be added to the tag for prometheus output.

```js
stats.serverName = "SomeName"; // default is 1 "default"
```

##Methods
`stats.addWeb(req,res,sTime)`

A method to add network usage for http requests not done with express or w.s.
res is optional if you want stats.data.http data.
sTime (The start time of when you received the req BigInt) is optional if you want responseOverhead data.

```js
var req = http.get("http://google.com", function(res) {
    res.on('end', function() {
      stats.addWeb(req, res);
    });
});
```
Since its not express or ws, it does not know about it.

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
