class NStats
{

  constructor(clients)
  {
    this.clients = clients;
    this.lastCalc = 0;

    this.interval = 1000;
    this.data = {
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
    this.calc();
  }



  express(req, res, next)
  {
    return (req, res, next) => {

       if (req.session) {
         if (req.session.stats) {
           this.data.bytesRead += (req.socket.bytesRead - req.session.this.bytesRead) > 0 ? req.socket.bytesRead - req.session.this.bytesRead : 0;
           this.data.bytesWritten += (req.socket.bytesWritten - req.session.this.bytesWritten) > 0 ? req.socket.bytesWritten - req.session.this.bytesWritten : 0;
         }

         req.session.stats = {
           bytesRead: req.socket.bytesRead,
           bytesWritten: req.socket.bytesWritten
         };

         this.data.totalPackets++;
       } else {
         this.addWeb(req);
       }
       next();
   };
  }

  addWeb(req)
  {
    this.data.bytesRead += req.socket.bytesRead;
    this.data.bytesWritten += req.socket.bytesWritten;
    this.data.totalPackets++;
  };

  toJson()
  {
    return JSON.stringify(this.data);
  };

  ConvertTime(timeInSeconds)
  {
    var sec_num = parseInt(timeInSeconds, 10);
    var hours = Math.floor(sec_num / 3600);

    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours < 10)
    {
      hours = "0" + hours;
    }
    if (minutes < 10)
    {
      minutes = "0" + minutes;
    }
    if (seconds < 10)
    {
      seconds = "0" + seconds;
    }
    var time = hours + ':' + minutes + ':' + seconds;
    return time;
  }

  calc(cb)
  {
    process.nextTick(() =>
    {
      var w = 0;
      var r = 0;

      for (var i in this.clients)
      {
        if (this.clients[i] !== null)
        {
          try
          {
            if (this.clients[i]._socket !== null)
            {
              var tW = Math.abs(Number(this.clients[i]._socket.bytesWritten));
              if (_.isNumber(tW))
                w += tW;
            }

            if (this.clients[i]._socket !== null)
            {
              var tR = Math.abs(Number(this.clients[i]._socket.bytesRead));

              if (_.isNumber(tR))
                r += tR;
            }
          }
          catch (e)
          {
            console.log(e);
          }
        }
      }

      if (this.lastCalc > 0)
        this.lastCalc = Number(((Date.now() - this.lastCalc)) / 1000);

      this.data.writeKBS = Number(Math.abs(((w - this.data.bytesWritten) / 1024) / this.lastCalc)).toFixed(2);
      this.data.readKBS = Number(Math.abs(((r - this.data.bytesRead) / 1024) / this.lastCalc)).toFixed(2);

      this.data.totalBytesRead += Math.abs(r - this.data.bytesRead);
      this.data.totalBytesWritten += Math.abs(w - this.data.bytesWritten);
      this.data.totalMBytesRead = Number((this.data.totalBytesRead / 1048576).toFixed(2));
      this.data.totalMBytesWritten = Number((this.data.totalBytesWritten / 1048576).toFixed(2));
      this.data.bytesWritten = w;
      this.data.bytesRead = r;
      this.data.avgWriteKBs = Number((this.data.totalBytesWritten / 1024) / (process.uptime())).toFixed(2);
      this.data.avgReadKBs = Number((this.data.totalBytesRead / 1024) / (process.uptime())).toFixed(2);


      this.data.uptime = this.ConvertTime(process.uptime());
      this.data.totalMemory = Number(process.memoryUsage().rss / 1048576).toFixed(2);
      this.data.totalOnlineUsers = (this.clients != null ? this.clients.length : 0);
      this.data.avgPacketsSecond = (this.data.totalPackets / (process.uptime())).toFixed(2);

      if(cb)
      {
        cb();
      }

      if (this.interval > 0)
      {
        setTimeout(this.calc, this.interval);
      }

      this.lastCalc = Date.now();
    });
  };

}

module.exports = function(clients)
{
  return new NStats(clients || null)
};
