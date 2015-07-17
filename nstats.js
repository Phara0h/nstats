//clients are the websocket clients
var _ = require('underscore')._;

function Nstats(clients) {

  var stats = this;

  stats.interval = 1000;
  stats.data = {
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
  };


  stats.express = function(req, res, next) {

    if (req.session) {
      if (req.session.stats) {
        stats.data.bytesRead += (req.socket.bytesRead - req.session.stats.bytesRead) > 0 ? req.socket.bytesRead - req.session.stats.bytesRead : 0;
        stats.data.bytesWritten += (req.socket.bytesWritten - req.session.stats.bytesWritten) > 0 ? req.socket.bytesWritten - req.session.stats.bytesWritten : 0;
      }

      req.session.stats = {
        bytesRead: req.socket.bytesRead,
        bytesWritten: req.socket.bytesWritten
      };

      stats.data.totalPackets++;
    } else {
      stats.addWeb(req);
    }
    next();
  };

  stats.addWeb = function(req) {
    stats.data.bytesRead += req.socket.bytesRead;
    stats.data.bytesWritten += req.socket.bytesWritten;
    stats.data.totalPackets++;
  };

  stats.toJson = function() {
    return JSON.stringify(stats.data);
  };

  function ConvertTime(timeInSeconds) {
    var sec_num = parseInt(timeInSeconds, 10);
    var hours = Math.floor(sec_num / 3600);

    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours < 10) {
      hours = "0" + hours;
    }
    if (minutes < 10) {
      minutes = "0" + minutes;
    }
    if (seconds < 10) {
      seconds = "0" + seconds;
    }
    var time = hours + ':' + minutes + ':' + seconds;
    return time;
  }

  stats.calc = function(cb){
      process.nextTick(function() {
        var w = 0;
        var r = 0;
        for (var i in clients) {
          if (clients[i] !== null) {
            try {
              if (clients[i]._socket !== null) {
                var tW = Math.abs(Number(clients[i]._socket.bytesWritten));
                if (_.isNumber(tW))
                  w += tW;
              }

              if (clients[i]._socket !== null) {
                var tR = Math.abs(Number(clients[i]._socket.bytesRead));

                if (_.isNumber(tR))
                  r += tR;
              }
            } catch (e) {
              console.log(e);
            }
          }
        }

        stats.data.writeKBS = Number(Math.abs((w - stats.data.bytesWritten) / 1024)).toFixed(2);
        stats.data.readKBS = Number(Math.abs((r - stats.data.bytesRead) / 1024)).toFixed(2);

        stats.data.totalBytesRead += Math.abs(r - stats.data.bytesRead);
        stats.data.totalBytesWritten += Math.abs(w - stats.data.bytesWritten);
        stats.data.totalMBytesRead = Number((stats.data.totalBytesRead / 1048576).toFixed(2));
        stats.data.totalMBytesWritten = Number((stats.data.totalBytesWritten / 1048576).toFixed(2));
        stats.data.bytesWritten = w;
        stats.data.bytesRead = r;
        stats.data.avgWriteKBs = Number((stats.data.totalBytesWritten / 1024) / (process.uptime())).toFixed(2);
        stats.data.avgReadKBs = Number((stats.data.totalBytesRead / 1024) / (process.uptime())).toFixed(2);


        stats.data.uptime = ConvertTime(process.uptime());
        stats.data.totalMemory = Number(process.memoryUsage().rss / 1048576).toFixed(2);
        stats.data.totalOnlineUsers = (clients != null ? clients.length : 0);
        stats.data.avgPacketsSecond = (stats.data.totalPackets / (process.uptime())).toFixed(2);

        if(cb)
          cb();

        if(stats.interval > 0)
          setTimeout(stats.calc, stats.interval);

    });
  }

  return stats;
}

module.exports = Nstats;
