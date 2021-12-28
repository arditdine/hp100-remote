const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const request = require("superagent");
const _ = require('lodash')
const aqiCalculator = require('./lib')

const AVP_URL = process.env.AVP_URL
const USER_TOKEN = process.env.USER_TOKEN
const ACCESS_TOKEN = process.env.ACCESS_TOKEN
const PORT = process.env.PORT || 8001

app.use(express.static('assets'))

app.get("/", (req, res) =>  res.sendFile(__dirname + "/index.html"));
app.get("/index.html", (req, res) => res.sendFile(__dirname + "/index.html"));

const users = {};
const cache = {};

io.use(async (socket, next) => {
  const { token } = socket.handshake.query || {};
  if(!token) return next(new Error('No token provided'))
  // Check if provided token is same as the one in the env
  // TODO: You can also use a database and verify if the provided
  // token belongs to any user in the DB
  if(token !== ACCESS_TOKEN) return next(new Error('Invalid token'))
  next()
})

io.on("connection", async(socket) => {
  console.log(`connected - ${socket.id} - ${socket.handshake.headers['user-agent']} - ${new Date().toISOString()}`);

  // For Every new connection we get the Purifier Status
  io.sockets.emit('askPurifierStatus')

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


  socket.on('command', data => io.sockets.emit('command', data))
  socket.on('askPurifierStatus', () => io.sockets.emit('askPurifierStatus'))
  socket.on('purfierStatus', data => io.sockets.emit('purfierStatus', data))

  socket.on("disconnect", () => {
    delete users[socket.id]
    console.log(`disconnected - ${socket.id} - ${socket.handshake.headers['user-agent']} - ${new Date().toISOString()}`);
  });
});



async function fetchData() {
  if(cache && cache.timestamp && Date.now() - cache.timestamp < 1000 * 60) return cache.data

  try {
    const res = await request(AVP_URL).set({'x-api-token': USER_TOKEN}).retry(3).timeout(10000);
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

    cache.data = data
    cache.timestamp = Date.now()

    return data;
  } catch (ex) {
    console.error("ERROR_FETCHING_DATA", ex.message);
    return {};
  }
}

http.listen(PORT, () => console.log(`listening on *:${PORT}`));
