const express = require("express");
const { retry } = require("statuses");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const request = require("superagent");
const aqiCalculator = require('./lib')

app.use(express.static('assets'))

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

const users = {};

io.on("connection", async(socket) => {
  console.log("a user connected");

  users[socket.id] = socket;

  // Fetch data
  let data = await fetchData()

  socket.broadcast.emit('measurement', data); // Send Measurements

  setInterval(async () => {
    if (Object.keys(users).length) {
      data = await fetchData()
      socket.broadcast.emit('measurement', data);
    }
  }, 1000 * 60);

  socket.on("disconnect", () => {
    delete users[socket.id]
  });
});



async function fetchData() {
  try {
    const res = await request("https://www.airvisual.com/api/v3/node/5e09686cff5ce29bfeb6f955").retry(3).timeout(10000);
    const body = res.body || {};
    const { label } = aqiCalculator(body.current_measurement.p2.conc)
    return {...body.current_measurement, label};
  } catch (ex) {
    console.error("ERROR_FETCHING_DATA", ex.message);
    return {};
  }
}

http.listen(8001, () => console.log("listening on *:8001"));
