const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const _ = require('lodash')
const aqiCalculator = require('./lib')

const { MongoClient, ObjectId } = require("mongodb");
let client = null;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'

app.use(express.static('assets'))
app.get("/device", (req, res) =>  res.sendFile(__dirname + "/index.html"));
app.get("/tv", (req, res) =>  res.sendFile(__dirname + "/tv.html"));
app.get("/index.html", (req, res) => res.sendFile(__dirname + "/index.html"));

const users = {};
const DB_MODEL_MAP = { avp: 'device_info', avo: 'avo_device_info' }

io.on("connection", async(socket) => {
  const { model, device_id } = socket.handshake.query || {}
  
  if(!client) client = await MongoClient.connect(MONGO_URL, { useNewUrlParser: true });

  // console.log(`Connected: ${model}_${device_id} ${socket.id}`)

  users[`${model}_${device_id}`] = [...(users[`${model}_${device_id}`] || []), socket]

  // Get current measurements and later listen for changes only
  const current = await client.db("airvisual").collection(DB_MODEL_MAP[model]).findOne({ _id: model !== 'avp' ? ObjectId(device_id) : device_id })
  socket.emit('measurement', etlData(current)); // Send Measurements

  // Listen to changes and if any send new measurements
  const avpStream = client.db("airvisual").collection("device_info").watch([]);
  const avoStream = client.db("airvisual").collection("avo_device_info").watch([]);

  /**
   * documentKey: _id of the document
   * - { _id: 61446ca6a06a860ce78a79bd }
   * operationType: "insert", "update", "delete"
   * fullDocument: after insert, the full document is included in the event
   * ns: object that contains db name and collection name
   * updatedDescription: object that contains the updated/deleted fields
   * - { updatedFields: { email: "toto@example.com" }, removedFields: [] }
   * - { updatedFields: {}, removedFields: ['email'] }
   */
  avpStream.on("change", change => emmit('avp', change));
  avoStream.on("change", change => emmit('avo', change))

  // When user disconnect we remove the socket from the users list
  socket.on("disconnect", () => {
    const disconnectedScoketIndex = users[`${model}_${device_id}`].findIndex(s => s.id === socket.id)
    _.pullAt(users[`${model}_${device_id}`], disconnectedScoketIndex)
  });
});

// This function check if there's any user subscribed to this devices changes and emmit
// those changes to that user
function emmit(model, { documentKey, operationType, updateDescription }) {
  const key = `${model}_${documentKey._id.toString()}`
  if(users[key] && operationType === 'update') {
    const newMeasurements = etlData(_.get(updateDescription, 'updatedFields'))
    if(newMeasurements) users[key].forEach((socket) => socket.emit('measurement', newMeasurements))
  }
}



function etlData(data = {}) {
  const res = {
    aqius: _.get(data, 'current_measurement.aqius'),
    tp: _.get(data, 'current_measurement.tp'),
    hm: _.get(data, 'current_measurement.hm'),
    ts: _.get(data, 'current_measurement.ts')
  }

  const p2 = _.get(data, 'current_measurement.p2') || _.get(data, 'current_measurement.pm25')
  if(p2) res.label = (aqiCalculator(p2.conc) || {}).label

  return res;
}

const PORT = process.env.PORT || 8080
http.listen(PORT, () => console.log(`listening on *:${PORT}`));
