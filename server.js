const app = require("./src/app");
const PORT = process.env.PORT || 3056;
const { Server, Socket } = require("socket.io");
const SocketService = require("./src/services/socket.service");
// const cron = require('./src/cron/cron_find_person')
//const SocketService = require('./src/services/socket.service')

// app.use((req,res,next)=>{
//     res.io=io;
//     next();
// })

const server = app.listen(PORT, () => {
  console.log(`WSV eCommerce start with ${PORT}`);
});

const io = new Server(server, {
  cors: {
    origin: "*",
    //origin: ["https://dakenh.voip24h.vn","https://api-multichannel.voip24h.vn/"],
    credentials: true,
  },
});
global._queueGroups = new Map();
global._onlineUsers = new Map();
global._Queue = {
  confide: [],
  learning_exchange: [],
  community: [],
  study: [],
};
global._io = io;
global._io.on("connection", SocketService.connection);
process.on("SIGINT", () => {
  server.close(() => console.log("Exit Server Express"));
  process.exit();
});
