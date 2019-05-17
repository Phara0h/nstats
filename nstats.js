class NStats
{

  constructor(ws, httpServer)
  {

    this.clients =  ws.clients || null;
    this.httpServer = httpServer;
    this.lastCalc = 0;
    this.serverName = "default";

    this.interval = 1000;
    this.data = {
      uptime: 0,
      totalMemory: 0,
      activeSockets: 0,
      avgWriteKBs: 0,
      avgReadKBs: 0,
      avgPacketsSecond: 0,
      totalBytesWritten: 0,
      totalMBytesWritten: 0,
      totalBytesRead: 0,
      totalMBytesRead: 0,
      writeKBS: 0,
      readKBS: 0,
      packetsSecond: 0,
      totalPackets: 0,
      http: {
      }
    };

    this._pdata = {
      bytesWritten: 0,
      bytesRead: 0,
      packets: 0
    }

    this.calc();
  }



  express(req, res, next)
  {
    return (req, res, next) =>
    {
      res.on("finish", ()=>{this.addWeb(req,res)});
       next();
    };
  }

  addWeb(req,res)
  {
    this._pdata.bytesRead += req.socket.bytesRead-(req.socket['nstats_bytesRead'] || 0)
    this._pdata.bytesWritten += req.socket.bytesWritten-(req.socket['nstats_bytesWritten'] || 0);
    req.socket['nstats_bytesRead'] = req.socket.bytesRead;
    req.socket['nstats_bytesWritten'] = req.socket.bytesWritten;
    this.data.totalPackets++;
    this._pdata.packets++;
    if(res)
    {

      if(!this.data.http[req.method])
        this.data.http[req.method] = {};

      if(!this.data.http[req.method][res.statusCode])
        this.data.http[req.method][res.statusCode] = 0;

      this.data.http[req.method][res.statusCode]++;
    }
  };

  toJson()
  {
    return JSON.stringify(this.data);
  };

  toPrometheus()
  {
    //# TYPE process_cpu_seconds_total counter process_cpu_seconds_total 1.3411170000000001 1557953471433
    var pstring = "";
    var flatData = this._flattenObjectPrometheus(this.data, "");
    var keys = Object.keys(flatData);
    for (var i = 0; i < keys.length; i++) {
      pstring +=`
# HELP nstats_${this.serverName}_${keys[i]} nstats metric
# TYPE nstats_${this.serverName}_${keys[i]} counter
nstats_${this.serverName}_${keys[i]} ${flatData[keys[i]]} ${Date.now()}`;
    }

    if(this.data.http)
    {
      pstring +=`
# HELP nstats_${this.serverName}_http nstats metric
# TYPE nstats_${this.serverName}_http gauge
`;
      var methods = Object.keys(this.data.http);
      for (var i = 0; i < methods.length; i++) {
        var status = Object.keys(this.data.http[methods[i]]);
        for (var j = 0; j < status.length; j++) {
          pstring += `
nstats_${this.serverName}_http{method="${methods[i]}",status="${status[j]}"} ${(this.data.http[methods[i]])[status[j]]} ${Date.now()}
          `
        }
      }
    }

    return pstring;
  }

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
      if(this.clients)
      {
        var clientArray = Array.from(this.clients);
        for (var i in clientArray)
        {
          if (clientArray[i] !== null)
          {
              if (clientArray[i]._socket !== null)
              {
                var tW = Math.abs(Number(clientArray[i]._socket.bytesWritten));

                if (!isNaN(tW))
                  w += Number(tW);
              }

              if (clientArray[i]._socket !== null)
              {
                var tR = Math.abs(Number(clientArray[i]._socket.bytesRead));

                if (!isNaN(tR))
                  r += Number(tR);
              }
          }
        }
      }

      if (this.lastCalc > 0)
      {
        this.lastCalc = Number(((Date.now() - this.lastCalc)) / 1000);
      }

      this.data.writeKBS = Number(Math.abs(((w - this._pdata.bytesWritten) / 1024) / this.lastCalc)).toFixed(2);
      this.data.readKBS = Number(Math.abs(((r - this._pdata.bytesRead) / 1024) / this.lastCalc)).toFixed(2);

      this.data.totalBytesRead += Math.abs(r - this._pdata.bytesRead);
      this.data.totalBytesWritten += Math.abs(w - this._pdata.bytesWritten);
      this.data.totalMBytesRead = Number((this.data.totalBytesRead / 1048576).toFixed(2));
      this.data.totalMBytesWritten = Number((this.data.totalBytesWritten / 1048576).toFixed(2));
      this._pdata.bytesWritten = w || 0;
      this._pdata.bytesRead = r || 0;

      this.data.avgWriteKBs = Number((this.data.totalBytesWritten / 1024) / (process.uptime())).toFixed(2);
      this.data.avgReadKBs = Number((this.data.totalBytesRead / 1024) / (process.uptime())).toFixed(2);

      this.data.uptime = process.uptime();
      this.data.totalMemory = Number(process.memoryUsage().rss / 1048576).toFixed(2);

      this.data.avgPacketsSecond = (this.data.totalPackets / (process.uptime())).toFixed(2);
      this.data.packetsSecond = Number(Math.abs((w - this._pdata.packets) / this.lastCalc)).toFixed(2);
      this._pdata.packets = 0;

      if(this.httpServer)
      {
        this.httpServer.getConnections((err,count)=>
        {
          this.data.activeSockets = count;
          this._finishCalc(cb);
        })
      }
      else
      {
        this.data.activeSockets = (this.clients != null ? this.clients.length || this.clients.size : 0);
        this._finishCalc(cb);
      }
    });
  };

  _finishCalc(cb)
  {
    if(cb)
    {
      cb();
    }

    if (this.interval > 0)
    {
      setTimeout(()=>{this.calc()}, this.interval);
    }

    this.lastCalc = Date.now();
  }

  _flattenObjectPrometheus(obj,keystr)
  {
    const flattened = {}

    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keystr+=key+'_';
        Object.assign(flattened, this._flattenObjectPrometheus(obj[key],keystr))
      } else {
        if(keystr.indexOf('http') == -1)
        {
          flattened[keystr+key] = obj[key]
        }
      }
  })

  return flattened
}
}

module.exports = function(ws, httpServer)
{
  return new NStats(ws || {}, httpServer || null)
};
