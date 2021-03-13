const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const request = require("superagent");
const _ = require('lodash')
const aqiCalculator = require('./lib')

app.use(express.static('assets'))

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/index.html", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

const users = {};

io.on("connection", async(socket) => {
  // console.log("a user connected");

  users[socket.id] = socket;

  // Fetch data
  let data = await fetchData()
  io.sockets.emit('measurement', data); // Send Measurements

  setInterval(async () => {
    if (Object.keys(users).length) {
      data = await fetchData()
      io.sockets.emit('measurement', data);
    }
  }, 1000 * 60);


  socket.on('command', (data) => {
    io.sockets.emit('command', data);
  })

  socket.on("disconnect", () => {
    delete users[socket.id]
  });
});



async function fetchData() {
  try {
    const res = await request("https://app-api.airvisual.com/api/v5/devices/t1ll5umj")
      .set({'x-api-token': 'Hu/FAo/FejEFaG2utqqqWYEJTYk1/kkOh9XhF4I1sD8='})
      .retry(3)
      .timeout(10000);
    const body = res.body || {};

    const data = {
      aqius: _.get(body, 'data.currentMeasurement.aqius'),
      tp: _.get(body, 'data.currentWeather.temperature'),
      hm: _.get(body, 'data.currentWeather.humidity'),
      ts: _.get(body, 'data.currentMeasurement.ts')
    }

    const pollutants = _.get(body, 'data.currentMeasurement.pollutants', [])

    pollutants.forEach(el => {
      if(el.pollutant === "pm25") {
        const { label } = aqiCalculator(el.conc)
        data.label = label
      }
    })

    return data;
  } catch (ex) {
    console.error("ERROR_FETCHING_DATA", ex.message);
    return {};
  }
}

http.listen(8001, () => console.log("listening on *:8001"));
